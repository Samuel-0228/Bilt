// ─── Bilt Agent Protocol — Canonical Builder ─────────────────────────────────
// Single source of truth for the machine-readable JSON contract that AI agents
// consume. Every `--format agent` response passes through here.
//
// Protocol Answers 3 Mandatory Questions for Coding Agents:
// 1. What is wrong?        → status, summary, findings (with objective, allowed/forbidden changes)
// 2. What should I do next?→ nextAction (type, findingIds, instruction)
// 3. Am I allowed to continue? → allowedToContinue (boolean gate)
//
// Schema version "1" — stable. Increment only for breaking changes.
// ─────────────────────────────────────────────────────────────────────────────

import path from 'node:path';
import fs from 'node:fs';
import type { CheckResult } from '../readiness/check-runner.js';
import type { BiltCheckFinding, FindingLocation, AgentActionContract, CheckSeverity } from '../readiness/finding.js';
import { normalizeAgentAction } from '../readiness/finding.js';
import type { ReadinessCategory } from '../readiness/taxonomy.js';
import type { AgentSession, SessionStatus } from './session.js';
import { DISCLAIMER } from '../readiness/disclaimer.js';

// ── Public types ──────────────────────────────────────────────────────────────

export type AgentStatus = 'pass' | 'fail' | 'needs-review' | 'escalate' | 'error';

export type NextActionType =
  | 'fix'        // Agent MUST apply fixes for listed findings
  | 'review'     // Agent MUST present findings to human for decision
  | 'verify'     // Agent MUST re-run bilt check after previous fixes
  | 'rerun'      // Agent MUST re-run bilt check (something changed externally)
  | 'stop'       // Agent MUST STOP — project satisfies all checks
  | 'escalate'   // Agent MUST stop and ask human maintainer — loop or regression detected
  | 'none';      // Alias for stop — all clear

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
  /** Findings resolved since the last run (fingerprints or IDs). */
  resolved: string[];
  /** New findings introduced since the last run (fingerprints or IDs). */
  introduced: string[];
  /** Findings that were resolved then re-appeared (regressions). */
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

export interface AgentSessionInfo {
  id: string;
  iteration: number;
  status: SessionStatus;
  previousFindings: number;
  currentFindings: number;
  resolvedFindings: string[];
  introducedFindings: string[];
  regressions: string[];
  unchangedFindings: string[];
  escalationState: {
    escalated: boolean;
    reason?: EscalationReason;
    detail?: string;
  };
}

export interface AgentFinding extends BiltCheckFinding {
  id: string;
  ruleId: string;
  category: ReadinessCategory;
  severity: CheckSeverity;
  title: string;
  objective: string;
  filesToInspect: string[];
  allowedChanges: string[];
  forbiddenChanges: string[];
  verification: string;
  locations: FindingLocation[];
  agentAction: AgentActionContract;
}

/**
 * The canonical Bilt Agent Response (schema version "1").
 *
 * EVERY `--format agent` command returns this structure.
 * Agents MUST:
 *   1. Read `status` and `allowedToContinue` — authoritative gate signals.
 *   2. Read `nextAction.type` and `nextAction.instruction` — authoritative instructions.
 *   3. Act on `nextAction.findingIds` — these are the findings requiring action.
 *   4. Follow `objective`, `allowedChanges`, and `forbiddenChanges` on each finding.
 *   5. NEVER self-assess resolution. Re-run `verification` command in each finding.
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
  /**
   * Authoritative permission signal: Am I allowed to continue working or declare complete?
   * true  → All checks pass. Agent may proceed or declare complete.
   * false → Agent MUST NOT proceed without fixing or escalating.
   */
  allowedToContinue: boolean;
  summary: AgentSummary;
  findings: AgentFinding[];
  /**
   * Deterministic next action for the agent.
   * Agents MUST NOT decide what to do next independently of this field.
   */
  nextAction: AgentNextAction;
  /**
   * Active supervision session state tracking progression across iterations.
   */
  session?: AgentSessionInfo;
  /** Progress delta since last run. */
  progress?: AgentProgress;
  /** Only present when status === "escalate". */
  escalation?: AgentEscalation;
  /** Metadata about this scan execution. */
  execution: AgentExecutionMeta;
  disclaimer: string;
}

