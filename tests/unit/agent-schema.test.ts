import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  formatAgentOutput,
  determineAgentStatus,
} from "../../src/core/output/formatters/agent.js";
import {
  statusToExitCode,
  EXIT_CODES,
  type AgentOutput,
} from "../../src/core/output/types.js";
import type { Finding } from "../../src/core/finding/types.js";

// Zod schema matching agent.schema.json for programmatic verification
const AgentOutputZod = z.object({
  schema_version: z.literal("1.0.0"),
  tool_version: z.string(),
  status: z.enum(["pass", "fail", "needs_review", "error", "escalate"]),
  iteration: z.number().int().min(1),
  summary: z.object({
    total_findings: z.number().int().min(0),
    introduced_findings: z.number().int().min(0),
    critical: z.number().int().min(0),
    warning: z.number().int().min(0),
    info: z.number().int().min(0),
    suppressed: z.number().int().min(0),
    tamper: z.number().int().min(0),
  }),
  findings: z.array(
    z.object({
      rule_id: z.string(),
      fingerprint: z.string(),
      severity: z.enum(["critical", "warning", "info"]),
      precision: z.enum(["high", "medium", "low"]),
      maturity: z.enum(["stable", "experimental"]),
      category: z.string(),
      file: z.string(),
      line: z.number().int().min(1),
      end_line: z.number().int().min(1),
      title: z.string(),
      explanation: z.string(),
      agent_action: z.string(),
      fixable: z.boolean(),
      introduced_by_change: z.boolean().optional(),
      untrusted_snippet: z.string().optional(),
    }),
  ),
  suppressed: z.array(
    z.object({
      rule_id: z.string(),
      fingerprint: z.string(),
      reason: z.string(),
      file: z.string(),
      line: z.number().int().optional(),
      expires: z.string().optional(),
    }),
  ),
  tamper: z.array(
    z.object({
      rule_id: z.string(),
      severity: z.enum(["critical", "warning"]),
      message: z.string(),
      file: z.string(),
      details: z.string().optional(),
    }),
  ),
  escalation_message: z.string().optional(),
});

describe("Agent Output Protocol & Schema", () => {
  it("should match published JSON schema structure and validate with Zod", async () => {
    const schemaPath = path.resolve(
      "src/core/output/schemas/agent.schema.json",
    );
    const rawSchema = await fs.readFile(schemaPath, "utf-8");
    const parsedSchema = JSON.parse(rawSchema);

    expect(parsedSchema.title).toBe("BiltAgentOutput");
    expect(parsedSchema.required).toContain("status");
    expect(parsedSchema.required).toContain("findings");

    const sampleFinding: Finding = {
      rule_id: "RULE-SEC-001",
      fingerprint: "a".repeat(64),
      severity: "critical",
      precision: "high",
      maturity: "stable",
      category: "secrets",
      file: "src/auth.ts",
      line: 14,
      end_line: 14,
      title: "Hardcoded Secret",
      explanation: "Static template explanation.",
      agent_action: "Static template action.",
      fixable: true,
      introduced_by_change: true,
    };

    const output = formatAgentOutput({
      toolVersion: "1.0.5",
      findings: [sampleFinding],
      iteration: 1,
    });

    const validated = AgentOutputZod.parse(output);
    expect(validated.status).toBe("fail");
    expect(validated.findings.length).toBe(1);
    expect(validated.summary.critical).toBe(1);
  });

  it("should enforce honest signaling: only stable high-precision produces FAIL", () => {
    // Experimental rule with critical severity -> NEEDS_REVIEW, not FAIL
    const experimentalFinding: Finding = {
      rule_id: "RULE-AUTH-001",
      fingerprint: "b".repeat(64),
      severity: "critical",
      precision: "high",
      maturity: "experimental",
      category: "authentication",
      file: "src/routes.ts",
      line: 20,
      end_line: 20,
      title: "Missing Auth Middleware",
      explanation: "Template",
      agent_action: "Template",
      fixable: false,
      introduced_by_change: true,
    };

    const status1 = determineAgentStatus([experimentalFinding], []);
    expect(status1).toBe("needs_review");

    // Medium precision -> NEEDS_REVIEW, not FAIL
    const mediumFinding: Finding = {
      ...experimentalFinding,
      maturity: "stable",
      precision: "medium",
    };
    const status2 = determineAgentStatus([mediumFinding], []);
    expect(status2).toBe("needs_review");

    // Stable + high precision -> FAIL
    const stableHighFinding: Finding = {
      ...experimentalFinding,
      maturity: "stable",
      precision: "high",
    };
    const status3 = determineAgentStatus([stableHighFinding], []);
    expect(status3).toBe("fail");

    // Tamper finding -> FAIL
    const status4 = determineAgentStatus(
      [],
      [
        {
          rule_id: "TAMPER-001",
          severity: "critical",
          message: "Config weakened",
          file: ".biltrc",
        },
      ],
    );
    expect(status4).toBe("fail");

    // Empty introduced findings -> PASS
    expect(determineAgentStatus([], [])).toBe("pass");
  });

  it("should hide pre-existing findings from findings list but keep them in summary count", () => {
    const preExistingFinding: Finding = {
      rule_id: "RULE-SEC-001",
      fingerprint: "c".repeat(64),
      severity: "critical",
      precision: "high",
      maturity: "stable",
      category: "secrets",
      file: "legacy.ts",
      line: 5,
      end_line: 5,
      title: "Legacy Secret",
      explanation: "Template",
      agent_action: "Template",
      fixable: false,
      introduced_by_change: false, // Pre-existing
    };

    const output = formatAgentOutput({
      toolVersion: "1.0.5",
      findings: [preExistingFinding],
      introducedOnly: true,
    });

    expect(output.status).toBe("pass"); // Pre-existing doesn't fail the agent!
    expect(output.findings.length).toBe(0); // Not listed
    expect(output.summary.total_findings).toBe(1); // But counted in total
    expect(output.summary.introduced_findings).toBe(0);
  });

  it("should map exit codes correctly", () => {
    expect(statusToExitCode("pass")).toBe(EXIT_CODES.PASS); // 0
    expect(statusToExitCode("fail")).toBe(EXIT_CODES.FAIL); // 1
    expect(statusToExitCode("needs_review")).toBe(EXIT_CODES.NEEDS_REVIEW); // 2
    expect(statusToExitCode("error")).toBe(EXIT_CODES.ERROR); // 3
    expect(statusToExitCode("escalate")).toBe(EXIT_CODES.ESCALATE); // 4
  });
});
