import type { Finding } from "../finding/types.js";

export type AgentStatus =
  "pass" | "fail" | "needs_review" | "error" | "escalate";

export type OutputFormat = "text" | "json" | "agent" | "sarif";

export interface AgentSummary {
  total_findings: number;
  introduced_findings: number;
  critical: number;
  warning: number;
  info: number;
  suppressed: number;
  tamper: number;
}

export interface SuppressedFinding {
  rule_id: string;
  fingerprint: string;
  reason: string;
  file: string;
  line?: number;
  expires?: string;
}

export interface TamperFinding {
  rule_id: string;
  severity: "critical" | "warning";
  message: string;
  file: string;
  details?: string;
}

export interface AgentOutput {
  schema_version: "1.0.0";
  tool_version: string;
  status: AgentStatus;
  iteration: number;
  summary: AgentSummary;
  findings: Finding[];
  suppressed: SuppressedFinding[];
  tamper: TamperFinding[];
  escalation_message?: string;
}

export const EXIT_CODES = {
  PASS: 0,
  FAIL: 1,
  NEEDS_REVIEW: 2,
  ERROR: 3,
  ESCALATE: 4,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

export function statusToExitCode(status: AgentStatus): ExitCode {
  switch (status) {
    case "pass":
      return EXIT_CODES.PASS;
    case "fail":
      return EXIT_CODES.FAIL;
    case "needs_review":
      return EXIT_CODES.NEEDS_REVIEW;
    case "error":
      return EXIT_CODES.ERROR;
    case "escalate":
      return EXIT_CODES.ESCALATE;
  }
}
