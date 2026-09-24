import { describe, it, expect } from "vitest";
import {
  parseInlineSuppressions,
  applySuppressions,
} from "../../src/core/trust/suppressions.ts";
import type { Finding } from "../../src/core/finding/types.js";

describe("Suppression Policy & Reason Enforcement", () => {
  it("should accept valid inline suppressions with non-trivial reasons", () => {
    const code = `
      // bilt-ignore RULE-SEC-001: Approved mock key for local unit tests until 2099-01-01
      const testKey = "sk-test-12345";
    `;

    const { validSuppressions, invalidComments } = parseInlineSuppressions(
      "test.ts",
      code,
      new Date("2026-09-01"),
    );

    expect(invalidComments.length).toBe(0);
    expect(validSuppressions.length).toBe(1);
    expect(validSuppressions[0]!.rule_id).toBe("RULE-SEC-001");
    expect(validSuppressions[0]!.reason).toContain(
      "Approved mock key for local unit tests",
    );
    expect(validSuppressions[0]!.expires).toBe("2099-01-01");
  });

  it("should reject suppressions missing a reason string or using generic placeholders", () => {
    const code = `
      // bilt-ignore RULE-SEC-001
      const k1 = "x";
      // bilt-ignore RULE-SEC-001: TODO
      const k2 = "y";
      // bilt-ignore RULE-SEC-001: ignore
      const k3 = "z";
    `;

    const { validSuppressions, invalidComments } = parseInlineSuppressions(
      "test.ts",
      code,
    );

    expect(validSuppressions.length).toBe(0);
    expect(invalidComments.length).toBe(3);
    expect(invalidComments[0]!.message).toContain("mandatory");
  });

  it("should reject expired suppressions", () => {
    const code = `
      // bilt-ignore RULE-SEC-001: Legacy token grace period until 2024-01-01
      const legacyKey = "xyz";
    `;

    const { validSuppressions, invalidComments } = parseInlineSuppressions(
      "legacy.ts",
      code,
      new Date("2026-09-01"), // Current date is after 2024-01-01
    );

    expect(validSuppressions.length).toBe(0);
    expect(invalidComments.length).toBe(1);
    expect(invalidComments[0]!.message).toContain("expired on 2024-01-01");
  });

  it("should enforce the suppression budget", () => {
    const dummyFindings: Finding[] = [
      {
        rule_id: "RULE-SEC-001",
        fingerprint: "fp1",
        severity: "critical",
        precision: "high",
        maturity: "stable",
        category: "secrets",
        file: "f1.ts",
        line: 1,
        end_line: 1,
        title: "T",
        explanation: "E",
        agent_action: "A",
        fixable: false,
      },
    ];

    const sixSuppressions = [1, 2, 3, 4, 5, 6].map((i) => ({
      rule_id: "RULE-SEC-001",
      fingerprint: `fp${i}`,
      reason: `Valid business reason number ${i}`,
      file: `f${i}.ts`,
    }));

    // With budget = 5, 6 suppressions should exceed budget
    const result = applySuppressions(dummyFindings, sixSuppressions, {
      budget: 5,
    });

    expect(result.budgetExceeded).toBe(true);
    expect(result.activeFindings.length).toBe(1); // Not suppressed because budget was blown!
  });
});
