import { promises as fs } from "node:fs";
import type { Finding, FindingSeverity } from "../finding/types.js";
import { computeFingerprint } from "../finding/fingerprint.js";
import { getRuleTemplate } from "../finding/templates.js";
import type { Engine, EngineContext } from "../engine/types.js";
import type { ScanFinding } from "../../types/index.js";

function sarifLevelToSeverity(level?: string): FindingSeverity {
  switch (level?.toLowerCase()) {
    case "error":
      return "critical";
    case "warning":
      return "warning";
    default:
      return "info";
  }
}

/**
 * Parse an external SARIF report (e.g. from Semgrep or Gitleaks) into Bilt Finding models.
 */
export function parseSarifReport(rawReport: string | any): Finding[] {
  const findings: Finding[] = [];
  if (!rawReport) return [];

  let parsed: any;
  try {
    parsed = typeof rawReport === "string" ? JSON.parse(rawReport) : rawReport;
  } catch {
    return [];
  }

  if (!parsed || !Array.isArray(parsed.runs)) {
    return [];
  }

  for (const run of parsed.runs) {
    const results = run.results || [];
    const rules = run.tool?.driver?.rules || [];
    const rulesMap = new Map<string, any>();
    for (const r of rules) {
      if (r.id) rulesMap.set(r.id.toUpperCase(), r);
    }

    for (const result of results) {
      const rawRuleId = result.ruleId || "EXTERNAL-RULE";
      const ruleId = rawRuleId.toUpperCase();
      const ruleDef = rulesMap.get(ruleId);
      const severity = sarifLevelToSeverity(result.level);

      const location = result.locations?.[0]?.physicalLocation;
      const file =
        location?.artifactLocation?.uri ||
        result.locations?.[0]?.logicalLocations?.[0]?.name ||
        "unknown";
      const line = location?.region?.startLine || 1;
      const endLine = location?.region?.endLine || line;

      const template = getRuleTemplate(ruleId, "external-scanner", severity);
      const message =
        result.message?.text ||
        ruleDef?.shortDescription?.text ||
        template.title;

      const fingerprint = computeFingerprint({
        ruleId,
        file,
        snippet: result.snippet?.text || message,
      });

      findings.push({
        rule_id: ruleId,
        fingerprint,
        severity,
        precision: "medium", // External scanners default to medium precision in Bilt
        maturity: "stable",
        category: template.category,
        file: file.replace(/\\/g, "/"),
        line,
        end_line: endLine,
        title: template.title,
        explanation: template.explanation,
        agent_action: template.agent_action,
        fixable: false,
      });
    }
  }

  return findings;
}

/**
 * Ingest a SARIF file from disk into Bilt Finding models.
 */
export async function ingestSarifFile(filePath: string): Promise<Finding[]> {
  const content = await fs.readFile(filePath, "utf-8");
  return parseSarifReport(content);
}

/**
 * Optional Engine wrapper for external SARIF ingestion (off by default).
 */
export class ExternalSarifEngine implements Engine {
  id = "external-sarif";
  version = "1.0.0";
  description =
    "Ingests external SARIF results from Semgrep, Gitleaks, and other scanners";

  constructor(private sarifFilePath?: string) {}

  async analyze(context: EngineContext): Promise<ScanFinding[]> {
    if (!this.sarifFilePath) return [];

    try {
      const findings = await ingestSarifFile(this.sarifFilePath);
      return findings.map((f) => ({
        id: `external-${f.rule_id}-${Date.now()}`,
        ruleId: f.rule_id,
        severity: f.severity,
        category: "framework-warning",
        message: `${f.title}: ${f.explanation}`,
        file: f.file,
        line: f.line,
        fingerprint: f.fingerprint,
      }));
    } catch {
      return [];
    }
  }
}
