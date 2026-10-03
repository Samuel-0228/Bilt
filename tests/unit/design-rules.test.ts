import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import { runDesignCheck } from "../../src/core/design/engine.js";
import { resetLoopState } from "../../src/core/loop/state.js";

const GENERIC_FIXTURE = path.resolve(
  __dirname,
  "../fixtures/design/generic-app",
);
const INTENTIONAL_FIXTURE = path.resolve(
  __dirname,
  "../fixtures/design/intentional-app",
);

describe("Design Check Rule Catalog & Detection", () => {
  beforeEach(async () => {
    await resetLoopState(GENERIC_FIXTURE);
    await resetLoopState(INTENTIONAL_FIXTURE);
  });
  it("detects generic SaaS template combination in generic fixture", async () => {
    const result = await runDesignCheck(GENERIC_FIXTURE);

    expect(result.status).toBe("needs-improvement");
    expect(result.summary.patternsDetected).toBeGreaterThanOrEqual(5);

    const ruleIds = result.findings.map((f) => f.ruleId);
    expect(ruleIds).toContain("GENERIC-SAAS-COMBINATION-001");
    expect(ruleIds).toContain("VIBECODED-LANDING-PAGE-001");
    expect(ruleIds).toContain("DESIGN-VISUAL-002"); // Purple-on-black aesthetic
    expect(ruleIds).toContain("CONTENT-QUALITY-001"); // Marketing slogans
    expect(ruleIds).toContain("A11Y-UI-003"); // Missing img alt
  });

  it("passes cleanly on intentional distinctive fixture", async () => {
    const result = await runDesignCheck(INTENTIONAL_FIXTURE);

    expect(result.status).toBe("pass");
    expect(result.summary.patternsDetected).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it("generates stable SHA-256 fingerprints across consecutive runs", async () => {
    const run1 = await runDesignCheck(GENERIC_FIXTURE);
    const run2 = await runDesignCheck(GENERIC_FIXTURE);

    expect(run1.findings.length).toBe(run2.findings.length);
    for (let i = 0; i < run1.findings.length; i++) {
      expect(run1.findings[i]!.fingerprint).toBe(run2.findings[i]!.fingerprint);
      expect(run1.findings[i]!.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("categorizes findings correctly without calling accessibility issues vibecoding", async () => {
    const result = await runDesignCheck(GENERIC_FIXTURE);

    const a11yFinding = result.findings.find((f) => f.ruleId === "A11Y-UI-003");
    expect(a11yFinding).toBeDefined();
    expect(a11yFinding?.category).toBe("accessibility");
    expect(a11yFinding?.whyItMatters).toContain("WCAG");
  });
});
