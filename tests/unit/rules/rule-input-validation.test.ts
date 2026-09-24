import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { evaluateInputValidation } from "../../../src/core/rules/pack/rule-input-validation.js";

describe("RULE-INPUT-001: Missing Request Input Validation", () => {
  const fixturesDir = path.resolve(
    "tests/fixtures/rules/rule-input-validation",
  );

  it("should match positive fixtures pos-1.ts, pos-2.ts, pos-3.ts", async () => {
    for (const file of ["pos-1.ts", "pos-2.ts", "pos-3.ts"]) {
      const filePath = path.join(fixturesDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const findings = evaluateInputValidation(filePath, content);

      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0]!.rule_id).toBe("RULE-INPUT-001");
      expect(findings[0]!.precision).toBe("high");
    }
  });

  it("should not match negative fixtures neg-1.ts, neg-2.ts, neg-3.ts", async () => {
    for (const file of ["neg-1.ts", "neg-2.ts", "neg-3.ts"]) {
      const filePath = path.join(fixturesDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const findings = evaluateInputValidation(filePath, content);

      expect(findings.length).toBe(0);
    }
  });
});
