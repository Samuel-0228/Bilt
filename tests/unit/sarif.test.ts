import { describe, it, expect } from "vitest";
import { formatSarifOutput } from "../../src/core/output/formatters/sarif.js";
import type { Finding } from "../../src/core/finding/types.js";

describe("SARIF Output Formatter", () => {
  it("should generate a valid SARIF v2.1.0 document", () => {
    const findings: Finding[] = [
      {
        rule_id: "RULE-SEC-001",
        fingerprint: "11".repeat(32),
        severity: "critical",
        precision: "high",
        maturity: "stable",
        category: "secrets",
        file: "src/config/keys.ts",
        line: 15,
        end_line: 15,
        title: "Hardcoded Secret",
        explanation: "API secret key found in source code.",
        agent_action: "Store in environment variable.",
        fixable: false,
      },
      {
        rule_id: "RULE-HTTP-001",
        fingerprint: "22".repeat(32),
        severity: "warning",
        precision: "high",
        maturity: "experimental",
        category: "api-design",
        file: "src/server.ts",
        line: 42,
        end_line: 45,
        title: "Wildcard Method",
        explanation: "Handler accepts all HTTP verbs.",
        agent_action: "Explicitly allow verbs.",
        fixable: true,
      },
    ];

    const sarif = formatSarifOutput(findings, "1.0.5");

    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs.length).toBe(1);

    const run = sarif.runs[0]!;
    expect(run.tool.driver.name).toBe("bilt");
    expect(run.tool.driver.version).toBe("1.0.5");
    expect(run.tool.driver.rules.length).toBe(2);

    expect(run.results.length).toBe(2);
    expect(run.results[0]!.level).toBe("error"); // critical -> error
    expect(run.results[0]!.ruleId).toBe("RULE-SEC-001");
    expect(run.results[0]!.fingerprints["bilt/v1"]).toBe("11".repeat(32));
    expect(
      run.results[0]!.locations[0]!.physicalLocation.artifactLocation.uri,
    ).toBe("src/config/keys.ts");

    expect(run.results[1]!.level).toBe("warning"); // warning -> warning
    expect(run.results[1]!.ruleId).toBe("RULE-HTTP-001");
  });
});
