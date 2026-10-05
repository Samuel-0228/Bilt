// ─── Bilt Agent Protocol — Canonical Builder ─────────────────────────────────
// Single source of truth for the machine-readable JSON contract that AI agents
// consume. Every `--format agent` response passes through here.
//
// Schema version "1" — stable. Increment only for breaking changes.
// ─────────────────────────────────────────────────────────────────────────────

import type { CheckResult } from '../readiness/check-runner.js';
import type { BiltCheckFinding, FindingLocation, AgentActionContract } from '../readiness/finding.js';
import { normalizeAgentAction } from '../readiness/finding.js';
import { DISCLAIMER } from '../readiness/disclaimer.js';

// ── Public types ──────────────────────────────────────────────────────────────

export type AgentStatus = 'pass' | 'fail' | 'needs-review' | 'escalate' | 'error';

export type NextActionType =
  | 'fix'        // Agent MUST apply fixes for listed findings
  | 'review'     // Agent MUST present findings to human for decision
  | 'verify'     // Agent MUST re-run bilt check after previous fixes
  | 'rerun'      // Agent MUST re-run bilt check (something changed externally)
  | 'escalate'   // Agent MUST stop and ask human maintainer — Bilt detected a loop
  | 'none';      // All clear — agent may commit / open PR

export type EscalationReason =
  | 'no-progress'        // N consecutive runs, same fingerprints — agent is stuck
  | 'oscillation'        // A→B→A→B thrashing detected
  | 'budget-exhausted'   // Iteration budget exceeded
  | 'tamper-detected'    // Bilt config was modified to suppress rules
  | 'unknown';

export interface AgentNextAction {
  type: NextActionType;
  /** IDs of findings the agent must act on. Empty for type "none" or "verify". */
  findingIds: string[];
  /** Human-readable instruction reinforcing what the agent must do. */
  instruction: string;
}

export interface AgentExecutionMeta {
  /** Full CLI command string that produced this output. */
  command: string;
  /** Absolute path of the scanned project root. */
  projectRoot: string;
  /** Wall-clock time for the scan in milliseconds. */
  durationMs: number;
}

export interface AgentProgress {
  /** Number of open findings in the previous run (from loop state). */
  previous: number;
  /** Number of open findings in this run. */
  current: number;
  /** Findings resolved since the last run (fingerprints). */
  resolved: string[];
  /** New findings introduced since the last run (fingerprints). */
  introduced: string[];
  /** Findings that were resolved then re-appeared (fingerprints). */
  regressed: string[];
  /** Net change: negative means improvement, positive means regression. */
  net: number;
}

export interface AgentSummary {
  total: number;
  blocking: number;
  high: number;
  medium: number;
  low: number;
  needsReview: number;
}

export interface AgentEscalation {
  reason: EscalationReason;
  detail: string;
}

/**
 * The canonical Bilt Agent Response (schema version "1").
 *
 * EVERY `--format agent` command returns this structure.
 * Agents MUST:
 *   1. Read `status` — it is the authoritative gate signal.
 *   2. Read `nextAction.type` — it is the authoritative instruction.
 *   3. Act on `nextAction.findingIds` — these are the findings requiring action.
 *   4. NEVER self-assess resolution. Re-run `verificationCommand` in each finding.
 */
export interface AgentResponse {
  /** Schema version. Increment only for breaking changes. */
  schemaVersion: '1';
  /** Installed version of bilt-toolkit. */
  toolVersion: string;
  /**
   * Authoritative gate status.
   * - "pass"         → All clear. Zero introduced violations. Commit / PR OK.
   * - "fail"         → Hard failure. MUST fix before proceeding.
   * - "needs-review" → Heuristic finding. Non-blocking but requires human review.
   * - "escalate"     → Loop detected. HALT. Explain to human maintainer.
   * - "error"        → Bilt internal error. Review `escalation.detail`.
   */
  status: AgentStatus;
  summary: AgentSummary;
  findings: BiltCheckFinding[];
  /**
   * Deterministic next action for the agent.
   * Agents MUST NOT decide what to do next independently of this field.
   */
  nextAction: AgentNextAction;
  /** Metadata about this scan execution. */
  execution: AgentExecutionMeta;
  /** Progress delta since last run (if loop state is available). */
  progress?: AgentProgress;
  /** Only present when status === "escalate". */
  escalation?: AgentEscalation;
  disclaimer: string;
}

// ── Builder ───────────────────────────────────────────────────────────────────

export interface BuildAgentResponseOptions {
  result: CheckResult;
  toolVersion: string;
  command: string;
  projectRoot: string;
  /** Fingerprints from the previous run — used to compute progress delta. */
  previousFingerprints?: string[];
  /** If provided, loop escalation is baked into the response. */
  escalation?: { reason: EscalationReason; detail: string };
}

