import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { evaluateRouteAuthMiddleware } from "../../../src/core/rules/pack/rule-auth-middleware.js";

describe("RULE-AUTH-001: Missing Route Auth Middleware", () => {
  const fixturesDir = path.resolve("tests/fixtures/rules/rule-auth-middleware");

  it("should match positive fixtures pos-1.ts, pos-2.ts, pos-3.ts", async () => {
    // Note: pos-3 simulates a Next.js App Router route path
    const testCases = [
      { file: "pos-1.ts", checkPath: "src/routes/admin.ts" },
      { file: "pos-2.ts", checkPath: "src/routes/billing.ts" },
      { file: "pos-3.ts", checkPath: "src/app/api/admin/users/route.ts" },
    ];

    for (const { file, checkPath } of testCases) {
      const filePath = path.join(fixturesDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const findings = evaluateRouteAuthMiddleware(checkPath, content);

      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0]!.rule_id).toBe("RULE-AUTH-001");
      expect(findings[0]!.precision).toBe("high");
    }
  });

  it("should not match negative fixtures neg-1.ts, neg-2.ts, neg-3.ts", async () => {
    const testCases = [
      { file: "neg-1.ts", checkPath: "src/routes/admin.ts" },
      { file: "neg-2.ts", checkPath: "src/routes/public.ts" },
      { file: "neg-3.ts", checkPath: "src/app/api/admin/users/route.ts" },
    ];

    for (const { file, checkPath } of testCases) {
      const filePath = path.join(fixturesDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const findings = evaluateRouteAuthMiddleware(checkPath, content);

      expect(findings.length).toBe(0);
    }
  });
});
