import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { evaluateHardcodedSecrets } from "../../../src/core/rules/pack/rule-secrets.js";

describe("RULE-SEC-001: Hardcoded Secrets", () => {
  const fixturesDir = path.resolve("tests/fixtures/rules/rule-secrets");

  it("should match positive fixtures pos-1, pos-2, pos-3", async () => {
    for (const fixture of ["pos-1.ts", "pos-2.ts", "pos-3.ts"]) {
      const filePath = path.join(fixturesDir, fixture);
      const content = await fs.readFile(filePath, "utf-8");
      const findings = evaluateHardcodedSecrets(filePath, content);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0]!.rule_id).toBe("RULE-SEC-001");
      expect(findings[0]!.precision).toBe("high");
    }
  });

  it("should not match negative fixtures neg-1, neg-2, neg-3", async () => {
    for (const fixture of ["neg-1.ts", "neg-2.ts", "neg-3.ts"]) {
      const filePath = path.join(fixturesDir, fixture);
      const content = await fs.readFile(filePath, "utf-8");
      const findings = evaluateHardcodedSecrets(filePath, content);

      expect(findings.length).toBe(0);
    }
  });
});
