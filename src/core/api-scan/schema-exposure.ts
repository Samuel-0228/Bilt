// ─── Sensitive Response Schema Field Exposure Detector ───────────────────────
// Static inspection of OpenAPI/Swagger specs and DTO definitions for sensitive fields.
// ─────────────────────────────────────────────────────────────────────────────

import fg from "fast-glob";
import path from "node:path";
import fs from "node:fs/promises";
// @ts-expect-error js-yaml package lacks declaration file in build target
import yaml from "js-yaml";
import type { ScanFinding } from "../../types/index.js";

const SENSITIVE_RESPONSE_FIELDS = new Set([
  "password",
  "passwordhash",
  "password_hash",
  "secret",
  "secretkey",
  "secret_key",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "ssn",
  "socialsecurity",
  "privatekey",
  "private_key",
  "apikey",
  "api_key",
]);

let findingCounter = 0;
function nextFindingId(): string {
  return `api-sensitive-exposure-${Date.now()}-${++findingCounter}`;
}

export async function detectSensitiveSchemaExposure(
  rootDir: string,
  filePayloads?: Array<{ path: string; content: string }>
): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = [];

  let payloads = filePayloads;
  if (!payloads) {
    payloads = [];
    const files = await fg(["**/*.{json,yaml,yml}"], {
      cwd: rootDir,
      ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/package*.json"],
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
    const filename = path.basename(file.path).toLowerCase();
    if (
      filename.includes("openapi") ||
      filename.includes("swagger") ||
      file.content.includes("openapi:") ||
      file.content.includes('"openapi"') ||
      file.content.includes("swagger:") ||
      file.content.includes('"swagger"')
    ) {
      inspectOpenApiSpec(file.path, file.content, findings);
    }
  }

  return findings;
}

function inspectOpenApiSpec(
  filePath: string,
  content: string,
  outFindings: ScanFinding[]
): void {
  let spec: any;
  try {
    if (filePath.endsWith(".json")) {
      spec = JSON.parse(content);
    } else {
      spec = yaml.load(content);
    }
  } catch {
    return;
  }

  if (!spec || typeof spec !== "object") return;

  const pathsObj = spec.paths || {};
  for (const [pathStr, pathItem] of Object.entries<any>(pathsObj)) {
    if (!pathItem || typeof pathItem !== "object") continue;

    for (const [method, operation] of Object.entries<any>(pathItem)) {
      if (!operation || typeof operation !== "object" || !operation.responses) continue;

      const responses = operation.responses;
      for (const [statusCode, resp] of Object.entries<any>(responses)) {
        if (!statusCode.startsWith("2")) continue; // Focus on 200 OK / 201 Created responses
        if (!resp || typeof resp !== "object") continue;

        const contentObj = resp.content || {};
        for (const [mediaType, mediaObj] of Object.entries<any>(contentObj)) {
          const schema = mediaObj?.schema;
          if (schema) {
            checkSchemaProperties(filePath, pathStr, method.toUpperCase(), schema, outFindings);
          }
        }

        if (resp.schema) {
          checkSchemaProperties(filePath, pathStr, method.toUpperCase(), resp.schema, outFindings);
        }
      }
    }
  }
}

function checkSchemaProperties(
  filePath: string,
  pathStr: string,
  method: string,
  schema: any,
  outFindings: ScanFinding[]
): void {
  if (!schema || typeof schema !== "object") return;

  const props = schema.properties || (schema.items && schema.items.properties);
  if (!props || typeof props !== "object") return;

  for (const [propName, propDef] of Object.entries(props)) {
    const cleanName = propName.toLowerCase().replace(/[^a-z_]/g, "");
    if (SENSITIVE_RESPONSE_FIELDS.has(cleanName)) {
      const headline = `Sensitive field "${propName}" included in OpenAPI response schema for ${method} ${pathStr}`;
      const why = `Documented response shape includes sensitive field "${propName}" in OpenAPI spec ${path.basename(filePath)}. This can result in accidental credential or secret exposure to API clients.`;
      const action = `Remove sensitive field "${propName}" from client response DTO / OpenAPI response schema, or mask its value before returning.`;

      outFindings.push({
        id: nextFindingId(),
        severity: cleanName.includes("password") || cleanName.includes("private") || cleanName.includes("ssn") ? "critical" : "warning",
        category: "api-sensitive-exposure",
        message: headline,
        file: filePath,
        suggestion: action,
        confidence: "high",
        aiExplanation: {
          whatIsIt: `Sensitive field exposure in API response schema on ${method} ${pathStr}. Field "${propName}" is declared in the public API response schema.`,
          whyIsItAProblem: why,
          howSerious: `CRITICAL/WARNING — exposing sensitive fields like "${propName}" in API responses can leak credentials or PII.`,
          canItBeExploited: `Clients or attackers consuming this endpoint will receive raw sensitive field data in HTTP responses.`,
          howToFix: action,
          canBiltFix: false,
        },
        knowledge: {
          provider: "bilt-api-security",
          type: "api-sensitive-exposure",
          whatItIs: `Sensitive field exposure on ${method} ${pathStr}`,
          why,
          safeAsPublic: false,
          action,
          docsUrl: "https://owasp.org/www-project-top-ten/2021/A01_2021-Broken_Access_Control/",
        },
      });
    }
  }
}
