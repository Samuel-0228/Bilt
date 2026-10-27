// ─── Command: bilt explain ────────────────────────────────────────────────────
// Explains production readiness concepts and security rules with structured guides.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TAXONOMY } from "../core/readiness/taxonomy.js";
import { colors, glyphs, divider } from "../ui/theme.js";
import { RULE_TEMPLATES } from "../core/finding/templates.js";
import { ALL_SECURITY_RULES } from "../core/security-engine/rules/index.js";
import { DESIGN_RULES } from "../core/design/catalog.js";
import type { RuleTemplate } from "../core/finding/types.js";
import type { SecurityRule } from "../core/security-engine/types.js";
import type { DesignRule } from "../core/design/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATEGORY_ALIASES: Record<string, string> = {
  authentication: "auth",
  secrets: "secrets-and-env",
  env: "secrets-and-env",
  input: "input-validation",
  inputs: "input-validation",
  validation: "input-validation",
  api: "api-abuse-and-cost",
  abuse: "api-abuse-and-cost",
  cost: "api-abuse-and-cost",
  db: "database",
  deps: "dependencies",
  dependency: "dependencies",
  logging: "error-handling-logs",
  logs: "error-handling-logs",
  errors: "error-handling-logs",
  headers: "transport-and-headers",
  cors: "transport-and-headers",
  transport: "transport-and-headers",
  deploy: "deploy-config",
  config: "deploy-config",
  uploads: "file-uploads",
  upload: "file-uploads",
  payment: "payments",
  privacy: "privacy-and-pii",
  pii: "privacy-and-pii",
  monitoring: "monitoring-rollback",
  rollback: "monitoring-rollback",
  design: "design",
  "design-genericity": "design-genericity",
  "design-quality": "design",
  vibecoding: "design",
  "anti-vibecoding": "design",
};

export interface ExplainOptions {
  json?: boolean;
  format?: "text" | "json" | "agent";
}

interface ParsedConcept {
  title: string;
  category: string;
  status: string;
  whatItIs?: string;
  whyMissed?: string;
  realWorldConsequence?: string;
  whatBiltCanVerify?: string;
  whatBiltCannotVerify?: string;
  howAgentShouldInspect?: string;
  secureImplementation?: string;
  rawContent: string;
}

function parseConceptMarkdown(content: string, categoryId: string): ParsedConcept {
  let status = "GUIDED";
  const statusMatch = content.match(/Status:\s*([A-Z_]+)/i);
  if (statusMatch) {
    status = statusMatch[1]?.toUpperCase() ?? "GUIDED";
  }

  let title = categoryId;
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1]?.trim() ?? categoryId;
  }

  const sections: Record<string, string> = {};
  const sectionRegex = /^##\s+([^\n]+)\n([\s\S]*?)(?=(?:^##\s+)|$)/gm;
  let match: RegExpExecArray | null;

  while ((match = sectionRegex.exec(content)) !== null) {
    const heading = (match[1] || "").toLowerCase().trim();
    const body = (match[2] || "").trim();

    if (heading.includes("what it is")) {
      sections.whatItIs = body;
    } else if (heading.includes("why ai") || heading.includes("often miss")) {
      sections.whyMissed = body;
    } else if (heading.includes("consequence") || heading.includes("risk")) {
      sections.realWorldConsequence = body;
    } else if (heading.includes("can verify") && !heading.includes("cannot")) {
      sections.whatBiltCanVerify = body;
    } else if (heading.includes("cannot verify")) {
      sections.whatBiltCannotVerify = body;
    } else if (heading.includes("agent") || heading.includes("inspect")) {
      sections.howAgentShouldInspect = body;
    } else if (heading.includes("secure implementation")) {
      sections.secureImplementation = body;
    }
  }

  return {
    title,
    category: categoryId,
    status,
    whatItIs: sections.whatItIs,
    whyMissed: sections.whyMissed,
    realWorldConsequence: sections.realWorldConsequence,
    whatBiltCanVerify: sections.whatBiltCanVerify,
    whatBiltCannotVerify: sections.whatBiltCannotVerify,
    howAgentShouldInspect: sections.howAgentShouldInspect,
    secureImplementation: sections.secureImplementation,
    rawContent: content,
  };
}

