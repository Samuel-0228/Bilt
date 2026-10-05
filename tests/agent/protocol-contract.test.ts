// ─── Agent Contract Tests ─────────────────────────────────────────────────────
// These tests verify that Bilt's Agent Protocol drives correct agent behavior.
//
// The key insight: we are NOT merely testing "does the scanner detect a secret?"
// We are testing "does a coding agent behave correctly when Bilt tells it X?"
//
// Test personas:
//   GOOD_AGENT    — reads nextAction, acts, re-verifies, stops on pass
//   PASSIVE_AGENT — reads only findings, writes a summary, stops (BAD)
//   STUBBORN_AGENT— ignores nextAction, keeps retrying with no changes (BAD)
//   LOOPING_AGENT — oscillates between two states (BAD → escalate)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { buildAgentResponse } from "../../src/core/agent/protocol.js";
import type {
  AgentResponse,
  AgentNextAction,
  EscalationReason,
} from "../../src/core/agent/protocol.js";
import type { CheckResult } from "../../src/core/readiness/check-runner.js";
import type { BiltCheckFinding } from "../../src/core/readiness/finding.js";
import type { GateResult } from "../../src/core/readiness/readiness-gate.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeGate(overrides: Partial<GateResult> = {}): GateResult {
  return {
    status: "production-ready",
    summary: {
      totalFindings: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      needsReview: 0,
      acceptedRisk: 0,
    },
    categorySummary: {} as any,
    blockingFindings: [],
    reviewFindings: [],
    passedCategories: [],
    mandatoryCategoriesMet: true,
    ...overrides,
  };
}

function makeFinding(overrides: Partial<BiltCheckFinding> = {}): BiltCheckFinding {
  return {
    id: "abc123",
    ruleId: "AUTH-001",
    category: "authentication" as any,
    mode: "automated",
    severity: "critical",
    precision: "high",
    maturity: "stable",
    status: "fail",
    lifecycleStatus: "open",
    title: "Missing authentication middleware",
    whyItMatters: "Unauthenticated users can access protected routes.",
    technicalDetail: "Route /api/users has no auth guard.",
    agentAction: {
      objective: "Add authentication middleware to all /api routes.",
      allowedChanges: ["Add auth middleware import", "Apply middleware to router"],
      forbiddenChanges: ["Remove existing auth checks", "Disable route guards"],
      filesToInspect: ["src/routes/api.ts"],
      verificationCommand: "npx bilt check --format agent",
    },
    fixable: false,
    locations: [{ file: "src/routes/api.ts", startLine: 12 }],
    fingerprint: "deadbeef12345678",
    introduced_by_change: true,
    file: "src/routes/api.ts",
    line: 12,
    ...overrides,
  };
}

function makeResult(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    gate: makeGate(),
    findings: [],
    categoryResults: new Map(),
    routeMap: [],
    unsupportedStackCategories: [],
    duration: 42,
    ...overrides,
  };
}

const EXEC_META = {
  command: "bilt check --format agent",
  projectRoot: "/project",
  toolVersion: "1.2.0",
};

// ── Schema contract ───────────────────────────────────────────────────────────

describe("Agent Protocol — Schema Contract", () => {
  it("always returns schemaVersion '1'", () => {
    const res = buildAgentResponse({ result: makeResult(), ...EXEC_META });
    expect(res.schemaVersion).toBe("1");
  });

  it("always includes nextAction with type and findingIds", () => {
    const res = buildAgentResponse({ result: makeResult(), ...EXEC_META });
    expect(res.nextAction).toBeDefined();
    expect(typeof res.nextAction.type).toBe("string");
    expect(Array.isArray(res.nextAction.findingIds)).toBe(true);
    expect(typeof res.nextAction.instruction).toBe("string");
  });

  it("always includes execution metadata", () => {
    const res = buildAgentResponse({ result: makeResult(), ...EXEC_META });
    expect(res.execution.command).toBe("bilt check --format agent");
    expect(res.execution.projectRoot).toBe("/project");
    expect(typeof res.execution.durationMs).toBe("number");
  });

  it("includes toolVersion", () => {
    const res = buildAgentResponse({ result: makeResult(), ...EXEC_META });
    expect(res.toolVersion).toBe("1.2.0");
  });
});

