import { describe, it, expect } from "vitest";
import { evaluateGate } from "../../src/core/readiness/readiness-gate.js";
import { MANDATORY_CATEGORIES } from "../../src/core/readiness/taxonomy.js";
import type { BiltCheckFinding } from "../../src/core/readiness/finding.js";

describe("Production Readiness Gate", () => {
  it("should evaluate as production-ready when there are 0 findings", () => {
    const result = evaluateGate([], [], MANDATORY_CATEGORIES);
    expect(result.status).toBe("production-ready");
    expect(result.blockingFindings).toHaveLength(0);
    expect(result.reviewFindings).toHaveLength(0);
    expect(result.mandatoryCategoriesMet).toBe(true);
  });

  it("should fail gate if critical finding exists in any category", () => {
    const findings: BiltCheckFinding[] = [
      {
        ruleId: "CHECK-SEC-001",
        category: "secrets-and-env",
        mode: "automated",
        severity: "critical",
        precision: "high",
        maturity: "stable",
        status: "fail",
        title: "Secret in code",
        whyItMatters: "Exposes credentials",
        technicalDetail: "Found secret",
        agentAction: "Move to env",
        fixable: true,
        fingerprint: "fp-1",
      },
    ];

    const result = evaluateGate(findings, [], MANDATORY_CATEGORIES);
    expect(result.status).toBe("not-ready");
    expect(result.blockingFindings).toHaveLength(1);
    expect(result.summary.critical).toBe(1);
  });

  it("should flag not-ready-needs-review if guided needs-review findings exist without blocking findings", () => {
    const findings: BiltCheckFinding[] = [
      {
        ruleId: "AUTHZ-GUIDED-001",
        category: "authorization",
        mode: "guided",
        severity: "high",
        precision: "medium",
        maturity: "stable",
        status: "needs-review",
        title: "Ownership check needed",
        whyItMatters: "IDOR",
        technicalDetail: "Missing check",
        agentAction: "Inspect route",
        fixable: false,
        fingerprint: "fp-authz-1",
      },
    ];

    const result = evaluateGate(findings, [], MANDATORY_CATEGORIES);
    expect(result.status).toBe("not-ready-needs-review");
    expect(result.blockingFindings).toHaveLength(0);
    expect(result.reviewFindings).toHaveLength(1);
  });

  it("should allow risk acceptance to unblock non-mandatory categories", () => {
    const findings: BiltCheckFinding[] = [
      {
        ruleId: "CHECK-DEP-001",
        category: "dependencies",
        mode: "automated",
        severity: "high",
        precision: "high",
        maturity: "stable",
        status: "fail",
        title: "Missing lockfile",
        whyItMatters: "Supply chain risk",
        technicalDetail: "No lockfile",
        agentAction: "Generate lockfile",
        fixable: false,
        fingerprint: "fp-dep-1",
      },
    ];

    // Without accepted risk -> not-ready
    const unaccepted = evaluateGate(findings, [], MANDATORY_CATEGORIES);
    expect(unaccepted.status).toBe("not-ready");

    // With accepted risk -> production-ready
    const accepted = evaluateGate(findings, ["fp-dep-1"], MANDATORY_CATEGORIES);
    expect(accepted.status).toBe("production-ready");
    expect(accepted.summary.acceptedRisk).toBe(1);
  });

  it("should NOT allow risk acceptance to bypass mandatory categories (Section 8B)", () => {
    const findings: BiltCheckFinding[] = [
      {
        ruleId: "CHECK-SEC-001",
        category: "secrets-and-env",
        mode: "automated",
        severity: "critical",
        precision: "high",
        maturity: "stable",
        status: "fail",
        title: "Hardcoded secret",
        whyItMatters: "Data breach",
        technicalDetail: "Found secret",
        agentAction: "Rotate secret",
        fixable: true,
        fingerprint: "fp-sec-1",
      },
    ];

    // Even if fingerprint is in acceptedRiskIds, it must NOT bypass gate
    const result = evaluateGate(findings, ["fp-sec-1"], MANDATORY_CATEGORIES);
    expect(result.status).toBe("not-ready");
    expect(result.summary.acceptedRisk).toBe(0);
    expect(result.blockingFindings).toHaveLength(1);
  });
});
