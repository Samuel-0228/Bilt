// ─── Agent JSON Formatter for Production Readiness ───────────────────────────
// Machine-readable, strictly versioned JSON output for AI coding agents.
// Schema version is an integer (1) per Section 9B.
// ─────────────────────────────────────────────────────────────────────────────

import type { CheckResult } from "../check-runner.js";
import type { BiltCheckFinding } from "../finding.js";
import type { ReadinessCategory, CategoryStatus } from "../taxonomy.js";
import { DISCLAIMER } from "../disclaimer.js";

export interface AgentCheckOutput {
  schemaVersion: number;
  toolVersion: string;
  status: "production-ready" | "not-ready" | "not-ready-needs-review";
  summary: {
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    needsReview: number;
    acceptedRisk: number;
  };
  gate: {
    status: "production-ready" | "not-ready" | "not-ready-needs-review";
    mandatoryCategoriesMet: boolean;
  };
  categoryStatus: Record<ReadinessCategory, CategoryStatus>;
  findings: BiltCheckFinding[];
  routeMapCount: number;
  disclaimer: string;
}

export function formatAgentCheckOutput(
  result: CheckResult,
  toolVersion: string,
): AgentCheckOutput {
  return {
    schemaVersion: 1, // Integer per Section 9B
    toolVersion,
    status: result.gate.status,
    summary: result.gate.summary,
    gate: {
      status: result.gate.status,
      mandatoryCategoriesMet: result.gate.mandatoryCategoriesMet,
    },
    categoryStatus: result.gate.categorySummary,
    findings: result.findings,
    routeMapCount: result.routeMap.length,
    disclaimer: DISCLAIMER,
  };
}