function printFormattedConcept(concept: ParsedConcept): void {
  console.log("");
  const badgeColor =
    concept.status === "ENFORCED"
      ? colors.mintClear
      : concept.status === "GUIDED"
        ? colors.vitalTeal
        : colors.amberFlag;

  console.log(colors.vitalTeal.bold("  BILT PRODUCTION READINESS CONCEPT"));
  console.log(
    `  ${colors.mintClear.bold(concept.title.padEnd(35))} ${badgeColor.bold(`[${concept.status}]`)}`,
  );
  console.log(divider(65));
  console.log("");

  if (concept.whatItIs) {
    console.log(colors.vitalTeal.bold(`  ${glyphs.info} What It Is`));
    console.log(colors.slateDim.apply(`    ${concept.whatItIs}\n`));
  }

  if (concept.whyMissed) {
    console.log(colors.amberFlag.bold(`  ${glyphs.warning} Why AI-Generated Code Often Misses It`));
    console.log(colors.slateDim.apply(`    ${concept.whyMissed}\n`));
  }

  if (concept.realWorldConsequence) {
    console.log(colors.pulseCoral.bold(`  ${glyphs.critical} Real-World Consequence (Exploitation Risk)`));
    console.log(colors.pulseCoral.apply(`    ${concept.realWorldConsequence}\n`));
  }

  if (concept.whatBiltCanVerify || concept.whatBiltCannotVerify) {
    console.log(colors.vitalTeal.bold(`  ◆ Verification Scope`));
    if (concept.whatBiltCanVerify) {
      console.log(colors.mintClear.apply(`    ${glyphs.passed} What Bilt can verify automatically:`));
      console.log(colors.slateDim.apply(`      ${concept.whatBiltCanVerify}`));
    }
    if (concept.whatBiltCannotVerify) {
      console.log(colors.slateDim.dim(`    • What requires human/guided inspection:`));
      console.log(colors.slateDim.dim(`      ${concept.whatBiltCannotVerify}`));
    }
    console.log("");
  }

  if (concept.howAgentShouldInspect) {
    console.log(colors.vitalTeal.bold(`  ◆ How an Agent or Reviewer Should Inspect It`));
    console.log(colors.slateDim.apply(`    ${concept.howAgentShouldInspect}\n`));
  }

  if (concept.secureImplementation) {
    console.log(colors.mintClear.bold(`  ✓ Secure Implementation Guidelines`));
    console.log(colors.slateDim.apply(`    ${concept.secureImplementation}\n`));
  }

  console.log(divider(65));
  console.log("");
}

function printFormattedRuleTemplate(rule: RuleTemplate): void {
  console.log("");
  const sevColor =
    rule.severity === "critical"
      ? colors.pulseCoral
      : rule.severity === "warning"
        ? colors.amberFlag
        : colors.vitalTeal;

  console.log(colors.vitalTeal.bold("  BILT SECURITY RULE EXPLANATION"));
  console.log(`  ${sevColor.bold(rule.rule_id)}: ${rule.title}`);
  console.log(divider(65));
  console.log("");

  console.log(colors.slateDim.dim(`  Category:    ${rule.category}`));
  console.log(colors.slateDim.dim(`  Severity:    ${sevColor.bold(rule.severity.toUpperCase())}`));
  console.log(colors.slateDim.dim(`  Precision:   ${rule.precision}`));
  console.log(colors.slateDim.dim(`  Maturity:    ${rule.maturity}`));
  console.log("");

  console.log(colors.vitalTeal.bold(`  ${glyphs.info} Explanation & Danger`));
  console.log(colors.slateDim.apply(`    ${rule.explanation}\n`));

  console.log(colors.mintClear.bold(`  ✓ Recommended Remediation / Agent Action`));
  console.log(colors.slateDim.apply(`    ${rule.agent_action}\n`));

  console.log(divider(65));
  console.log("");
}

