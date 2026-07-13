import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execa } from "execa";
import { createLeakyFixtureProject } from "../fixtures/helper.js";

import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, "../../dist/cli.js");

describe("CLI Binary Integration Tests", () => {
  let tmpDir: string;

  beforeAll(async () => {
    // Ensure project is built before running CLI binary tests
    const rootDir = path.resolve(__dirname, "../../");
    await execa("npm", ["run", "build"], { cwd: rootDir });
  });

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-cli-integration-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should print help information", async () => {
    const { stdout } = await execa("node", [cliPath, "--help"]);
    expect(stdout).toContain("Usage: bilt");
    expect(stdout).toContain("scan");
    expect(stdout).toContain("init");
    expect(stdout).toContain("fix");
    expect(stdout).toContain("undo");
    expect(stdout).toContain("watch");
    expect(stdout).toContain("doctor");
  });

  it("should print version from package.json", async () => {
    const { stdout } = await execa("node", [cliPath, "--version"]);
    const pkg = JSON.parse(
      await fs.readFile(path.resolve(__dirname, "../../package.json"), "utf-8"),
    );
    expect(stdout.trim()).toBe(pkg.version);
  });

  it("should exit with code 0 for a clean project scan", async () => {
    const cleanSource = path.resolve(__dirname, "../fixtures/clean-project");
    await fs.mkdir(path.join(tmpDir, "src"), { recursive: true });
    await fs.copyFile(
      path.join(cleanSource, ".gitignore"),
      path.join(tmpDir, ".gitignore"),
    );
    await fs.copyFile(
      path.join(cleanSource, "package.json"),
      path.join(tmpDir, "package.json"),
    );
    await fs.copyFile(
      path.join(cleanSource, "src/index.ts"),
      path.join(tmpDir, "src/index.ts"),
    );
    await fs.copyFile(
      path.join(cleanSource, ".env-source"),
      path.join(tmpDir, ".env"),
    );
    await fs.copyFile(
      path.join(cleanSource, ".env.example"),
      path.join(tmpDir, ".env.example"),
    );

    const { exitCode } = await execa("node", [cliPath, "scan"], {
      cwd: tmpDir,
    });
    expect(exitCode).toBe(0);
  });

  it("should exit with code 1 for a leaky project scan", async () => {
    await createLeakyFixtureProject(tmpDir);

    try {
      await execa("node", [cliPath, "scan"], { cwd: tmpDir });
      // Should have thrown error (exit code 1)
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.exitCode).toBe(1);
      expect(err.stdout).toContain("Critical");
    }
  });
});
