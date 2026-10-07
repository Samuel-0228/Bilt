// ─── Agent JSON Formatter for Design Check ──────────────────────────────────
// Returns strictly versioned stable JSON for coding agents per Section 7.
// ─────────────────────────────────────────────────────────────────────────────

import type { DesignCheckResult } from "../types.js";

export function formatAgentDesignOutput(result: DesignCheckResult): object {
  const allFiles = Array.from(
    new Set(
      result.findings.flatMap((f) =>
        f.locations && f.locations.length > 0
          ? f.locations.map((l) => l.file)
          : f.file ? [f.file] : [],
      ),
    ),
  );

  const nextAction =
    result.status === "pass"
      ? {
          type: "stop",
          findingIds: [],
          instruction: "STOP. Design and UI quality checks pass. Clean domain UI verified.",
        }
      : result.status === "escalate"
        ? {
            type: "escalate",
            findingIds: [],
            instruction: result.escalationMessage || "HALT automated UI retries. Request human direction.",
          }
        : {
            type: "fix",
            findingIds: result.findings.map((f) => f.fingerprint.slice(0, 8)),
            instruction:
              `MANDATORY DESIGN REFACTOR: ${result.findings.length} design quality pattern(s) detected across [${allFiles.slice(0, 3).join(", ")}]. ` +
              `Run 'npx bilt design-check --fix' for automated mechanical fixes, then refactor generic templates into authentic domain UI and re-run 'npx bilt design-check --format agent'.`,
          };

  const output: any = {
    schemaVersion: "1",
    status: result.status,
    summary: {
      patternsDetected: result.summary.patternsDetected,
      high: result.summary.high,
      medium: result.summary.medium,
      low: result.summary.low,
    },
    findings: result.findings.map((f) => ({
      ruleId: f.ruleId,
      category: f.category,
      severity: f.severity,
      title: f.title,
      whyItMatters: f.whyItMatters,
      agentAction: f.agentAction,
      recommendation: f.recommendation,
      evidence: f.evidence,
      file: f.file,
      line: f.line,
      locations:
        f.locations && f.locations.length > 0
          ? f.locations
          : f.file ? [{ file: f.file, line: f.line }] : [],
      fingerprint: f.fingerprint,
    })),
    nextAction,
  };

  if (result.suppressed && result.suppressed.length > 0) {
    output.suppressed = result.suppressed;
  }

  if (result.escalationMessage) {
    output.escalationMessage = result.escalationMessage;
  }

  if (result.fixedCount !== undefined && result.fixedCount > 0) {
    output.fixedCount = result.fixedCount;
  }

  return output;
}
