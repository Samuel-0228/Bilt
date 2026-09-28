import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { executeAcceptRisk, matchFindingOrRuleId } from "../../src/commands/accept-risk.js";
import { loadAcceptedRisks } from "../../src/core/readiness/risk-acceptance.js";

describe("Resilient CLI Argument Parsing for accept-risk", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-accept-risk-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("should accept risk with positional finding ID and valid reason and owner", async () => {
    const code = await executeAcceptRisk("CHECK-DEP-001", {
      reason: "Legacy peer dependency required for production build",
      owner: "security-team",
      dir: tempDir,
    });

    expect(code).toBe(0);
    const risks = await loadAcceptedRisks(tempDir);
    expect(risks).toHaveLength(1);
    expect(risks[0]?.findingId).toBe("CHECK-DEP-001");
    expect(risks[0]?.category).toBe("dependencies");
  });

  it("should accept risk with --id flag and flags in any order", async () => {
    const code = await executeAcceptRisk(undefined, {
      id: "CHECK-CORS-001",
      reason: "Upstream Cloudflare rules restrict CORS headers",
      owner: "@infra",
      dir: tempDir,
    });

    expect(code).toBe(0);
    const risks = await loadAcceptedRisks(tempDir);
    expect(risks).toHaveLength(1);
    expect(risks[0]?.findingId).toBe("CHECK-CORS-001");
    expect(risks[0]?.category).toBe("transport-and-headers");
  });

  it("should accept risk with --finding flag alias", async () => {
    const code = await executeAcceptRisk(undefined, {
      finding: "CHECK-DEP-001",
      reason: "Internal microservice uses pinned lockfile",
      owner: "backend-team",
      dir: tempDir,
    });

    expect(code).toBe(0);
    const risks = await loadAcceptedRisks(tempDir);
    expect(risks).toHaveLength(1);
    expect(risks[0]?.findingId).toBe("CHECK-DEP-001");
  });

  it("should handle arguments as array with spaces correctly", async () => {
    const code = await executeAcceptRisk(["CHECK-DEP-001"], {
      reason: "Approved exception for legacy dependency",
      owner: "Core Team",
      dir: tempDir,
    });

    expect(code).toBe(0);
    const risks = await loadAcceptedRisks(tempDir);
    expect(risks[0]?.findingId).toBe("CHECK-DEP-001");
  });

  it("should output actionable diagnostics when finding ID is missing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const code = await executeAcceptRisk(undefined, {
      reason: "Valid reason here",
      owner: "team",
      dir: tempDir,
    });

    expect(code).toBe(1);
    const errorOutput = errorSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(errorOutput).toContain("Finding ID is required");
    expect(errorOutput).toContain("Usage:");
    expect(errorOutput).toContain("Examples:");

    errorSpy.mockRestore();
  });

  it("should output actionable diagnostics when --reason is missing or too short", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const code = await executeAcceptRisk("CHECK-DEP-001", {
      reason: "no",
      owner: "team",
      dir: tempDir,
    });

    expect(code).toBe(1);
    const errorOutput = errorSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(errorOutput).toContain("--reason is required");
    expect(errorOutput).toContain("Usage:");

    errorSpy.mockRestore();
  });

  it("should output actionable diagnostics when --owner is missing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const code = await executeAcceptRisk("CHECK-DEP-001", {
      reason: "Legitimate reason for risk acceptance",
      owner: "",
      dir: tempDir,
    });

    expect(code).toBe(1);
    const errorOutput = errorSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(errorOutput).toContain("--owner is required");
    expect(errorOutput).toContain("Usage:");

    errorSpy.mockRestore();
  });

  it("should prohibit risk acceptance for mandatory categories (e.g. auth)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const code = await executeAcceptRisk("CHECK-AUTH-001", {
      reason: "Trying to bypass JWT verification check",
      owner: "dev",
      dir: tempDir,
    });

    expect(code).toBe(1);
    const errorOutput = errorSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(errorOutput).toContain("Risk Acceptance Prohibited for Mandatory Category");

    errorSpy.mockRestore();
  });

  describe("Fuzzy Matching for approximate finding/rule names", () => {
    it("should normalize lowercase and underscore names (check_dep_001 -> CHECK-DEP-001)", () => {
      const match = matchFindingOrRuleId("check_dep_001");
      expect(match.matchedId).toBe("CHECK-DEP-001");
    });

    it("should normalize short digit endings (check-dep-1 -> CHECK-DEP-001)", () => {
      const match = matchFindingOrRuleId("check-dep-1");
      expect(match.matchedId).toBe("CHECK-DEP-001");
    });

    it("should match suffix rules (dep-001 -> CHECK-DEP-001)", () => {
      const match = matchFindingOrRuleId("dep-001");
      expect(match.matchedId).toBe("CHECK-DEP-001");
    });

    it("should suggest close matches for typos", () => {
      const match = matchFindingOrRuleId("CHECK-DEP-009");
      expect(match.suggestion).toBe("CHECK-DEP-001");
    });
  });
});
