import type { Finding } from "../../finding/types.js";
import type {
  AgentOutput,
  AgentStatus,
  AgentSummary,
  SuppressedFinding,
  TamperFinding,
} from "../types.js";

export interface FormatAgentOptions {
  toolVersion: string;
  findings: Finding[];
  suppressed?: SuppressedFinding[];
  tamper?: TamperFinding[];
  iteration?: number;
  introducedOnly?: boolean;
  statusOverride?: AgentStatus;
  escalationMessage?: string;
}

/**
 * Determine the overall status following non-negotiable rules:
 * - Tamper violations -> "fail"
 * - Stable, high-precision introduced violations -> "fail"
 * - Needs human review / experimental / medium precision -> "needs_review"
 * - No introduced violations -> "pass"
 */
export function determineAgentStatus(
  introducedFindings: Finding[],
  tamper: TamperFinding[],
  statusOverride?: AgentStatus,
): AgentStatus {
  if (statusOverride) {
    return statusOverride;
  }

  if (tamper.length > 0) {
    return "fail";
  }

  const hardFailFindings = introducedFindings.filter(
    (f) =>
      f.severity === "critical" &&
      f.precision === "high" &&
      f.maturity === "stable",
  );

  if (hardFailFindings.length > 0) {
    return "fail";
  }

  if (introducedFindings.length > 0) {
    return "needs_review";
  }

  return "pass";
}

export function formatAgentOutput(options: FormatAgentOptions): AgentOutput {
  const {
    toolVersion,
    findings,
    suppressed = [],
    tamper = [],
    iteration = 1,
    introducedOnly = true,
    statusOverride,
    escalationMessage,
  } = options;

  // Filter introduced findings: if introduced_by_change is undefined, treat as true
  const introducedFindings = findings.filter(
    (f) => f.introduced_by_change !== false,
  );

  const status = determineAgentStatus(
    introducedFindings,
    tamper,
    statusOverride,
  );

  // In agent mode, default to listing only findings introduced by change
  const displayedFindings = introducedOnly ? introducedFindings : findings;

  const summary: AgentSummary = {
    total_findings: findings.length,
    introduced_findings: introducedFindings.length,
    critical: introducedFindings.filter((f) => f.severity === "critical")
      .length,
    warning: introducedFindings.filter((f) => f.severity === "warning").length,
    info: introducedFindings.filter((f) => f.severity === "info").length,
    suppressed: suppressed.length,
    tamper: tamper.length,
  };

  const output: AgentOutput = {
    schema_version: "1.0.0",
    tool_version: toolVersion,
    status,
    iteration,
    summary,
    findings: displayedFindings,
    suppressed,
    tamper,
  };

  if (escalationMessage) {
    output.escalation_message = escalationMessage;
  }

  return output;
}
