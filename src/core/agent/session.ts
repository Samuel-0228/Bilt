// ─── Agent Session Identity & Supervision State Machine ───────────────────────
// Tracks the full agent lifecycle across CLI runs in the workspace:
// iteration, previous findings, current findings, resolved findings,
// introduced findings, regressions, unchanged findings, and escalation state.
// Persisted under `.bilt/state/session.json`.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { checkLoopProgress, resetLoopState } from "../loop/state.js";
import { recordChangeIteration } from "../loop/ledger.js";
import type { EscalationReason } from "./protocol.js";

export type SessionStatus = "active" | "passed" | "failed" | "escalated";

export interface AgentSession {
  id: string;
  startedAt: string;
  projectRoot: string;
  agent?: string;
  iteration: number;
  previousFingerprints: string[];
  currentFingerprints: string[];
  resolvedFingerprints: string[];
  introducedFingerprints: string[];
  unchangedFingerprints: string[];
  allHistoricalResolved: string[];
  regressions: string[];
  consecutiveNoProgressCount: number;
  status: SessionStatus;
  escalationState?: {
    escalated: boolean;
    reason?: EscalationReason;
    detail?: string;
  };
  lastChangedFiles?: string[];
  lastUpdated: string;
}

export interface SessionIterationOptions {
  changedFiles?: string[];
  maxIterations?: number;
  noProgressThreshold?: number;
  tamperDetected?: boolean;
  tamperDetail?: string;
  isCleanPass?: boolean;
  taskId?: string;
}

export interface SessionIterationResult {
  session: AgentSession;
  delta: {
    resolved: string[];
    introduced: string[];
    regressions: string[];
    unchanged: string[];
  };
  escalation?: {
    reason: EscalationReason;
    detail: string;
  };
}

export function getSessionStatePath(rootDir: string): string {
  return path.join(rootDir, ".bilt", "state", "session.json");
}

/**
 * Get or initialize an active agent session for the project root.
 * Respects `BILT_SESSION_ID` environment variable if set.
 */
export async function getOrStartSession(
  rootDir: string,
  agentName?: string,
): Promise<AgentSession> {
  const absoluteRoot = path.resolve(rootDir);
  const sessionPath = getSessionStatePath(absoluteRoot);

  const envSessionId = process.env.BILT_SESSION_ID;

  try {
    const raw = await fs.readFile(sessionPath, "utf-8");
    const session = JSON.parse(raw) as AgentSession;

    // If environment specifies session ID and it matches or if current session is active/failed, reuse
    if (!envSessionId || session.id === envSessionId) {
      if (session.status === "active" || session.status === "failed") {
        return session;
      }
    }
  } catch {
    // Session file missing or invalid
  }

  // Create new session
  const newSession: AgentSession = {
    id: envSessionId || crypto.randomBytes(8).toString("hex"),
    startedAt: new Date().toISOString(),
    projectRoot: absoluteRoot,
    agent: agentName || process.env.BILT_AGENT_NAME || "ai-agent",
    iteration: 0,
    previousFingerprints: [],
    currentFingerprints: [],
    resolvedFingerprints: [],
    introducedFingerprints: [],
    unchangedFingerprints: [],
    allHistoricalResolved: [],
    regressions: [],
    consecutiveNoProgressCount: 0,
    status: "active",
    lastUpdated: new Date().toISOString(),
  };

  await saveSession(absoluteRoot, newSession);
  return newSession;
}

/**
 * Save current agent session.
 */
export async function saveSession(
  rootDir: string,
  session: AgentSession,
): Promise<void> {
  const stateDir = path.join(rootDir, ".bilt", "state");
  await fs.mkdir(stateDir, { recursive: true });

  const payload: AgentSession = {
    ...session,
    lastUpdated: new Date().toISOString(),
  };

  await fs.writeFile(getSessionStatePath(rootDir), JSON.stringify(payload, null, 2), "utf-8");
}

/**
 * Reset agent session and loop state.
 */
export async function resetSession(rootDir: string): Promise<void> {
  const absoluteRoot = path.resolve(rootDir);
  const sessionPath = getSessionStatePath(absoluteRoot);
  await Promise.allSettled([
    fs.unlink(sessionPath),
    resetLoopState(absoluteRoot),
  ]);
}

function areFingerprintSetsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((item) => setA.has(item));
}

function detectEscalationReason(msg: string): EscalationReason {
  if (msg.includes("no progress")) return "no-progress";
  if (msg.includes("oscillation")) return "oscillation";
  if (msg.includes("budget")) return "budget-exhausted";
  if (msg.includes("tamper")) return "tamper-detected";
  return "unknown";
}

/**
 * Record an execution iteration within the active Agent Session.
 * Calculates exact progression delta (resolved, introduced, regressions, unchanged),
 * detects regressions of previously solved problems, and enforces loop boundaries.
 */
