// ─── Agent JSON Formatter for Production Readiness ───────────────────────────
// Machine-readable, strictly versioned JSON output for AI coding agents.
// Schema version is an integer (1) per Section 9B.
// ─────────────────────────────────────────────────────────────────────────────

import type { CheckResult } from "../check-runner.js";
import type { BiltCheckFinding } from "../finding.js";
import type { ReadinessCategory, CategoryStatus } from "../taxonomy.js";
import { DISCLAIMER } from "../disclaimer.js";

export interface AgentActionItem {
  action: string;
  command: string;
  reason: string;
}

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
  agentInstruction?: string;
  actionPlan?: AgentActionItem[];
}

export function formatAgentCheckOutput(
  result: CheckResult,
  toolVersion: string,
): AgentCheckOutput {
  const output: AgentCheckOutput = {
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

  if (result.gate.status !== "production-ready") {
    output.agentInstruction =
      "CRITICAL DIRECTIVE FOR AI AGENTS: Do NOT merely report findings to the user and terminate. As an autonomous coding agent, execute auto-fixes ('npx bilt design-check --fix' and 'npx bilt fix --safe'), baseline pre-existing debt if onboarding an existing repo ('npx bilt baseline create'), query the design brief ('npx bilt design-brief --format agent') before modifying UI, and re-verify with 'npx bilt check --format agent' until status is production-ready.";

    const plan: AgentActionItem[] = [];

    const fixableCount = result.findings.filter((f) => f.fixable).length;
    if (fixableCount > 0) {
      plan.push({
        action: "auto_fix",
        command: "npx bilt design-check --fix && npx bilt fix --safe",
        reason: `Automatically remediates ${fixableCount} fixable finding(s) including outline-none accessibility, missing aria labels, and env mismatches.`,
      });
    }

    plan.push({
      action: "baseline_legacy_debt",
      command: "npx bilt baseline create",
      reason:
        "If onboarding an existing codebase, snapshot legacy issues into .bilt/baseline.json so you focus only on changes introduced by current tasks.",
    });

    const hasDesign = result.findings.some(
      (f) =>
        (f.category as string) === "design-quality" ||
        f.ruleId.startsWith("DESIGN-") ||
        f.ruleId.startsWith("A11Y-") ||
        f.ruleId.startsWith("GENERIC-") ||
        f.ruleId.startsWith("VIBECODED-") ||
        f.title.toLowerCase().includes("design") ||
        f.title.toLowerCase().includes("accessibility"),
    );
    if (hasDesign) {
      plan.push({
        action: "design_intent",
        command: "npx bilt design-brief --format agent",
        reason:
          "Query design brief constraints. If not configured, pause and interview user with the 4 Human Design Intent questions before refactoring UI.",
      });
    }

    plan.push({
      action: "verify",
      command: "npx bilt check --format agent",
      reason:
        "Re-run verification after remediation to ensure gate status is production-ready.",
    });

    output.actionPlan = plan;
  }

  return output;
}