// ── Builder ───────────────────────────────────────────────────────────────────

export interface BuildAgentResponseOptions {
  result: CheckResult;
  toolVersion: string;
  command: string;
  projectRoot: string;
  /** Active session state if running under supervisor. */
  session?: AgentSession;
  /** Fingerprints from the previous run — used to compute progress delta. */
  previousFingerprints?: string[];
  /** If provided, loop escalation is baked into the response. */
  escalation?: { reason: EscalationReason; detail: string };
  /** Explicit override for whether design brief is configured. */
  hasDesignBrief?: boolean;
  /** Explicit list of regressed fingerprints. */
  regressedFingerprints?: string[];
}

export function buildAgentResponse(opts: BuildAgentResponseOptions): AgentResponse {
  const { result, toolVersion, command, projectRoot } = opts;
  const session = opts.session;
  let escalation = opts.escalation;

  if (!escalation && session?.escalationState?.escalated) {
    escalation = {
      reason: session.escalationState.reason || 'unknown',
      detail: session.escalationState.detail || 'Supervision loop escalation triggered.',
    };
  }

  // ── Normalize findings ────────────────────────────────────────────────────────
  const findings: AgentFinding[] = result.findings.map(normalizeFinding);
  const blockingFindings = result.gate.blockingFindings.map(normalizeFinding);
  const reviewFindings = result.gate.reviewFindings.map(normalizeFinding);

  // ── Design Brief Detection ────────────────────────────────────────────────────
  let hasDesignBrief = opts.hasDesignBrief;
  if (hasDesignBrief === undefined && projectRoot) {
    try {
      const briefPath = path.join(projectRoot, ".bilt", "design-brief.json");
      if (fs.existsSync(briefPath)) {
        const raw = fs.readFileSync(briefPath, "utf-8");
        const parsed = JSON.parse(raw);
        hasDesignBrief = Boolean(parsed && typeof parsed === "object");
      } else {
        hasDesignBrief = false;
      }
    } catch {
      hasDesignBrief = false;
    }
  }

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

  const allowedToContinue = status === 'pass';

  // ── Regressions ──────────────────────────────────────────────────────────────
  const regressedFps = opts.regressedFingerprints || session?.regressions || [];
  const regressedFindings = findings.filter((f) => regressedFps.includes(f.fingerprint));

  // ── nextAction ────────────────────────────────────────────────────────────────
  const nextAction = computeNextAction(
    status,
    blockingFindings,
    reviewFindings,
    escalation,
    hasDesignBrief ?? false,
    regressedFindings,
  );

  // ── Progress & Session ────────────────────────────────────────────────────────
  let progress: AgentProgress | undefined;
  const previousFpList = opts.previousFingerprints || session?.previousFingerprints;

  if (session) {
    progress = {
      previous: session.previousFingerprints ? session.previousFingerprints.length : 0,
      current: findings.length,
      resolved: session.resolvedFingerprints || [],
      introduced: session.introducedFingerprints || [],
      regressed: session.regressions || [],
      net: findings.length - (session.previousFingerprints ? session.previousFingerprints.length : 0),
    };
  } else if (previousFpList !== undefined) {
    const currentFps = findings.map((f) => f.fingerprint);
    const prevSet = new Set(previousFpList);
    const currSet = new Set(currentFps);

    const resolved = previousFpList.filter((fp) => !currSet.has(fp));
    const introduced = currentFps.filter((fp) => !prevSet.has(fp));
    const regressed = opts.regressedFingerprints || [];

    progress = {
      previous: previousFpList.length,
      current: currentFps.length,
      resolved,
      introduced,
      regressed,
      net: currentFps.length - previousFpList.length,
    };
  }

  let sessionInfo: AgentSessionInfo | undefined;
  if (session) {
    sessionInfo = {
      id: session.id,
      iteration: session.iteration,
      status: session.status,
      previousFindings: session.previousFingerprints ? session.previousFingerprints.length : 0,
      currentFindings: findings.length,
      resolvedFindings: session.resolvedFingerprints || [],
      introducedFindings: session.introducedFingerprints || [],
      regressions: session.regressions || [],
      unchangedFindings: session.unchangedFingerprints || [],
      escalationState: session.escalationState || {
        escalated: false,
      },
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
    allowedToContinue,
    summary,
    findings,
    nextAction,
    execution,
    disclaimer: DISCLAIMER,
  };

  if (sessionInfo) response.session = sessionInfo;
  if (progress) response.progress = progress;
  if (escalation) {
    response.escalation = escalation;
  }

  return response;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeNextAction(
  status: AgentStatus,
  blockingFindings: AgentFinding[],
  reviewFindings: AgentFinding[],
  escalation?: { reason: EscalationReason; detail: string },
  hasDesignBrief: boolean = false,
  regressedFindings: AgentFinding[] = [],
): AgentNextAction {
  if (status === 'escalate' || escalation) {
    return {
      type: 'escalate',
      findingIds: [],
      instruction:
        'HALT automated retries. A loop, regression impasse, or tamper condition was detected. ' +
        'Stop and explain the situation to the human maintainer immediately.',
    };
  }

  if (status === 'pass') {
    return {
      type: 'stop',
      findingIds: [],
      instruction:
        'STOP. All checks pass. Zero introduced violations. Allowed to continue. You may commit or finalize the task.',
    };
  }

  // If regression detected, prioritize alerting agent to fix regression
  if (regressedFindings.length > 0) {
    const regressedIds = regressedFindings.map((f) => f.id || f.fingerprint);
    return {
      type: 'fix',
      findingIds: regressedIds,
      instruction:
        `REGRESSION DETECTED: ${regressedFindings.length} finding(s) previously resolved have re-appeared (${regressedIds.slice(0, 3).join(', ')}). ` +
        `You MUST fix this regression before proceeding. Follow agentAction.objective and allowedChanges. Verification: run "npx bilt check --format agent".`,
    };
  }

  if (blockingFindings.length > 0) {
    const fixable = blockingFindings.filter((f) => f.fixable);
    const manual = blockingFindings.filter((f) => !f.fixable);

    if (fixable.length > 0) {
      return {
        type: 'fix',
        findingIds: blockingFindings.map((f) => f.id || f.fingerprint),
        instruction:
          `${fixable.length} finding(s) are auto-fixable. Run "npx bilt fix --safe" then ` +
          `"npx bilt design-check --fix", then re-run "npx bilt check --format agent" to verify. ` +
          (manual.length > 0
            ? `${manual.length} finding(s) require manual remediation — inspect objective on each.`
            : ''),
      };
    }

    return {
      type: 'fix',
      findingIds: blockingFindings.map((f) => f.id || f.fingerprint),
      instruction:
        `${blockingFindings.length} blocking finding(s) require manual remediation. ` +
        'Follow objective, allowedChanges, and forbiddenChanges for each finding. After changes, run "npx bilt check --format agent" to verify.',
    };
  }

  if (reviewFindings.length > 0) {
    const designFindings = reviewFindings.filter((f) => f.category === 'design-quality');
    const otherReviewFindings = reviewFindings.filter((f) => f.category !== 'design-quality');

    if (designFindings.length > 0) {
      const targetFiles = Array.from(
        new Set(
          designFindings.flatMap((f) =>
            f.locations && f.locations.length > 0
              ? f.locations.map((l) => l.file)
              : f.file ? [f.file] : [],
          ),
        ),
      );
      const filesStr = targetFiles.length > 0 ? ` in ${targetFiles.slice(0, 3).join(', ')}` : '';

      const designRefactorBody = !hasDesignBrief
        ? `First, run "npx bilt design-check --fix" to automatically repair mechanical issues (focus rings, gradient text, blur orbs, corner radii). ` +
          `Next: MANDATORY DESIGN INTENT CHECKPOINT — No design brief is configured (.bilt/design-brief.json). ` +
          `Before rewriting UI, you MUST PAUSE and ask the developer these 4 Design Intent questions in chat:\n` +
          `1. Purpose & Audience: What is the main purpose of this product, and who is it for?\n` +
          `2. Visual Direction: What visual direction do you prefer? (Minimal, Bold, Technical, Playful, Luxury, Brutalist, 'Surprise me', or Custom)\n` +
          `3. Brand Colors: Do you have specific brand colors or visual references? (Hex codes, color names, or 'Surprise me')\n` +
          `4. Desired Feeling: When someone opens this, what should they feel? (Trustworthy, calm, energetic, technical, or 'Surprise me')\n` +
          `After the developer answers, save their answers via "npx bilt design-brief set --purpose '...' --visual '...' --colors '...' --feeling '...'". ` +
          `Then inspect the flagged files and refactor generic AI templates into authentic, domain-specific UI with real data density. `
        : `First, run "npx bilt design-check --fix" to automatically repair mechanical issues (focus rings, gradient text, blur orbs, corner radii). ` +
          `Next, follow the configured design brief in .bilt/design-brief.json: inspect the flagged files and refactor generic AI templates (eliminate stacked cards, radial blur orbs, and fake indicators) into authentic, domain-specific UI with real data density. `;

      return {
        type: 'fix',
        findingIds: designFindings.map((f) => f.id || f.fingerprint),
        instruction:
          `MANDATORY DESIGN & UI REFACTOR: ${designFindings.length} design quality pattern(s) detected${filesStr}. ` +
          designRefactorBody +
          (otherReviewFindings.length > 0
            ? `${otherReviewFindings.length} guided architectural finding(s) require human review. `
            : '') +
          `Re-verify by running "npx bilt check --format agent".`,
      };
    }

    return {
      type: 'review',
      findingIds: reviewFindings.map((f) => f.id || f.fingerprint),
      instruction:
        `${reviewFindings.length} finding(s) require human review. ` +
        'Present findings to the developer. Do NOT auto-fix or suppress without explicit approval.',
    };
  }

  return {
    type: 'verify',
    findingIds: [],
    instruction: 'Re-run "npx bilt check --format agent" to get an updated status.',
  };
}

// ── Finding normalization ─────────────────────────────────────────────────────

/**
 * Ensure an AgentFinding has:
 * - Direct top-level objective, filesToInspect, allowedChanges, forbiddenChanges, verification
 * - A structured agentAction object
 * - A populated locations[] array
 * - A clean id string
 */
function normalizeFinding(f: BiltCheckFinding): AgentFinding {
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

  const filesToInspect =
    locations.length > 0
      ? [...new Set(locations.map((l) => l.file))]
      : f.file ? [f.file] : [];

  let agentAction: AgentActionContract;
  if (typeof f.agentAction === 'string') {
    agentAction = {
      objective: f.agentAction,
      allowedChanges: [
        (f as any).suggestion || 'Remediate the specific finding described in the objective',
        'Update configuration or code to use secure patterns',
      ],
      forbiddenChanges: [
        'Do not weaken security configuration',
        'Do not disable or remove Bilt rules or detectors',
        'Do not add suppressions without explicit approval and owner',
      ],
      filesToInspect,
      verificationCommand: 'npx bilt check --format agent',
    };
  } else {
    agentAction = {
      ...f.agentAction,
      filesToInspect:
        f.agentAction.filesToInspect && f.agentAction.filesToInspect.length > 0
          ? f.agentAction.filesToInspect
          : filesToInspect,
      verificationCommand: f.agentAction.verificationCommand || 'npx bilt check --format agent',
    };
  }

  const objective = f.objective || agentAction.objective;
  const allowedChanges = f.allowedChanges || agentAction.allowedChanges;
  const forbiddenChanges = f.forbiddenChanges || agentAction.forbiddenChanges;
  const verification = f.verification || agentAction.verificationCommand || 'npx bilt check --format agent';

  return {
    ...f,
    id: f.id || f.ruleId || f.fingerprint.slice(0, 8),
    lifecycleStatus: f.lifecycleStatus || 'open',
    agentAction,
    locations,
    objective,
    filesToInspect: agentAction.filesToInspect,
    allowedChanges,
    forbiddenChanges,
    verification,
  };
}
