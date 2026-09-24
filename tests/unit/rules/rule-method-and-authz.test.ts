import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { evaluateMethodRestrictions } from "../../../src/core/rules/pack/rule-method-restriction.js";
import { evaluateAuthzIdor } from "../../../src/core/rules/pack/rule-authz-idor.js";
import { determineAgentStatus } from "../../../src/core/output/formatters/agent.js";

describe("RULE-HTTP-001: HTTP Method Restrictions", () => {
  const fixturesDir = path.resolve(
    "tests/fixtures/rules/rule-method-restriction",
  );

  it("should match positive fixtures pos-1.ts, pos-2.ts, pos-3.ts", async () => {
    for (const file of ["pos-1.ts", "pos-2.ts", "pos-3.ts"]) {
      const filePath = path.join(fixturesDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const findings = evaluateMethodRestrictions(filePath, content);

      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0]!.rule_id).toBe("RULE-HTTP-001");
      expect(findings[0]!.precision).toBe("high");
    }
  });

  it("should not match negative fixtures neg-1.ts, neg-2.ts, neg-3.ts", async () => {
    for (const file of ["neg-1.ts", "neg-2.ts", "neg-3.ts"]) {
      const filePath = path.join(fixturesDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const findings = evaluateMethodRestrictions(filePath, content);

      expect(findings.length).toBe(0);
    }
  });
});

describe("RULE-IDOR-001: Client-Controlled Authorization", () => {
  const fixturesDir = path.resolve("tests/fixtures/rules/rule-authz-idor");

  it("should match positive fixtures pos-1.ts, pos-2.ts, pos-3.ts", async () => {
    for (const file of ["pos-1.ts", "pos-2.ts", "pos-3.ts"]) {
      const filePath = path.join(fixturesDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const findings = evaluateAuthzIdor(filePath, content);

      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0]!.rule_id).toBe("RULE-IDOR-001");
      expect(findings[0]!.precision).toBe("medium");
      expect(findings[0]!.maturity).toBe("experimental");

      // Critical non-negotiable requirement: IDOR yields NEEDS_REVIEW, never FAIL
      const status = determineAgentStatus(findings, []);
      expect(status).toBe("needs_review");
    }
  });

  it("should not match negative fixtures neg-1.ts, neg-2.ts, neg-3.ts", async () => {
    for (const file of ["neg-1.ts", "neg-2.ts", "neg-3.ts"]) {
      const filePath = path.join(fixturesDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const findings = evaluateAuthzIdor(filePath, content);

      expect(findings.length).toBe(0);
    }
  });
});
