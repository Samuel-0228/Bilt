import crypto from 'node:crypto';
import type { Finding } from '../finding/types.js';
import type { ReadinessCategory, CheckMode } from './taxonomy.js';
export type { CheckMode };

export type CheckSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type CheckStatus = 'pass' | 'fail' | 'needs-review';

/** Lifecycle state for a specific finding instance across Bilt runs. */
export type FindingLifecycleStatus = 'open' | 'in-progress' | 'verifying' | 'resolved' | 'suppressed';

/** A specific location within the codebase where a finding was detected. */
export interface FindingLocation {
  file: string;
  startLine?: number;
  endLine?: number;
  /** Normalized structural context (e.g. function name, route, component name) */
  context?: string;
}

/**
 * Structured machine-actionable contract for an AI coding agent.
 * The agent MUST follow `objective`, MUST NOT perform `forbiddenChanges`,
 * and MUST verify resolution by running `verificationCommand`.
 */
export interface AgentActionContract {
  /** What the agent is trying to achieve. */
  objective: string;
  /** Specific changes the agent is allowed to make. */
  allowedChanges: string[];
  /** Changes the agent MUST NOT make (e.g. weakening security config). */
  forbiddenChanges: string[];
  /** Files the agent should inspect to understand scope. */
  filesToInspect: string[];
  /** Command the agent must run after making changes. Bilt re-detects; passing means resolved. */
  verificationCommand?: string;
}

/**
 * Normalize a legacy string agent_action into a structured AgentActionContract.
 * Exported so the protocol builder (and tests) can call it directly.
 */
export function normalizeAgentAction(
  raw: string | AgentActionContract,
  file?: string,
): AgentActionContract {
  if (typeof raw !== 'string') return raw; // already structured
  return {
    objective: raw,
    allowedChanges: ['Remediate the specific finding described above'],
    forbiddenChanges: [
      'Weakening security configuration',
      'Disabling or removing Bilt rules',
      'Adding suppressions without explicit reason and owner',
    ],
    filesToInspect: file ? [file] : [],
    verificationCommand: 'npx bilt check --format agent',
  };
}

export interface BiltCheckFinding {
  /**
   * Unique per-instance ID (content-normalized hash prefix).
   * Optional for backward compat — checkers don't need to set it.
   * The protocol builder fills it in at output time.
   */
  id?: string;
  ruleId: string;
  category: ReadinessCategory;
  mode: CheckMode;
  severity: CheckSeverity;
  precision: 'high' | 'medium' | 'low';
  maturity: 'stable' | 'experimental';
  /** Gate status for this finding. */
  status: CheckStatus;
  /**
   * Lifecycle tracking across agent sessions.
   * Defaults to 'open' for all newly created findings.
   */
  lifecycleStatus?: FindingLifecycleStatus;
  title: string;
  whyItMatters: string;
  technicalDetail: string;
  /**
   * Structured machine-actionable contract (preferred) or legacy string (backward compat).
   * Use `normalizeAgentAction(finding.agentAction, finding.file)` to always get an object.
   */
  agentAction: string | AgentActionContract;
  evidence?: unknown;
  evidenceRequired?: boolean;
  fixable: boolean;
  /**
   * Canonical list of locations. Replaces the flat file/line fields.
   * Checkers may omit this and populate the legacy fields instead;
   * the protocol builder reconstructs locations from legacy fields when missing.
   */
  locations?: FindingLocation[];
  /**
   * Content-normalized fingerprint: SHA256(ruleId + file + normalizedEvidence).
   * Does NOT include raw line numbers so it survives code movement/refactoring.
   */
  fingerprint: string;
  introduced_by_change?: boolean;

  // ── Legacy flat fields — checkers still populate these ──────────────────────
  file?: string;
  line?: number;
  endLine?: number;
}

// ── Fingerprint ───────────────────────────────────────────────────────────────

/**
 * Generate a content-normalized fingerprint.
 * Uses ruleId + file (path-normalized) + optional evidence snippet.
 * Deliberately ignores raw line numbers so the fingerprint survives
 * code movement — exactly as specified.
 */
export function generateCheckFingerprint(
  ruleId: string,
  file?: string,
  _line?: number,          // accepted for call-site compat, intentionally NOT hashed
  normalizedEvidence?: string,
  structuralContext?: string,
): string {
  const hash = crypto.createHash('sha256');
  hash.update(ruleId);
  if (file) {
    // Normalize path separators so fingerprints are OS-independent
    hash.update(file.replace(/\\/g, '/'));
  }
  if (normalizedEvidence) {
    hash.update(normalizedEvidence);
  }
  if (structuralContext) {
    hash.update(structuralContext);
  }
  return hash.digest('hex').slice(0, 16); // 16-char prefix — unique and readable in diffs
}

// ── Legacy Finding → BiltCheckFinding adapter ────────────────────────────────

export function findingToCheckFinding(finding: Finding, category: ReadinessCategory): BiltCheckFinding {
  let severity: CheckSeverity = 'info';
  if (finding.severity === 'critical') severity = 'critical';
  else if (finding.severity === 'warning') severity = 'medium';
  else if (finding.severity === 'info') severity = 'info';

  const mode: CheckMode = 'automated';

  const location: FindingLocation = {
    file: finding.file,
    startLine: finding.line,
    endLine: finding.end_line,
  };

  const fingerprint =
    finding.fingerprint ||
    generateCheckFingerprint(
      finding.rule_id,
      finding.file,
      finding.line,
      finding.untrusted_snippet,
    );

  const id = generateCheckFingerprint(
    finding.rule_id,
    finding.file,
    undefined,
    finding.untrusted_snippet,
  );

  return {
    id,
    ruleId: finding.rule_id,
    category,
    mode,
    severity,
    precision: finding.precision,
    maturity: finding.maturity,
    status: 'fail',
    lifecycleStatus: 'open',
    title: finding.title,
    whyItMatters: finding.explanation,
    technicalDetail: finding.explanation,
    agentAction: normalizeAgentAction(finding.agent_action, finding.file),
    fixable: finding.fixable,
    locations: [location],
    fingerprint,
    introduced_by_change: finding.introduced_by_change,
    // Legacy flat fields (kept for checker backward compat)
    file: finding.file,
    line: finding.line,
    endLine: finding.end_line,
  };
}
