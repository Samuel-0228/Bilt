import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { executeFix } from "../../src/commands/fix.js";
import { executeUndo } from "../../src/commands/undo.js";
import { createLeakyFixtureProject } from "../fixtures/helper.js";

describe("Fix and Undo Integration Tests", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "bilt-fix-undo-integration-"),
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should preview fixes with dry-run without modifying files", async () => {
    await createLeakyFixtureProject(tmpDir);

    const envPath = path.join(tmpDir, ".env");
    const originalEnv = await fs.readFile(envPath, "utf-8");

    // Run fix with dry-run
    await executeFix(tmpDir, { safe: true, dryRun: true, quiet: true });

    // Verify .env and .gitignore were not modified
    const currentEnv = await fs.readFile(envPath, "utf-8");
    expect(currentEnv).toBe(originalEnv);

    const gitignoreExists = await fs
      .stat(path.join(tmpDir, ".gitignore"))
      .then(() => true)
      .catch(() => false);
    expect(gitignoreExists).toBe(false);
  });

  it("should apply safe fixes and revert them with undo", async () => {
    await createLeakyFixtureProject(tmpDir);

    // Pre-create .gitignore with some content
    const gitignorePath = path.join(tmpDir, ".gitignore");
    await fs.writeFile(gitignorePath, "node_modules\n", "utf-8");

    // Apply safe fixes
    await executeFix(tmpDir, { safe: true, quiet: true });

    // Verify .gitignore was modified
    const gitignoreContentAfterFix = await fs.readFile(gitignorePath, "utf-8");
    expect(gitignoreContentAfterFix).toContain("node_modules");
    expect(gitignoreContentAfterFix).toContain(".env");

    // Run undo command
    await executeUndo(tmpDir);

    // Verify .gitignore is reverted back to its original content
    const gitignoreContentAfterUndo = await fs.readFile(gitignorePath, "utf-8");
    expect(gitignoreContentAfterUndo.trim()).toBe("node_modules");
  });
});