function printFormattedSecurityRule(rule: SecurityRule): void {
  console.log("");
  const sevColor =
    rule.severity === "critical"
      ? colors.pulseCoral
      : rule.severity === "warning"
        ? colors.amberFlag
        : colors.vitalTeal;

  console.log(colors.vitalTeal.bold("  BILT STATIC SECURITY RULE"));
  console.log(`  ${sevColor.bold(rule.id)}: ${rule.title}`);
  console.log(divider(65));
  console.log("");

  console.log(colors.slateDim.dim(`  Category:    ${rule.category}`));
  console.log(colors.slateDim.dim(`  Severity:    ${sevColor.bold(rule.severity.toUpperCase())}`));
  if (rule.frameworks && rule.frameworks.length > 0) {
    console.log(colors.slateDim.dim(`  Frameworks:  ${rule.frameworks.join(", ")}`));
  }
  if (rule.cwe) {
    console.log(colors.slateDim.dim(`  CWE:         ${rule.cwe}`));
  }
  if (rule.owaspMapping) {
    console.log(colors.slateDim.dim(`  OWASP:       ${rule.owaspMapping}`));
  }
  if (rule.docsUrl) {
    console.log(colors.slateDim.dim(`  Reference:   ${rule.docsUrl}`));
  }
  console.log("");

  console.log(colors.pulseCoral.bold(`  ${glyphs.critical} Why This Is Dangerous`));
  console.log(colors.slateDim.apply(`    ${rule.whyThisIsDangerous}\n`));

  console.log(colors.amberFlag.bold(`  ▲ How Attackers Abuse It`));
  console.log(colors.slateDim.apply(`    ${rule.howAttackersAbuseIt}\n`));

  console.log(colors.mintClear.bold(`  ✓ Suggested Fix`));
  console.log(colors.slateDim.apply(`    ${rule.suggestedFix}\n`));

  const insecureCase = rule.testCases?.find((tc) => tc.shouldMatch);
  const secureCase = rule.testCases?.find((tc) => !tc.shouldMatch);

  if (insecureCase) {
    console.log(colors.pulseCoral.bold(`  ✖ Vulnerable Example`));
    console.log(
      insecureCase.code
        .trim()
        .split("\n")
        .map((l: string) => colors.slateDim.dim(`    ${l}`))
        .join("\n") + "\n",
    );
  }

  if (secureCase) {
    console.log(colors.mintClear.bold(`  ✓ Remediated Example`));
    console.log(
      secureCase.code
        .trim()
        .split("\n")
        .map((l: string) => colors.slateDim.apply(`    ${l}`))
        .join("\n") + "\n",
    );
  }

  console.log(divider(65));
  console.log("");
}

function printFormattedDesignRule(rule: DesignRule): void {
  console.log("");
  const sevColor =
    rule.severity === "high"
      ? colors.pulseCoral
      : rule.severity === "medium"
        ? colors.amberFlag
        : colors.vitalTeal;

  console.log(colors.vitalTeal.bold("  BILT DESIGN & ANTI-VIBECODING RULE"));
  console.log(`  ${sevColor.bold(rule.id)}: ${rule.title}`);
  console.log(divider(65));
  console.log("");

  console.log(colors.slateDim.dim(`  Category:    ${rule.category}`));
  console.log(colors.slateDim.dim(`  Severity:    ${sevColor.bold(rule.severity.toUpperCase())}`));
  console.log("");

  console.log(colors.vitalTeal.bold(`  ${glyphs.info} Why It Matters`));
  console.log(colors.slateDim.apply(`    ${rule.whyItMatters}\n`));

  console.log(colors.mintClear.bold(`  ✓ Actionable Recommendation`));
  console.log(colors.mintClear.apply(`    ${rule.recommendation}\n`));

  console.log(colors.vitalTeal.bold(`  ◆ Coding Agent Action`));
  console.log(colors.slateDim.apply(`    ${rule.agentAction}\n`));

  console.log(divider(65));
  console.log("");
}

