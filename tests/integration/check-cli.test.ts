import { describe, it, expect, afterAll } from "vitest";
import { execa } from "execa";
import path from "node:path";
import fs from "node:fs/promises";

const CLI_PATH = path.resolve(__dirname, "../../dist/cli.js");

describe("bilt check CLI Integration", () => {
  afterAll(async () => {
    await Promise.allSettled([
      fs.rm(path.resolve(__dirname, "../fixtures/clean-project/.bilt"), { recursive: true, force: true }),
      fs.rm(path.resolve(__dirname, "../fixtures/vulnerable-readiness-app/.bilt"), { recursive: true, force: true }),
    ]);
  });
  it("should show help for bilt check", async () => {
    const { stdout } = await execa("node", [CLI_PATH, "check", "--help"]);
    expect(stdout).toContain("Comprehensive production-readiness verification");
    expect(stdout).toContain("--format");
    expect(stdout).toContain("--changed");
  });

  it("should output valid Agent JSON with schemaVersion 1 and disclaimer", async () => {
    const { stdout, exitCode } = await execa(
      "node",
      [CLI_PATH, "check", "tests/fixtures/clean-project", "--format", "agent"],
      { reject: false },
    );

    const jsonString = stdout.slice(stdout.indexOf("{"), stdout.lastIndexOf("}") + 1);
    const json = JSON.parse(jsonString);
    expect(json.schemaVersion).toBe("1");  // v1.2.0 protocol: string literal "1"
    expect(json.toolVersion).toBeTruthy();
    expect(json.status).toBeDefined();
    expect(json.summary).toBeDefined();
    expect(json.nextAction).toBeDefined();           // new in v1.2.0
    expect(json.execution).toBeDefined();            // new in v1.2.0
    expect(json.disclaimer).toContain("Bilt is an automated readiness check");
    expect(exitCode).toBeLessThanOrEqual(2);
  });

  it("should detect vulnerabilities and return exit code 1 for leaky project", async () => {
    const { stdout, exitCode } = await execa(
      "node",
      [
        CLI_PATH,
        "check",
        "tests/fixtures/vulnerable-readiness-app",
        "--format",
        "agent",
      ],
      { reject: false },
    );

    const jsonString = stdout.slice(stdout.indexOf("{"), stdout.lastIndexOf("}") + 1);
    const json = JSON.parse(jsonString);
    // v1.2.0 protocol: status is "fail" (was "not-ready" in legacy schema)
    expect(json.status).toBe("fail");
    expect(exitCode).toBe(1);
    expect(json.summary.blocking).toBeGreaterThan(0);
    // nextAction must tell agent what to do next
    expect(json.nextAction.type).toBe("fix");
    expect(Array.isArray(json.nextAction.findingIds)).toBe(true);
  });

  it("should explain authentication concept via bilt explain auth", async () => {
    const { stdout } = await execa("node", [CLI_PATH, "explain", "auth"]);
    expect(stdout).toContain("Authentication");
    expect(stdout).toContain("What It Is");
    expect(stdout).toContain("What Bilt can verify");
  });

  it("should forbid risk acceptance on mandatory category (Section 8B)", async () => {
    const { stderr, exitCode } = await execa(
      "node",
      [
        CLI_PATH,
        "accept-risk",
        "RULE-SEC-001",
        "--category",
        "secrets-and-env",
        "--reason",
        "We want to deploy with secrets",
        "--owner",
        "DevTeam",
      ],
      { reject: false },
    );

    expect(stderr).toContain("Risk Acceptance Prohibited for Mandatory Category");
    expect(exitCode).toBe(1);
  });
});
