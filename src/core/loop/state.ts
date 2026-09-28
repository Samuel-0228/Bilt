import path from "node:path";
import { promises as fs } from "node:fs";

export interface IterationRecord {
  iteration: number;
  timestamp: string;
  fingerprints: string[];
}

export interface LoopState {
  currentIteration: number;
  taskId?: string;
  history: IterationRecord[];
}

export interface LoopCheckOptions {
  maxIterations?: number;
  noProgressThreshold?: number;
  taskId?: string;
}

export interface LoopCheckResult {
  iteration: number;
  shouldEscalate: boolean;
  escalationReason?: string;
}

export function getAgentStatePath(rootDir: string): string {
  return path.join(rootDir, ".bilt", ".agent-state.json");
}

export function getLoopStatePath(rootDir: string): string {
  return path.join(rootDir, ".bilt", "loop-state.json");
}

export async function readLoopState(rootDir: string): Promise<LoopState> {
  const agentPath = getAgentStatePath(rootDir);
  const loopPath = getLoopStatePath(rootDir);

  try {
    const raw = await fs.readFile(agentPath, "utf-8");
    return JSON.parse(raw) as LoopState;
  } catch {
    try {
      const raw = await fs.readFile(loopPath, "utf-8");
      return JSON.parse(raw) as LoopState;
    } catch {
      return {
        currentIteration: 0,
        history: [],
      };
    }
  }
}

export async function writeLoopState(
  rootDir: string,
  state: LoopState,
): Promise<void> {
  const biltDir = path.join(rootDir, ".bilt");
  await fs.mkdir(biltDir, { recursive: true });
  const payload = JSON.stringify(state, null, 2);
  await Promise.all([
    fs.writeFile(getAgentStatePath(rootDir), payload, "utf-8"),
    fs.writeFile(getLoopStatePath(rootDir), payload, "utf-8"),
  ]);
}

export async function resetLoopState(rootDir: string): Promise<void> {
  await Promise.allSettled([
    fs.unlink(getAgentStatePath(rootDir)),
    fs.unlink(getLoopStatePath(rootDir)),
  ]);
}

function areFingerprintSetsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((fp, idx) => fp === b[idx]);
}

/**
 * Check iteration count, consecutive identical findings, and oscillation thrashing.
 * Returns escalation signal if:
 * 1. N >= 3 consecutive iterations produce the exact same non-empty fingerprint set (no progress)
 * 2. Thrashing oscillation detected alternating between conflicting states (A -> B -> A -> B)
 * 3. Iteration count >= maxIterations (budget exhaustion)
 */
export async function checkLoopProgress(
  rootDir: string,
  currentFingerprints: string[],
  options: LoopCheckOptions = {},
): Promise<LoopCheckResult> {
  const maxIterations = options.maxIterations ?? 5;
  const noProgressThreshold = options.noProgressThreshold ?? 3;
  const state = await readLoopState(rootDir);

  const nextIteration = state.currentIteration + 1;
  const sortedCurrent = Array.from(new Set(currentFingerprints)).sort();

  let shouldEscalate = false;
  let escalationReason: string | undefined;

  // Check 1: N >= 3 consecutive iterations with identical findings (no progress)
  if (state.history.length >= noProgressThreshold - 1 && sortedCurrent.length > 0) {
    const priorRuns = state.history.slice(-(noProgressThreshold - 1));
    const allIdentical = priorRuns.every((record) => {
      const priorSorted = Array.from(new Set(record.fingerprints)).sort();
      return areFingerprintSetsEqual(sortedCurrent, priorSorted);
    });

    if (allIdentical) {
      shouldEscalate = true;
      escalationReason = `Loop escalated: no progress across ${noProgressThreshold} consecutive iterations with identical findings. Stop automated retries and ask the human maintainer for guidance.`;
    }
  }

  // Check 2: Oscillation thrashing detection (A -> B -> A -> B)
  if (!shouldEscalate && state.history.length >= 3) {
    const sigCurrent = sortedCurrent.join("|");
    const sigLast1 = Array.from(new Set(state.history[state.history.length - 1]!.fingerprints)).sort().join("|");
    const sigLast2 = Array.from(new Set(state.history[state.history.length - 2]!.fingerprints)).sort().join("|");
    const sigLast3 = Array.from(new Set(state.history[state.history.length - 3]!.fingerprints)).sort().join("|");

    if (
      sigCurrent === sigLast2 &&
      sigLast1 === sigLast3 &&
      sigCurrent !== sigLast1 &&
      (sigCurrent.length > 0 || sigLast1.length > 0)
    ) {
      shouldEscalate = true;
      escalationReason =
        "Loop escalated: agent oscillation detected alternating between conflicting states (A -> B -> A -> B). Stop automated retries and ask the human maintainer for guidance.";
    }
  }

  // Check 3: Iteration budget exhaustion
  if (!shouldEscalate && nextIteration > maxIterations) {
    shouldEscalate = true;
    escalationReason = `Loop escalated: iteration budget of ${maxIterations} runs exhausted. Stop automated retries and ask the human maintainer for guidance.`;
  }

  // Record this run
  state.currentIteration = nextIteration;
  if (options.taskId) {
    state.taskId = options.taskId;
  }
  state.history.push({
    iteration: nextIteration,
    timestamp: new Date().toISOString(),
    fingerprints: sortedCurrent,
  });

  await writeLoopState(rootDir, state);

  return {
    iteration: nextIteration,
    shouldEscalate,
    escalationReason,
  };
}
