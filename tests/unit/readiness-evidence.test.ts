import { describe, it, expect } from "vitest";
import {
  checkCompleteness,
  checkUniqueness,
  checkExistence,
  checkTiming,
  validateEvidenceFabrication,
} from "../../src/core/readiness/evidence-validator.js";
import type { RouteMapEntry } from "../../src/core/readiness/check-runner.js";
import type { GuidedEvidence } from "../../src/core/readiness/evidence.js";

describe("Evidence Fabrication Heuristics (Section 14B)", () => {
  const sampleRouteMap: RouteMapEntry[] = [
    { method: "GET", path: "/api/users/:id", file: "src/api/users.ts", line: 10 },
    { method: "POST", path: "/api/orders/:id", file: "src/api/orders.ts", line: 20 },
  ];

  it("should fail completeness check when route count is less than route map", () => {
    const evidence: GuidedEvidence[] = [
      {
        ruleId: "AUTHZ-001",
        route: "/api/users/:id",
        method: "GET",
        evidence_location: "src/api/users.ts:12",
      },
    ];

    const result = checkCompleteness(evidence, sampleRouteMap);
    expect(result.passed).toBe(false);
    expect(result.message).toContain("Evidence incomplete");
  });

  it("should pass completeness when all routes have corresponding evidence", () => {
    const evidence: GuidedEvidence[] = [
      {
        ruleId: "AUTHZ-001",
        route: "/api/users/:id",
        method: "GET",
        evidence_location: "src/api/users.ts:12",
      },
      {
        ruleId: "AUTHZ-001",
        route: "/api/orders/:id",
        method: "POST",
        evidence_location: "src/api/orders.ts:22",
      },
    ];

    const result = checkCompleteness(evidence, sampleRouteMap);
    expect(result.passed).toBe(true);
  });

  it("should fail uniqueness check if identical evidence_location is reused across routes", () => {
    const evidence: GuidedEvidence[] = [
      {
        ruleId: "AUTHZ-001",
        route: "/api/users/:id",
        evidence_location: "src/auth/middleware.ts:15",
      },
      {
        ruleId: "AUTHZ-001",
        route: "/api/orders/:id",
        evidence_location: "src/auth/middleware.ts:15", // Duplicate!
      },
    ];

    const result = checkUniqueness(evidence);
    expect(result.passed).toBe(false);
    expect(result.message).toContain("Duplicate evidence location");
  });

  it("should fail existence check if file does not exist", async () => {
    const evidence: GuidedEvidence[] = [
      {
        ruleId: "AUTHZ-001",
        evidence_location: "nonexistent/file.ts:10",
      },
    ];

    const result = await checkExistence(evidence, process.cwd());
    expect(result.passed).toBe(false);
    expect(result.invalidLocations).toContain("nonexistent/file.ts:10");
  });

  it("should warn on suspiciously fast timing for large evidence sets", () => {
    const manyEvidence: GuidedEvidence[] = Array.from({ length: 25 }, (_, i) => ({
      ruleId: `RULE-${i}`,
      evidence_location: `file${i}.ts:1`,
    }));

    const start = new Date("2026-01-01T12:00:00Z").toISOString();
    const end = new Date("2026-01-01T12:00:05Z").toISOString(); // 5 seconds for 25 items!

    const result = checkTiming(manyEvidence, start, end);
    expect(result.warning).toBe(true);
  });
});
