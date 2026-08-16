// ─── Mass Assignment Risk Detector ───────────────────────────────────────────
// Detects un-destructured request body binding directly to database models,
// cross-referencing against model declarations for sensitive field risks.
// ─────────────────────────────────────────────────────────────────────────────

import fg from "fast-glob";
import path from "node:path";
import fs from "node:fs/promises";
import type { ScanFinding } from "../../types/index.js";
import type { APIRouteInfo, ModelSchemaInfo } from "./types.js";

const SENSITIVE_FIELDS = new Set([
  "isadmin",
  "admin",
  "role",
  "roles",
  "permissions",
  "permission",
  "verified",
  "isverified",
  "balance",
  "ispaid",
  "paid",
  "id",
  "uuid",
  "is_admin",
  "is_superuser",
  "is_staff",
  "is_active",
  "credit_balance",
  "tenant_id",
  "org_id",
  "account_id",
  "scope",
  "scopes",
]);

let findingCounter = 0;
function nextFindingId(): string {
  return `api-mass-assign-${Date.now()}-${++findingCounter}`;
}

export async function detectMassAssignment(
  rootDir: string,
  routes: APIRouteInfo[],
  filePayloads?: Array<{ path: string; content: string }>
): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = [];
  const writeRoutes = routes.filter(
    (r) => r.method === "POST" || r.method === "PUT" || r.method === "PATCH" || r.method === "ALL"
  );

  if (writeRoutes.length === 0) return findings;

  // Extract model schemas across the codebase (Prisma, Django, ORMs, TS interfaces)
  const models = await extractModelSchemas(rootDir, filePayloads);

  for (const route of writeRoutes) {
    const code = route.handlerContent;

    // Check for mass assignment binding signatures
    const massAssignmentMatch = checkUnsafeBodyBinding(code, route.framework);
    if (!massAssignmentMatch.isUnsafe) continue;

    // Check if fields are explicitly destructured or allowlisted in handler
    if (isExplicitlyAllowlisted(code)) continue;

    // Try to match target model name
    const targetModel = findTargetModel(code, route.path, models);
    const sensitiveField = targetModel
      ? targetModel.fields.find((f) => f.isSensitive)
      : findAnySensitiveFieldInModels(models);

    const isCritical = Boolean(sensitiveField);
    const severity = isCritical ? "critical" : "warning";
    const sensitiveFieldName = sensitiveField ? sensitiveField.name : "isAdmin/role/verified";

    const headline = `Mass assignment risk on ${route.method} ${route.path}`;
    const why = isCritical
      ? `Sensitive field "${sensitiveFieldName}" on model "${targetModel ? targetModel.modelName : "schema"}" could be modified directly by any request payload.`
      : `Request body is passed directly to database write without explicit field allowlisting.`;
    const action = `Explicitly allowlist accepted input fields (e.g. destructure req.body: const { name, email } = req.body).`;

    findings.push({
      id: nextFindingId(),
      severity,
      category: "api-mass-assignment",
      message: headline,
      file: route.handlerFile,
      line: route.handlerLine,
      suggestion: action,
      confidence: "high",
      aiExplanation: {
        whatIsIt: `Mass assignment vulnerability on ${route.method} ${route.path}. The route handler binds the entire request payload directly to model creation or update logic.`,
        whyIsItAProblem: why,
        howSerious: `${severity.toUpperCase()} — attacker can manipulate sensitive internal fields like "${sensitiveFieldName}".`,
        canItBeExploited: `Yes, an attacker can append extra parameters (e.g. {"${sensitiveFieldName}": true}) to the request body to modify unauthorized fields.`,
        howToFix: action,
        canBiltFix: false,
      },
      knowledge: {
        provider: "bilt-api-security",
        type: "api-mass-assignment",
        whatItIs: `Mass assignment risk on ${route.method} ${route.path}`,
        why,
        safeAsPublic: false,
        action,
        docsUrl: "https://owasp.org/www-community/vulnerabilities/Mass_Assignment",
      },
    });
  }

  return findings;
}

