import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execa } from "execa";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_PATH = path.resolve(__dirname, "../../dist/cli.js");

describe("CLI Hardening & Safety Integration Tests", () => {
  let tmpDir: string;

  beforeAll(async () => {
    const rootDir = path.resolve(__dirname, "../../");
    const exists = await fs.stat(CLI_PATH).then(() => true).catch(() => false);
    if (!exists) {
      await execa("npm", ["run", "build"], { cwd: rootDir });
    }
  }, 60000);

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-hardening-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should fail gracefully with operational exit code 2 when directory does not exist", async () => {
    const nonExistent = path.join(tmpDir, "missing-dir");
    const { stderr, exitCode } = await execa("node", [CLI_PATH, "scan", nonExistent], {
      reject: false,
    });

    expect(exitCode).toBe(2);
    expect(stderr).toContain("Directory not found");
  });

  it("should fail gracefully with operational exit code 3 when bilt check targets non-existent directory", async () => {
    const nonExistent = path.join(tmpDir, "missing-dir");
    const { stderr, exitCode } = await execa("node", [CLI_PATH, "check", nonExistent], {
      reject: false,
    });

    expect(exitCode).toBe(3);
    expect(stderr).toContain("Directory not found");
  });

  it("should block path traversal attempts via bilt report --output", async () => {
    // Run report inside tmpDir targeting an escaped file path
    const { stderr, exitCode } = await execa(
      "node",
      [CLI_PATH, "report", tmpDir, "--output", "../escaped-report.md"],
      { reject: false },
    );

    expect(exitCode).toBe(2);
    expect(stderr).toContain("destination must be within the project directory");
  });

  it("should handle empty project directory gracefully without crashing", async () => {
    const { stdout, exitCode } = await execa("node", [CLI_PATH, "scan", tmpDir], {
      reject: false,
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain("all clear");
  });

  it("should reject unknown plugin actions with exit code 2", async () => {
    const { stderr, exitCode } = await execa(
      "node",
      [CLI_PATH, "plugin", "destroy-everything"],
      { reject: false },
    );

    expect(exitCode).toBe(2);
    expect(stderr).toContain("Unknown plugin action");
  });
});