export async function recordSessionIteration(
  rootDir: string,
  currentFingerprints: string[],
  options: SessionIterationOptions = {},
): Promise<SessionIterationResult> {
  const absoluteRoot = path.resolve(rootDir);
  const session = await getOrStartSession(absoluteRoot);

  const beforeFingerprints =
    session.iteration === 0
      ? []
      : session.currentFingerprints && session.currentFingerprints.length > 0
        ? session.currentFingerprints
        : session.previousFingerprints || [];

  const currentSet = new Set(currentFingerprints);
  const beforeSet = new Set(beforeFingerprints);
  const historicalResolvedSet = new Set(session.allHistoricalResolved || []);

  const resolved = beforeFingerprints.filter((fp) => !currentSet.has(fp));
  const introduced = currentFingerprints.filter((fp) => !beforeSet.has(fp));
  const unchanged = currentFingerprints.filter((fp) => beforeSet.has(fp));

  // Regressions: finding re-appeared after being resolved in a prior iteration in this session
  const regressions = introduced.filter((fp) => historicalResolvedSet.has(fp));

  // Add all newly resolved findings to historical resolved set
  for (const fp of resolved) {
    historicalResolvedSet.add(fp);
  }
  session.allHistoricalResolved = Array.from(historicalResolvedSet);

  // Track progress vs stagnation
  if (beforeFingerprints.length > 0 && currentFingerprints.length > 0) {
    if (areFingerprintSetsEqual(beforeFingerprints, currentFingerprints)) {
      session.consecutiveNoProgressCount = (session.consecutiveNoProgressCount || 0) + 1;
    } else if (resolved.length > 0 && regressions.length === 0) {
      session.consecutiveNoProgressCount = 0;
    } else {
      // Changed but did not solve without introducing or regressing
      session.consecutiveNoProgressCount = (session.consecutiveNoProgressCount || 0) + 1;
    }
  } else {
    session.consecutiveNoProgressCount = 0;
  }

  // Check loop progress with the loop engine
  const loopCheck = await checkLoopProgress(absoluteRoot, currentFingerprints, {
    maxIterations: options.maxIterations,
    noProgressThreshold: options.noProgressThreshold,
    taskId: options.taskId,
  }).catch(() => null);

  let escalation: { reason: EscalationReason; detail: string } | undefined;

  if (options.tamperDetected) {
    escalation = {
      reason: "tamper-detected",
      detail:
        options.tamperDetail ||
        "Tamper detected: Security configuration or rules were modified to weaken checks.",
    };
  } else if (loopCheck?.shouldEscalate) {
    escalation = {
      reason: detectEscalationReason(loopCheck.escalationReason || ""),
      detail: loopCheck.escalationReason || "Supervision loop escalation triggered.",
    };
  } else if (
    session.consecutiveNoProgressCount >= (options.noProgressThreshold ?? 3) &&
    currentFingerprints.length > 0
  ) {
    escalation = {
      reason: "no-progress",
      detail: `Loop escalated: no progress across ${options.noProgressThreshold ?? 3} consecutive iterations with unchanged findings. Stop automated retries and ask the human maintainer for guidance.`,
    };
  }

  // Advance session
  session.iteration += 1;
  session.previousFingerprints = beforeFingerprints;
  session.currentFingerprints = currentFingerprints;
  session.resolvedFingerprints = resolved;
  session.introducedFingerprints = introduced;
  session.unchangedFingerprints = unchanged;
  session.regressions = regressions;
  if (options.changedFiles) {
    session.lastChangedFiles = options.changedFiles;
  }

  if (escalation) {
    session.status = "escalated";
    session.escalationState = {
      escalated: true,
      reason: escalation.reason,
      detail: escalation.detail,
    };
  } else if (options.isCleanPass || currentFingerprints.length === 0) {
    session.status = "passed";
    session.escalationState = undefined;
  } else {
    session.status = "failed";
    session.escalationState = undefined;
  }

  await saveSession(absoluteRoot, session);

  // Record in Change Ledger
  await recordChangeIteration(
    absoluteRoot,
    session.id,
    session.iteration,
    beforeFingerprints,
    currentFingerprints,
    options.changedFiles || [],
  ).catch(() => null);

  return {
    session,
    delta: {
      resolved,
      introduced,
      regressions,
      unchanged,
    },
    escalation,
  };
}

/**
 * Backward compatibility helper for legacy callers.
 */
export async function updateSessionState(
  rootDir: string,
  fingerprints: string[],
  status: SessionStatus = "active",
): Promise<AgentSession> {
  const session = await getOrStartSession(rootDir);
  session.iteration += 1;
  session.previousFingerprints = fingerprints;
  session.currentFingerprints = fingerprints;
  session.status = status;
  await saveSession(rootDir, session);
  return session;
}