function checkUnsafeBodyBinding(
  code: string,
  framework: string
): { isUnsafe: boolean; pattern?: string } {
  // Common unsafe patterns across JS/TS/Py/Ruby
  const patterns = [
    // JS/TS: Model.update(req.body), Model.create(req.body), Object.assign(user, req.body), db.user.update({ data: req.body })
    /\b(?:create|update|upsert|save|bulkCreate)\s*\(\s*(?:req|request|ctx)\.body\b/i,
    /data\s*:\s*(?:req|request|ctx)\.body\b/i,
    /Object\.assign\s*\([^,]+,\s*(?:req|request|ctx)\.body\b/i,
    /\bSpread\s*:\s*\.\.\.(?:req|request|ctx)\.body\b/i,

    // Python / Django / FastAPI: serializer(data=request.data), Model.objects.create(**request.data)
    /Serializer\s*\(\s*data\s*=\s*request\.(?:data|POST|body)\b/i,
    /objects\.(?:create|update)\s*\(\s*\*\*request\.(?:data|POST|body)\b/i,

    // Ruby on Rails: User.create(params), user.update(params) without permit
    /User\.(?:create|update)\s*\(\s*params\s*\)/i,
    /params\.permit!/i,
  ];

  for (const pat of patterns) {
    if (pat.test(code)) {
      return { isUnsafe: true, pattern: pat.source };
    }
  }

  return { isUnsafe: false };
}

function isExplicitlyAllowlisted(code: string): boolean {
  // Patterns indicating fields are destructured or allowlisted
  const destructuring = /const\s*\{\s*[\w\s,]+\s*\}\s*=\s*(?:req|request|ctx)\.body/i;
  const pickOrSelect = /(?:pick|omit|lodash\.pick)\s*\(\s*(?:req|request|ctx)\.body/i;
  const railsPermit = /params\.(?:require|permit)\s*\(/i;
  const serializerFields = /fields\s*=\s*\[[^\]]+\]/i;

  return destructuring.test(code) || pickOrSelect.test(code) || railsPermit.test(code) || serializerFields.test(code);
}

export async function extractModelSchemas(
  rootDir: string,
  filePayloads?: Array<{ path: string; content: string }>
): Promise<ModelSchemaInfo[]> {
  const models: ModelSchemaInfo[] = [];

  let payloads = filePayloads;
  if (!payloads) {
    payloads = [];
    const files = await fg(["**/*.prisma", "**/*.py", "**/*.ts", "**/*.js"], {
      cwd: rootDir,
      ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
      onlyFiles: true,
    });
    for (const relPath of files) {
      try {
        const content = await fs.readFile(path.join(rootDir, relPath), "utf-8");
        payloads.push({ path: relPath, content });
      } catch {
        // Skip
      }
    }
  }

  for (const file of payloads) {
    if (file.path.endsWith(".prisma")) {
      parsePrismaModels(file.path, file.content, models);
    } else if (file.path.endsWith("models.py") || file.content.includes("models.Model")) {
      parseDjangoModels(file.path, file.content, models);
    } else if (file.path.endsWith(".ts") || file.path.endsWith(".js")) {
      parseTypeScriptInterfaces(file.path, file.content, models);
    }
  }

  return models;
}

function parsePrismaModels(filePath: string, content: string, models: ModelSchemaInfo[]): void {
  const modelBlocks = content.split("model ");
  for (let i = 1; i < modelBlocks.length; i++) {
    const block = modelBlocks[i]!;
    const nameMatch = block.match(/^([a-zA-Z0-9_]+)\s*\{/);
    if (!nameMatch) continue;
    const modelName = nameMatch[1]!;

    const fieldLines = block.split("\n");
    const fields = [];
    for (const line of fieldLines) {
      const fieldMatch = line.trim().match(/^([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_?\[\]]+)/);
      if (fieldMatch && fieldMatch[1] && !fieldMatch[1].startsWith("@")) {
        const fieldName = fieldMatch[1];
        const isSens = SENSITIVE_FIELDS.has(fieldName.toLowerCase());
        fields.push({ name: fieldName, isSensitive: isSens });
      }
    }

    models.push({ modelName, file: filePath, fields });
  }
}

function parseDjangoModels(filePath: string, content: string, models: ModelSchemaInfo[]): void {
  const classMatches = content.matchAll(/class\s+([a-zA-Z0-9_]+)\s*\(\s*(?:models\.Model|Model)\s*\):([\s\S]*?)(?=\nclass\s+|\n\S|$)/g);
  for (const m of classMatches) {
    const modelName = m[1]!;
    const body = m[2] || "";
    const fields = [];

    const fieldMatches = body.matchAll(/([a-zA-Z0-9_]+)\s*=\s*models\./g);
    for (const fm of fieldMatches) {
      const fieldName = fm[1]!;
      const isSens = SENSITIVE_FIELDS.has(fieldName.toLowerCase());
      fields.push({ name: fieldName, isSensitive: isSens });
    }

    models.push({ modelName, file: filePath, fields });
  }
}

function parseTypeScriptInterfaces(filePath: string, content: string, models: ModelSchemaInfo[]): void {
  const interfaceMatches = content.matchAll(/(?:interface|type)\s+([a-zA-Z0-9_]+)\s*=?\s*\{([^}]+)\}/g);
  for (const m of interfaceMatches) {
    const modelName = m[1]!;
    const body = m[2] || "";
    const fields = [];

    const fieldMatches = body.matchAll(/([a-zA-Z0-9_]+)\s*\??\s*:/g);
    for (const fm of fieldMatches) {
      const fieldName = fm[1]!;
      const isSens = SENSITIVE_FIELDS.has(fieldName.toLowerCase());
      fields.push({ name: fieldName, isSensitive: isSens });
    }

    models.push({ modelName, file: filePath, fields });
  }
}

function findTargetModel(code: string, routePath: string, models: ModelSchemaInfo[]): ModelSchemaInfo | undefined {
  for (const model of models) {
    const nameLower = model.modelName.toLowerCase();
    if (code.toLowerCase().includes(nameLower) || routePath.toLowerCase().includes(nameLower)) {
      return model;
    }
  }
  return models[0];
}

function findAnySensitiveFieldInModels(models: ModelSchemaInfo[]) {
  for (const m of models) {
    const sens = m.fields.find((f) => f.isSensitive);
    if (sens) return sens;
  }
  return undefined;
}
