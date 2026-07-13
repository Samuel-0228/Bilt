// ─── Gitignore Module Tests ──────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  parseGitignore,
  checkEnvFilesIgnored,
} from "../../src/core/scan/gitignore.js";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

// ─── parseGitignore ──────────────────────────────────────────────────────────

describe("parseGitignore", () => {
  it("should parse simple patterns", () => {
    const content = "node_modules\ndist\n.env\n";
    const patterns = parseGitignore(content);

    expect(patterns).toContain("node_modules");
    expect(patterns).toContain("dist");
    expect(patterns).toContain(".env");
  });

  it("should skip comments", () => {
    const content = "# Dependencies\nnode_modules\n# Build\ndist\n";
    const patterns = parseGitignore(content);

    expect(patterns).toContain("node_modules");
    expect(patterns).toContain("dist");
    expect(patterns).not.toContain("# Dependencies");
    expect(patterns).not.toContain("# Build");
    expect(patterns.length).toBe(2);
  });

  it("should skip empty lines", () => {
    const content = "\n\nnode_modules\n\n\ndist\n\n";
    const patterns = parseGitignore(content);

    expect(patterns).toEqual(["node_modules", "dist"]);
  });

  it("should handle glob patterns", () => {
    const content = "*.log\n*.env.*\n.env.local\n";
    const patterns = parseGitignore(content);

    expect(patterns).toContain("*.log");
    expect(patterns).toContain("*.env.*");
    expect(patterns).toContain(".env.local");
  });

  it("should handle negation patterns", () => {
    const content = ".env*\n!.env.example\n";
    const patterns = parseGitignore(content);

    expect(patterns).toContain(".env*");
    expect(patterns).toContain("!.env.example");
  });

  it("should handle empty content", () => {
    const patterns = parseGitignore("");
    expect(patterns).toEqual([]);
  });

  it("should trim whitespace from patterns", () => {
    const content = "  node_modules  \n  dist  \n";
    const patterns = parseGitignore(content);

    expect(patterns).toContain("node_modules");
    expect(patterns).toContain("dist");
  });
});

// ─── checkEnvFilesIgnored ────────────────────────────────────────────────────

describe("checkEnvFilesIgnored", () => {
  it("should report uncovered .env files", async () => {
    // Create a temporary directory with a .gitignore that does NOT cover .env
    const tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "bilt-gitignore-test-"),
    );

    try {
      await fs.writeFile(
        path.join(tmpDir, ".gitignore"),
        "node_modules\ndist\n",
      );

      const findings = await checkEnvFilesIgnored(tmpDir, [
        ".env",
        ".env.local",
      ]);

      // Should report that .env files are not ignored
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]?.category).toBe("gitignore-missing");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should not report when .env files are covered", async () => {
    const tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "bilt-gitignore-test-"),
    );

    try {
      await fs.writeFile(
        path.join(tmpDir, ".gitignore"),
        "node_modules\n.env\n.env.*\n.env.local\n",
      );

      const findings = await checkEnvFilesIgnored(tmpDir, [
        ".env",
        ".env.local",
      ]);

      // All covered — no findings
      expect(findings.length).toBe(0);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should not flag .env.example", async () => {
    const tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "bilt-gitignore-test-"),
    );

    try {
      await fs.writeFile(path.join(tmpDir, ".gitignore"), "node_modules\n");

      // .env.example should not be flagged (it's meant to be committed)
      const findings = await checkEnvFilesIgnored(tmpDir, [".env.example"]);

      const exampleFinding = findings.find((f) =>
        f.message.includes(".env.example"),
      );
      expect(exampleFinding).toBeUndefined();
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should handle missing .gitignore file", async () => {
    const tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "bilt-gitignore-test-"),
    );

    try {
      // No .gitignore file at all
      const findings = await checkEnvFilesIgnored(tmpDir, [".env"]);

      // Should report that .gitignore is missing or .env is uncovered
      expect(findings.length).toBeGreaterThan(0);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
