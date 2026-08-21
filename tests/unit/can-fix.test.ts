import { describe, it, expect } from "vitest";
import { canFixFinding } from "../../src/core/fix/can-fix.js";
import type { ScanFinding } from "../../src/types/index.js";

describe("canFixFinding Unit Tests", () => {
  it("should return true for fixable categories", () => {
    const findings: Partial<ScanFinding>[] = [
      { category: "gitignore-missing" },
      { category: "git-committed-env" },
      { category: "env-missing" },
      { category: "env-unused" },
      { category: "env-mismatch" },
      { category: "env-exposed" },
      { category: "config-docker" },
      { category: "config-tsconfig" },
      { category: "config-ci" },
      { category: "dep-unused" },
      { category: "dep-duplicate" },
      { category: "dep-outdated" },
      { category: "dep-vulnerable" },
      { category: "secret-detected" },
      { category: "git-history-secret" },
    ];

    for (const f of findings) {
      expect(canFixFinding(f as ScanFinding)).toBe(true);
    }
  });

  it("should return true for security engine rules with automated fixes", () => {
    const secFindings: Partial<ScanFinding>[] = [
      { category: "framework-warning", ruleId: "SEC-CRY-001", message: "Use of Weak PRNG Math.random()" },
      { category: "framework-warning", ruleId: "SEC-AUTH-001", message: "jwt.decode used without verification" },
      { category: "framework-warning", ruleId: "SEC-INP-004", message: "dangerouslySetInnerHTML without DOMPurify" },
      { category: "framework-warning", ruleId: "SEC-STO-002", message: "res.cookie missing httpOnly" },
      { category: "framework-warning", ruleId: "SEC-NET-001", message: "rejectUnauthorized: false" },
      { category: "framework-warning", ruleId: "SEC-ENV-001", message: "Client-Exposed Secret Environment Variable" },
      { category: "framework-warning", ruleId: "SEC-CFG-001", message: "Verbose error details exposed" },
      { category: "framework-warning", ruleId: "SEC-CFG-002", message: "Missing essential HTTP security headers" },
    ];

    for (const f of secFindings) {
      expect(canFixFinding(f as ScanFinding)).toBe(true);
    }
  });

  it("should return true for fixable plugin findings", () => {
    const pluginFindings: Partial<ScanFinding>[] = [
      { category: "plugin-finding", id: "docker-no-dockerignore-123" },
      { category: "plugin-finding", id: "docker-dockerignore-env-456" },
      { category: "plugin-finding", id: "terraform-gitignore-tfvars-789" },
      { category: "plugin-finding", id: "prisma-hardcoded-db-url-1" },
    ];

    for (const f of pluginFindings) {
      expect(canFixFinding(f as ScanFinding)).toBe(true);
    }
  });

  it("should return false for unfixable findings", () => {
    const unfixableFindings: Partial<ScanFinding>[] = [
      { category: "git-large-file", message: "Large file > 5MB" },
      { category: "git-hygiene", message: "WIP commit" },
      { category: "perf-image", message: "Large uncompressed image" },
    ];

    for (const f of unfixableFindings) {
      expect(canFixFinding(f as ScanFinding)).toBe(false);
    }
  });
});
