import { describe, it, expect } from "vitest";
import { analyzeConfigDiff } from "../../src/core/trust/tamper.js";
import { determineAgentStatus } from "../../src/core/output/formatters/agent.js";

describe("Anti-Tamper & Config Protection", () => {
  it("should detect broad ignore additions in config diffs", () => {
    const diff = `
--- a/.biltrc
+++ b/.biltrc
@@ -5,2 +5,3 @@
   "ignore": [
+    "src/**",
+    "*"
   ]
`;
    const analysis = analyzeConfigDiff(diff);
    expect(analysis.addedIgnores).toContain("src/**");
    expect(analysis.addedIgnores).toContain("*");
  });

  it("should detect severity downgrades in config diffs", () => {
    const diff = `
--- a/.biltrc
+++ b/.biltrc
@@ -10,2 +10,3 @@
   "severityOverrides": {
+    "RULE-SEC-001": "info"
   }
`;
    const analysis = analyzeConfigDiff(diff);
    expect(analysis.severityDowngrades.length).toBe(1);
    expect(analysis.severityDowngrades[0]!.ruleId).toBe("RULE-SEC-001");
    expect(analysis.severityDowngrades[0]!.to).toBe("info");
  });

  it("should detect rule deletion or deactivation in config diffs", () => {
    const diff = `
--- a/bilt.config.js
+++ b/bilt.config.js
@@ -15,3 +15,2 @@
   customRules: [
-    "RULE-SEC-001",
   ]
`;
    const analysis = analyzeConfigDiff(diff);
    expect(analysis.disabledRules).toContain("RULE-SEC-001");
  });

  it("should trigger hard fail status on tamper violations", () => {
    const status = determineAgentStatus(
      [],
      [
        {
          rule_id: "TAMPER-BROAD-IGNORE",
          severity: "critical",
          message: "Broad ignore added to .biltrc",
          file: ".biltrc",
        },
      ],
    );

    expect(status).toBe("fail");
  });
});
