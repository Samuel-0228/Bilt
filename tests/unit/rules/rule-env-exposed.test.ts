import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { evaluateEnvExposure } from "../../../src/core/rules/pack/rule-env-exposed.js";

describe("RULE-ENV-001: Environment Exposure", () => {
  const fixturesDir = path.resolve("tests/fixtures/rules/rule-env-exposed");

  it("should match positive fixtures pos-1.env, pos-2.ts, pos-3.ts", async () => {
    for (const fixture of ["pos-1.env", "pos-2.ts", "pos-3.ts"]) {
      const filePath = path.join(fixturesDir, fixture);
      const content = await fs.readFile(filePath, "utf-8");
      const findings = evaluateEnvExposure(filePath, content);

      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0]!.rule_id).toBe("RULE-ENV-001");
      expect(findings[0]!.precision).toBe("high");
    }
  });

  it("should not match negative fixtures neg-1.env.example, neg-2.ts, neg-3.ts", async () => {
    for (const fixture of ["neg-1.env.example", "neg-2.ts", "neg-3.ts"]) {
      const filePath = path.join(fixturesDir, fixture);
      const content = await fs.readFile(filePath, "utf-8");
      const findings = evaluateEnvExposure(filePath, content);

      expect(findings.length).toBe(0);
    }
  });
});