export async function executeExplain(
  targetArg?: string,
  options: ExplainOptions = {},
): Promise<number> {
  const isJson = options.json || options.format === "json" || options.format === "agent";

  if (!targetArg) {
    if (isJson) {
      console.log(JSON.stringify(TAXONOMY, null, 2));
    } else {
      printCategoryCatalog();
    }
    return 0;
  }

  const normalized = targetArg.trim();
  const upper = normalized.toUpperCase();

  // 1. Check if target is a benchmark RuleTemplate (e.g. RULE-SEC-001)
  if (RULE_TEMPLATES[upper]) {
    const template = RULE_TEMPLATES[upper]!;
    if (isJson) {
      console.log(JSON.stringify(template, null, 2));
    } else {
      printFormattedRuleTemplate(template);
    }
    return 0;
  }

  // 2. Check if target is a SecurityRule from the engine (e.g. SEC-SEC-001, SEC-AUTH-001)
  const secRule = ALL_SECURITY_RULES.find(
    (r) => r.id.toLowerCase() === normalized.toLowerCase(),
  );
  if (secRule) {
    if (isJson) {
      console.log(JSON.stringify(secRule, null, 2));
    } else {
      printFormattedSecurityRule(secRule);
    }
    return 0;
  }

  // 3. Check if target is a DesignRule from the catalog (e.g. DESIGN-VISUAL-001, GENERIC-SAAS-COMBINATION-001)
  const designRule = DESIGN_RULES.find(
    (r) => r.id.toLowerCase() === normalized.toLowerCase(),
  );
  if (designRule) {
    if (isJson) {
      console.log(JSON.stringify(designRule, null, 2));
    } else {
      printFormattedDesignRule(designRule);
    }
    return 0;
  }

  // 4. Resolve category concept file (e.g. auth, authorization, secrets-and-env, design, design-genericity)
  const categoryId =
    CATEGORY_ALIASES[normalized.toLowerCase()] || normalized.toLowerCase();

  const conceptsDir = path.resolve(__dirname, "../../src/concepts");
  const distConceptsDir = path.resolve(__dirname, "../concepts");

  let filePath = path.join(conceptsDir, `${categoryId}.md`);
  try {
    await fs.access(filePath);
  } catch {
    filePath = path.join(distConceptsDir, `${categoryId}.md`);
  }

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = parseConceptMarkdown(content, categoryId);

    if (isJson) {
      console.log(JSON.stringify(parsed, null, 2));
    } else {
      printFormattedConcept(parsed);
    }
    return 0;
  } catch {
    console.error("");
    console.error(
      colors.pulseCoral.bold(
        `  ${glyphs.critical} Unknown category or rule ID: '${targetArg}'`,
      ),
    );
    console.error("");
    printCategoryCatalog();
    return 1;
  }
}

function printCategoryCatalog(): void {
  console.log("");
  console.log(colors.vitalTeal.bold("  BILT PRODUCTION READINESS CONCEPTS"));
  console.log(
    colors.slateDim.dim(
      "  Learn how to inspect and harden AI-generated applications before shipping.\n",
    ),
  );
  console.log(`  Usage: ${colors.mintClear.apply("bilt explain <category|rule-id>")}\n`);

  console.log(colors.slateDim.apply("  Available Categories:\n"));
  for (const meta of TAXONOMY) {
    const rawBadge =
      meta.enforcement === "enforced"
        ? "[ENFORCED]"
        : meta.enforcement === "guided"
          ? "[GUIDED]"
          : meta.enforcement === "partial"
            ? "[PARTIAL]"
            : "[COMING SOON]";

    const color =
      meta.enforcement === "enforced"
        ? colors.mintClear
        : meta.enforcement === "guided"
          ? colors.vitalTeal
          : meta.enforcement === "partial"
            ? colors.amberFlag
            : colors.slateDim;

    const idCol = meta.id.padEnd(25);
    const badgeCol = color.apply(rawBadge.padEnd(16));
    console.log(`    ${idCol} ${badgeCol} ${meta.name}`);
  }

  console.log("");
  console.log(
    colors.slateDim.dim(
      "  You can also inspect specific rule IDs (e.g. 'bilt explain RULE-SEC-001' or 'SEC-AUTH-001').",
    ),
  );
  console.log("");
}
