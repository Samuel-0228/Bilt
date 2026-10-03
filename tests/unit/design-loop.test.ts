import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { runDesignCheck } from "../../src/core/design/engine.js";

const GENERIC_FIXTURE = path.resolve(
  __dirname,
  "../fixtures/design/generic-app",
);

describe("Design Check Agent Loop Escalation Protection", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bilt-loop-test-"));
    fs.cpSync(GENERIC_FIXTURE, tempDir, { recursive: true });
    // Remove any leftover .bilt dir in copied tempDir
    const biltDir = path.join(tempDir, ".bilt");
    if (fs.existsSync(biltDir)) {
      fs.rmSync(biltDir, { recursive: true, force: true });
    }
  });

  afterEach(async () => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("detects no progress across repeated iterations and triggers escalation", async () => {
    // Run 1: initial run
    const run1 = await runDesignCheck(tempDir, { maxIterations: 5 });
    expect(run1.status).toBe("needs-improvement");
    expect(run1.iteration).toBe(1);

    // Run 2: identical findings
    const run2 = await runDesignCheck(tempDir, { maxIterations: 5 });
    expect(run2.status).toBe("needs-improvement");
    expect(run2.iteration).toBe(2);

    // Run 3: 3rd consecutive run with identical findings -> triggers escalation!
    const run3 = await runDesignCheck(tempDir, { maxIterations: 5 });
    expect(run3.status).toBe("escalate");
    expect(run3.escalationMessage).toBeDefined();
    expect(run3.escalationMessage).toContain("STOP");
  });
});
