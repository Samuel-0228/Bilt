import { describe, it, expect } from "vitest";
import path from "node:path";
import { runChecks } from "../../src/core/readiness/check-runner.js";

const GENERIC_FIXTURE = path.resolve(
  __dirname,
  "../fixtures/design/generic-app",
);

describe("Readiness Check & Design Quality Integration", () => {
  it("includes design-quality findings in bilt check without blocking gate as security fail", async () => {
    const result = await runChecks({
      dir: GENERIC_FIXTURE,
    });

    // Check that design-quality category ran and produced findings
    const designFindings = result.findings.filter(
      (f) => f.category === "design-quality",
    );
    expect(designFindings.length).toBeGreaterThan(0);

    // Verify all design findings have status 'needs-review' (advisory)
    for (const f of designFindings) {
      expect(f.status).toBe("needs-review");
    }

    // Verify that design-quality does not add to security blockingFindings
    const blockingDesignFindings = result.gate.blockingFindings.filter(
      (f) => f.category === "design-quality",
    );
    expect(blockingDesignFindings).toHaveLength(0);

    // Verify design findings have locations populated
    for (const f of designFindings) {
      expect(f.locations).toBeDefined();
      expect(f.locations!.length).toBeGreaterThan(0);
      expect(f.locations![0].file).toBe("app/page.tsx");
    }
  });
});
