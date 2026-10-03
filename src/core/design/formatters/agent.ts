// ─── Agent JSON Formatter for Design Check ──────────────────────────────────
// Returns strictly versioned stable JSON for coding agents per Section 7.
// ─────────────────────────────────────────────────────────────────────────────

import type { DesignCheckResult } from "../types.js";

export function formatAgentDesignOutput(result: DesignCheckResult): object {
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
      fingerprint: f.fingerprint,
    })),
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