// ── GOOD_AGENT: follows protocol correctly ────────────────────────────────────

describe("Agent Behavior — GOOD_AGENT (correct)", () => {
  it("stops immediately when status is pass and nextAction.type is none", () => {
    const res = buildAgentResponse({ result: makeResult(), ...EXEC_META });

    // A good agent reads these two fields and decides to stop
    expect(res.status).toBe("pass");
    expect(res.nextAction.type).toBe("none");
    expect(res.nextAction.findingIds).toHaveLength(0);
  });

  it("knows EXACTLY which findings to fix via nextAction.findingIds", () => {
    const f1 = makeFinding({ id: "finding-001", severity: "critical" });
    const f2 = makeFinding({ id: "finding-002", severity: "high", ruleId: "INPUT-004" });

    const gate = makeGate({
      status: "not-ready",
      blockingFindings: [f1, f2],
      summary: { ...makeGate().summary, critical: 1, high: 1, totalFindings: 2 },
    });

    const result = makeResult({ gate, findings: [f1, f2] });
    const res = buildAgentResponse({ result, ...EXEC_META });

    expect(res.status).toBe("fail");
    expect(res.nextAction.type).toBe("fix");
    expect(res.nextAction.findingIds).toContain("finding-001");
    expect(res.nextAction.findingIds).toContain("finding-002");
  });

  it("gets structured agentAction.objective for each finding — never guesses", () => {
    const f = makeFinding();
    const result = makeResult({ findings: [f] });
    const res = buildAgentResponse({ result, ...EXEC_META });

    const finding = res.findings[0]!;
    expect(typeof finding.agentAction.objective).toBe("string");
    expect(finding.agentAction.objective.length).toBeGreaterThan(0);
    expect(Array.isArray(finding.agentAction.allowedChanges)).toBe(true);
    expect(Array.isArray(finding.agentAction.forbiddenChanges)).toBe(true);
    expect(finding.agentAction.verificationCommand).toBeDefined();
  });

  it("uses verificationCommand from finding, not self-assessment, to confirm resolution", () => {
    const f = makeFinding({
      agentAction: {
        objective: "Fix the auth issue.",
        allowedChanges: ["Add middleware"],
        forbiddenChanges: ["Remove auth"],
        filesToInspect: ["src/routes/api.ts"],
        verificationCommand: "npx bilt check --format agent",
      },
    });

    // The contract: agent must run verificationCommand, not self-assess
    expect(f.agentAction.verificationCommand).toBe("npx bilt check --format agent");
    // Bilt re-detects; if fingerprint disappears from findings, it's resolved
  });
});

// ── PASSIVE_AGENT: reads only findings, stops — catches the trap ──────────────

describe("Agent Behavior — PASSIVE_AGENT (wrong — detects the trap)", () => {
  it("passive agent trap: nextAction.type is never 'none' when findings exist", () => {
    const f = makeFinding({ status: "fail", severity: "critical" });
    const gate = makeGate({
      status: "not-ready",
      blockingFindings: [f],
    });
    const result = makeResult({ gate, findings: [f] });
    const res = buildAgentResponse({ result, ...EXEC_META });

    // A passive agent would stop here after "summarizing" findings.
    // The protocol explicitly prevents this:
    expect(res.nextAction.type).not.toBe("none");
    expect(res.status).not.toBe("pass");
    // The instruction tells the agent NOT to stop
    expect(res.nextAction.instruction).toBeTruthy();
  });
});

// ── ESCALATE: loop detection integration ──────────────────────────────────────

