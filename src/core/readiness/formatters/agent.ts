// ─── Agent JSON Formatter for Production Readiness ───────────────────────────
// Thin adapter: converts a CheckResult into the canonical AgentResponse.
// All logic lives in src/core/agent/protocol.ts (the canonical builder).
// ─────────────────────────────────────────────────────────────────────────────

import type { CheckResult } from "../check-runner.js";
import type { AgentResponse } from "../../agent/protocol.js";
import { buildAgentResponse } from "../../agent/protocol.js";

export type { AgentResponse };

// Re-export legacy interfaces so external consumers don't break
export interface AgentActionItem {
  action: string;
  command: string;
  reason: string;
}

/** @deprecated Use AgentResponse from src/core/agent/protocol.ts */
export type AgentCheckOutput = AgentResponse;

/**
 * Format a CheckResult as the canonical Agent JSON response.
 *
 * @param result       - Output from runChecks()
 * @param toolVersion  - Installed bilt-toolkit version
 * @param command      - Full CLI command string (e.g. "bilt check --format agent")
 * @param projectRoot  - Absolute project root path
 * @param previousFingerprints - Fingerprints from previous run for progress diff
 */
export function formatAgentCheckOutput(
  result: CheckResult,
  toolVersion: string,
  command = "bilt check --format agent",
  projectRoot = process.cwd(),
  previousFingerprints?: string[],
): AgentResponse {
  return buildAgentResponse({
    result,
    toolVersion,
    command,
    projectRoot,
    previousFingerprints,
  });
}