export function buildAgentResponse(opts: BuildAgentResponseOptions): AgentResponse {
  const { result, toolVersion, command, projectRoot, previousFingerprints, escalation } = opts;

  // ── Normalize findings ────────────────────────────────────────────────────────
  // Ensure every finding in the response has a structured agentAction object and
  // a locations[] array, regardless of how the checker constructed the finding.
  const findings = result.findings.map(normalizeFinding);
  const blockingFindings = result.gate.blockingFindings.map(normalizeFinding);
  const reviewFindings = result.gate.reviewFindings.map(normalizeFinding);

  // ── Summary ──────────────────────────────────────────────────────────────────
  const summary: AgentSummary = {
    total: findings.length,
    blocking: blockingFindings.length,
    high: result.gate.summary.high,
    medium: result.gate.summary.medium,
    low: result.gate.summary.low,
    needsReview: result.gate.summary.needsReview,
  };

  // ── Status ───────────────────────────────────────────────────────────────────
  let status: AgentStatus;
  if (escalation) {
    status = 'escalate';
  } else if (result.gate.status === 'production-ready') {
    status = 'pass';
  } else if (result.gate.status === 'not-ready') {
    status = 'fail';
  } else {
    status = 'needs-review';
  }

  // ── nextAction ────────────────────────────────────────────────────────────────
  const nextAction = computeNextAction(status, blockingFindings, reviewFindings, escalation);

  // ── Progress ──────────────────────────────────────────────────────────────────
  let progress: AgentProgress | undefined;
  if (previousFingerprints !== undefined) {
    const currentFps = findings.map((f) => f.fingerprint);
    const prevSet = new Set(previousFingerprints);
    const currSet = new Set(currentFps);

    const resolved = previousFingerprints.filter((fp) => !currSet.has(fp));
    const introduced = currentFps.filter((fp) => !prevSet.has(fp));
    // Regressed = was resolved in prev→curr transition but re-appeared (not applicable
    // in a two-snapshot diff; kept for symmetry with the full Change Ledger)
    const regressed: string[] = [];

    progress = {
      previous: previousFingerprints.length,
      current: currentFps.length,
      resolved,
      introduced,
      regressed,
      net: currentFps.length - previousFingerprints.length,
    };
  }

  // ── Execution meta ────────────────────────────────────────────────────────────
  const execution: AgentExecutionMeta = {
    command,
    projectRoot,
    durationMs: result.duration,
  };

  const response: AgentResponse = {
    schemaVersion: '1',
    toolVersion,
    status,
    summary,
    findings,
    nextAction,
    execution,
    disclaimer: DISCLAIMER,
  };

  if (progress) response.progress = progress;
  if (escalation) {
    response.escalation = escalation;
  }

  return response;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeNextAction(
  status: AgentStatus,
  blockingFindings: BiltCheckFinding[],
  reviewFindings: BiltCheckFinding[],
  escalation?: { reason: EscalationReason; detail: string },
): AgentNextAction {
  if (status === 'escalate' || escalation) {
    return {
      type: 'escalate',
      findingIds: [],
      instruction:
        'HALT automated retries. A loop or tamper condition was detected. ' +
        'Stop and explain the situation to the human maintainer immediately.',
    };
  }

  if (status === 'pass') {
    return {
      type: 'none',
      findingIds: [],
      instruction:
        'All checks pass. Zero introduced violations. You may commit or open a pull request.',
    };
  }

  if (blockingFindings.length > 0) {
    const fixable = blockingFindings.filter((f) => f.fixable);
    const manual = blockingFindings.filter((f) => !f.fixable);

    if (fixable.length > 0) {
      return {
        type: 'fix',
        findingIds: blockingFindings.map((f) => f.id ?? f.fingerprint),
        instruction:
          `${fixable.length} finding(s) are auto-fixable. Run "npx bilt fix --safe" then ` +
          `"npx bilt design-check --fix", then re-run "npx bilt check --format agent" to verify. ` +
          (manual.length > 0
            ? `${manual.length} finding(s) require manual remediation — inspect agentAction.objective on each.`
            : ''),
      };
    }

    return {
      type: 'fix',
      findingIds: blockingFindings.map((f) => f.id ?? f.fingerprint),
      instruction:
        `${blockingFindings.length} blocking finding(s) require manual remediation. ` +
        'Follow agentAction.objective for each finding. After changes, run "npx bilt check --format agent" to verify.',
    };
  }

  if (reviewFindings.length > 0) {
    return {
      type: 'review',
      findingIds: reviewFindings.map((f) => f.id ?? f.fingerprint),
      instruction:
        `${reviewFindings.length} finding(s) require human review. ` +
        'Present findings to the developer. Do NOT auto-fix or suppress without explicit approval.',
    };
  }

  // Should not normally reach here, but if status is not-ready with no findings:
  return {
    type: 'verify',
    findingIds: [],
    instruction: 'Re-run "npx bilt check --format agent" to get an updated status.',
  };
}

// ── Finding normalization ─────────────────────────────────────────────────────

/**
 * Ensure a BiltCheckFinding has:
 * - A structured AgentActionContract (not a plain string)
 * - A populated `locations[]` array (reconstructed from legacy flat fields if needed)
 * - A populated `id` field (fallback to fingerprint prefix)
 * - A populated `lifecycleStatus` field (defaults to 'open')
 *
 * This runs at output time so checkers don't need to be rewritten immediately.
 */
function normalizeFinding(f: BiltCheckFinding): BiltCheckFinding & {
  agentAction: AgentActionContract;
  locations: FindingLocation[];
  id: string;
  lifecycleStatus: import('../readiness/finding.js').FindingLifecycleStatus;
} {
  const agentAction = normalizeAgentAction(f.agentAction, f.file);

  let locations: FindingLocation[] = f.locations ?? [];
  if (locations.length === 0 && f.file) {
    locations = [
      {
        file: f.file,
        startLine: f.line,
        endLine: f.endLine ?? f.line,
      },
    ];
  }

  return {
    ...f,
    id: f.id ?? f.fingerprint.slice(0, 8),
    lifecycleStatus: f.lifecycleStatus ?? 'open',
    agentAction,
    locations,
  };
}
