import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import {
  checkLoopProgress,
  readLoopState,
  resetLoopState,
} from "../../src/core/loop/state.js";

describe("Loop Control & Termination", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-loop-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("should track iteration count sequentially", async () => {
    const res1 = await checkLoopProgress(tempDir, ["fp1", "fp2"], {
      maxIterations: 5,
    });
    expect(res1.iteration).toBe(1);
    expect(res1.shouldEscalate).toBe(false);

    // Run 2 with progress (different fingerprints)
    const res2 = await checkLoopProgress(tempDir, ["fp1"], {
      maxIterations: 5,
    });
    expect(res2.iteration).toBe(2);
    expect(res2.shouldEscalate).toBe(false);

    const state = await readLoopState(tempDir);
    expect(state.currentIteration).toBe(2);
    expect(state.history.length).toBe(2);
  });

  it("should escalate when consecutive runs produce identical findings (no progress)", async () => {
    // Run 1
    await checkLoopProgress(tempDir, ["fp-stuck-1", "fp-stuck-2"], {
      maxIterations: 5,
    });

    // Run 2: Exact same fingerprints
    const res2 = await checkLoopProgress(
      tempDir,
      ["fp-stuck-1", "fp-stuck-2"],
      {
        maxIterations: 5,
      },
    );

    expect(res2.shouldEscalate).toBe(true);
    expect(res2.escalationReason).toContain("no progress");
    expect(res2.escalationReason).toContain("Stop automated retries");
  });

  it("should escalate when the maximum iteration budget is exhausted", async () => {
    // Max iterations set to 3
    const maxIterations = 3;

    // Run 1
    const r1 = await checkLoopProgress(tempDir, ["fp-a"], { maxIterations });
    expect(r1.shouldEscalate).toBe(false);

    // Run 2 (different)
    const r2 = await checkLoopProgress(tempDir, ["fp-b"], { maxIterations });
    expect(r2.shouldEscalate).toBe(false);

    // Run 3 (different)
    const r3 = await checkLoopProgress(tempDir, ["fp-c"], { maxIterations });
    expect(r3.shouldEscalate).toBe(false);

    // Run 4: Budget exhausted!
    const r4 = await checkLoopProgress(tempDir, ["fp-d"], { maxIterations });
    expect(r4.shouldEscalate).toBe(true);
    expect(r4.escalationReason).toContain("budget of 3 runs exhausted");
  });

  it("should reset state cleanly", async () => {
    await checkLoopProgress(tempDir, ["fp1"]);
    await resetLoopState(tempDir);

    const state = await readLoopState(tempDir);
    expect(state.currentIteration).toBe(0);
    expect(state.history.length).toBe(0);
  });
});
