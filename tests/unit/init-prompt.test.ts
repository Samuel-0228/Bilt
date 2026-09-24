import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { executePrompt } from "../../src/commands/prompt.js";
import { executeInitAgent } from "../../src/commands/init-agent.js";

describe("Agent Init & Prompt Integration", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-agent-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("executePrompt", () => {
    it("returns default guidelines when no agent is specified", async () => {
      const output = await executePrompt();
      expect(output).toContain("Bilt Agent Security Guidelines");
      expect(output).toContain("bilt scan --format agent --changed");
    });

    it("returns claude guidelines when agent is claude", async () => {
      const output = await executePrompt({ agent: "claude" });
      expect(output).toContain("Claude Code");
      expect(output).toContain("bilt scan --format agent --changed");
    });

    it("returns cursor guidelines when agent is cursor", async () => {
      const output = await executePrompt({ agent: "cursor" });
      expect(output).toContain("Cursor AI");
      expect(output).toContain("bilt scan --format agent --changed");
    });

    it("falls back to default guidelines for unknown agents", async () => {
      const output = await executePrompt({ agent: "unknown-agent-xyz" });
      expect(output).toContain("Bilt Agent Security Guidelines");
    });
  });

  describe("executeInitAgent", () => {
    it("previews changes in dry-run mode without creating files", async () => {
      const result = await executeInitAgent(tempDir, { dryRun: true });
      expect(result.files.length).toBe(2);
      expect(result.files[0]?.status).toBe("create");
      expect(result.files[0]?.diff).toContain("+++ b/AGENTS.md");

      // Verify files were not created on disk
      const agentsExists = await fs
        .access(path.join(tempDir, "AGENTS.md"))
        .then(() => true)
        .catch(() => false);
      const hooksExists = await fs
        .access(path.join(tempDir, ".claude", "hooks.json"))
        .then(() => true)
        .catch(() => false);

      expect(agentsExists).toBe(false);
      expect(hooksExists).toBe(false);
    });

    it("creates AGENTS.md and .claude/hooks.json when run without dry-run", async () => {
      const result = await executeInitAgent(tempDir, { dryRun: false });
      expect(result.files.length).toBe(2);
      expect(result.files[0]?.status).toBe("create");

      const agentsContent = await fs.readFile(
        path.join(tempDir, "AGENTS.md"),
        "utf-8",
      );
      expect(agentsContent).toContain("bilt scan --format agent --changed");

      const hooksContent = await fs.readFile(
        path.join(tempDir, ".claude", "hooks.json"),
        "utf-8",
      );
      const parsedHooks = JSON.parse(hooksContent);
      expect(parsedHooks.hooks.Stop[0].command).toBe(
        "bilt scan --format agent --changed",
      );
    });

    it("creates CLAUDE.md when agent is claude", async () => {
      const result = await executeInitAgent(tempDir, { agent: "claude" });
      expect(result.files[0]?.relative).toBe("CLAUDE.md");

      const claudeExists = await fs
        .access(path.join(tempDir, "CLAUDE.md"))
        .then(() => true)
        .catch(() => false);
      expect(claudeExists).toBe(true);
    });

    it("skips overwriting existing files if force is false", async () => {
      // First run: creates files
      await executeInitAgent(tempDir);

      // Modify existing AGENTS.md
      await fs.writeFile(
        path.join(tempDir, "AGENTS.md"),
        "# Pre-existing manual guidelines",
        "utf-8",
      );

      // Second run: should skip
      const secondRun = await executeInitAgent(tempDir, { force: false });
      const agentsFileResult = secondRun.files.find(
        (f) => f.relative === "AGENTS.md",
      );
      expect(agentsFileResult?.status).toBe("skip");

      const contentAfter = await fs.readFile(
        path.join(tempDir, "AGENTS.md"),
        "utf-8",
      );
      expect(contentAfter).toBe("# Pre-existing manual guidelines");
    });

    it("overwrites existing files when force is true", async () => {
      // Pre-create file
      await fs.writeFile(
        path.join(tempDir, "AGENTS.md"),
        "# Pre-existing manual guidelines",
        "utf-8",
      );

      const run = await executeInitAgent(tempDir, { force: true });
      const agentsFileResult = run.files.find(
        (f) => f.relative === "AGENTS.md",
      );
      expect(agentsFileResult?.status).toBe("overwrite");

      const contentAfter = await fs.readFile(
        path.join(tempDir, "AGENTS.md"),
        "utf-8",
      );
      expect(contentAfter).toContain("bilt scan --format agent --changed");
    });
  });
});
