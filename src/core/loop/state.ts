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
  taskId?: string;
}

export interface LoopCheckResult {
  iteration: number;
  shouldEscalate: boolean;
  escalationReason?: string;
}

export function getLoopStatePath(rootDir: string): string {
  return path.join(rootDir, ".bilt", "loop-state.json");
}

export async function readLoopState(rootDir: string): Promise<LoopState> {
  const filePath = getLoopStatePath(rootDir);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as LoopState;
  } catch {
    return {
      currentIteration: 0,
      history: [],
    };
  }
}

export async function writeLoopState(
  rootDir: string,
  state: LoopState,
): Promise<void> {
  const biltDir = path.join(rootDir, ".bilt");
  await fs.mkdir(biltDir, { recursive: true });
  const filePath = getLoopStatePath(rootDir);
  await fs.writeFile(filePath, JSON.stringify(state, null, 2), "utf-8");
}

export async function resetLoopState(rootDir: string): Promise<void> {
  try {
    await fs.unlink(getLoopStatePath(rootDir));
  } catch {
    // Ignore if not exists
  }
}

/**
 * Check iteration count and fingerprint delta against previous runs.
 * Returns escalation signal if:
 * 1. Consecutive runs yielded the exact same non-empty fingerprint set (no progress)
 * 2. Iteration count >= maxIterations (budget exhaustion)
 */
export async function checkLoopProgress(
  rootDir: string,
  currentFingerprints: string[],
  options: LoopCheckOptions = {},
): Promise<LoopCheckResult> {
  const maxIterations = options.maxIterations ?? 5;
  const state = await readLoopState(rootDir);

  const nextIteration = state.currentIteration + 1;
  const sortedCurrent = Array.from(new Set(currentFingerprints)).sort();

  let shouldEscalate = false;
  let escalationReason: string | undefined;

  // Check 1: No progress on consecutive iterations
  if (state.history.length > 0 && sortedCurrent.length > 0) {
    const lastRecord = state.history[state.history.length - 1]!;
    const lastSorted = Array.from(new Set(lastRecord.fingerprints)).sort();

    const areEqual =
      sortedCurrent.length === lastSorted.length &&
      sortedCurrent.every((fp, idx) => fp === lastSorted[idx]);

    if (areEqual) {
      shouldEscalate = true;
      escalationReason =
        "Loop escalated: consecutive runs produced an identical set of findings with no progress. Stop automated retries and ask the human maintainer for guidance.";
    }
  }

  // Check 2: Iteration budget exhaustion
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