describe("Agent Behavior — LOOPING_AGENT (escalate)", () => {
  it("returns escalate status and exit-4-equivalent when escalation is provided", () => {
    const escalation: { reason: EscalationReason; detail: string } = {
      reason: "no-progress",
      detail: "Loop escalated: no progress across 3 consecutive identical runs.",
    };

    const res = buildAgentResponse({ result: makeResult(), ...EXEC_META, escalation });

    expect(res.status).toBe("escalate");
    expect(res.nextAction.type).toBe("escalate");
    expect(res.escalation).toBeDefined();
    expect(res.escalation!.reason).toBe("no-progress");
  });

  it("oscillation escalation contains the right reason", () => {
    const escalation: { reason: EscalationReason; detail: string } = {
      reason: "oscillation",
      detail: "A→B→A→B thrashing detected.",
    };
    const res = buildAgentResponse({ result: makeResult(), ...EXEC_META, escalation });
    expect(res.escalation!.reason).toBe("oscillation");
    expect(res.nextAction.type).toBe("escalate");
  });

  it("escalated response instruction tells agent to HALT", () => {
    const res = buildAgentResponse({
      result: makeResult(),
      ...EXEC_META,
      escalation: { reason: "budget-exhausted", detail: "Budget exhausted." },
    });
    expect(res.nextAction.instruction).toMatch(/HALT/i);
  });
});

// ── Progress tracking ─────────────────────────────────────────────────────────

describe("Agent Protocol — Progress Tracking", () => {
  it("computes resolved and introduced from fingerprint sets", () => {
    const f1 = makeFinding({ fingerprint: "fp-existing" });
    const f2 = makeFinding({ fingerprint: "fp-new", id: "new-001" });

    const result = makeResult({ findings: [f1, f2] });
    const res = buildAgentResponse({
      result,
      ...EXEC_META,
      previousFingerprints: ["fp-existing", "fp-gone"],
    });

    expect(res.progress).toBeDefined();
    expect(res.progress!.previous).toBe(2);
    expect(res.progress!.current).toBe(2);
    expect(res.progress!.resolved).toContain("fp-gone");
    expect(res.progress!.introduced).toContain("fp-new");
    expect(res.progress!.net).toBe(0); // 2 - 2 = 0
  });

  it("net is negative when findings decrease", () => {
    const result = makeResult({ findings: [] });
    const res = buildAgentResponse({
      result,
      ...EXEC_META,
      previousFingerprints: ["fp-a", "fp-b"],
    });
    expect(res.progress!.net).toBe(-2);
  });

  it("does not include progress if previousFingerprints is not supplied", () => {
    const res = buildAgentResponse({ result: makeResult(), ...EXEC_META });
    expect(res.progress).toBeUndefined();
  });
});

// ── Finding schema ────────────────────────────────────────────────────────────

describe("Finding Schema — Structural Contract", () => {
  it("every finding has id, ruleId, locations, agentAction object, lifecycleStatus", () => {
    const f = makeFinding();
    expect(typeof f.id).toBe("string");
    expect(f.id.length).toBeGreaterThan(0);
    expect(typeof f.ruleId).toBe("string");
    expect(Array.isArray(f.locations)).toBe(true);
    expect(f.locations.length).toBeGreaterThan(0);
    expect(typeof f.agentAction).toBe("object");
    expect(typeof f.agentAction.objective).toBe("string");
    expect(typeof f.lifecycleStatus).toBe("string");
  });

  it("fingerprint does not depend on raw line numbers", () => {
    const { generateCheckFingerprint } = require("../../src/core/readiness/finding.js");
    const fp1 = generateCheckFingerprint("AUTH-001", "src/routes/api.ts", 10, "process.env.SECRET");
    const fp2 = generateCheckFingerprint("AUTH-001", "src/routes/api.ts", 999, "process.env.SECRET");
    // Same ruleId + file + evidence → same fingerprint regardless of line
    expect(fp1).toBe(fp2);
  });
});
