import { describe, it, expect } from "vitest";
import { parseSarifReport } from "../../src/core/adapters/sarif-adapter.js";

describe("External Scanner SARIF Adapter", () => {
  it("should parse Semgrep-style SARIF output into Finding models", () => {
    const semgrepSarif = {
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "semgrep",
              rules: [
                {
                  id: "javascript.lang.security.audit.sqli",
                  shortDescription: { text: "SQL Injection vulnerability" },
                },
              ],
            },
          },
          results: [
            {
              ruleId: "javascript.lang.security.audit.sqli",
              level: "error",
              message: { text: "Unsanitized user input in query" },
              locations: [
                {
                  physicalLocation: {
                    artifactLocation: { uri: "src/db/query.js" },
                    region: { startLine: 45, endLine: 48 },
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const findings = parseSarifReport(semgrepSarif);
    expect(findings.length).toBe(1);

    const f = findings[0]!;
    expect(f.rule_id).toBe("JAVASCRIPT.LANG.SECURITY.AUDIT.SQLI");
    expect(f.severity).toBe("critical"); // level: "error" -> critical
    expect(f.precision).toBe("medium");
    expect(f.maturity).toBe("stable");
    expect(f.file).toBe("src/db/query.js");
    expect(f.line).toBe(45);
    expect(f.end_line).toBe(48);
    expect(f.fingerprint.length).toBe(64);
  });

  it("should parse Gitleaks-style SARIF output into Finding models", () => {
    const gitleaksSarif = {
      version: "2.1.0",
      runs: [
        {
          tool: { driver: { name: "gitleaks" } },
          results: [
            {
              ruleId: "generic-api-key",
              level: "warning",
              message: { text: "Generic API Key detected" },
              locations: [
                {
                  physicalLocation: {
                    artifactLocation: { uri: "config.json" },
                    region: { startLine: 12 },
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const findings = parseSarifReport(gitleaksSarif);
    expect(findings.length).toBe(1);
    expect(findings[0]!.rule_id).toBe("GENERIC-API-KEY");
    expect(findings[0]!.severity).toBe("warning");
    expect(findings[0]!.file).toBe("config.json");
    expect(findings[0]!.line).toBe(12);
  });

  it("should gracefully handle empty or invalid input", () => {
    expect(parseSarifReport("")).toEqual([]);
    expect(parseSarifReport({})).toEqual([]);
    expect(parseSarifReport({ runs: [] })).toEqual([]);
  });
});
