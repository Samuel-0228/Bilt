import { describe, it, expect } from "vitest";
import { MCP_TOOLS, handleMcpToolCall } from "../../src/mcp/server.js";

describe("Model Context Protocol (MCP) Server", () => {
  it("should expose all required MCP tools with schemas", () => {
    const toolNames = MCP_TOOLS.map((t) => t.name);

    expect(toolNames).toContain("bilt_check");
    expect(toolNames).toContain("bilt_explain");
    expect(toolNames).toContain("bilt_list_rules");
    expect(MCP_TOOLS.length).toBe(3);
  });

  it("should execute bilt_list_rules and return rule definitions", async () => {
    const res = await handleMcpToolCall("bilt_list_rules");

    expect(res.isError).toBeFalsy();
    expect(res.content.length).toBe(1);

    const parsed = JSON.parse(res.content[0]!.text);
    expect(Array.isArray(parsed)).toBe(true);

    const ruleIds = parsed.map((r: any) => r.rule_id);
    expect(ruleIds).toContain("RULE-SEC-001");
    expect(ruleIds).toContain("RULE-AUTH-001");
  });

  it("should execute bilt_explain and return static rule template", async () => {
    const res = await handleMcpToolCall("bilt_explain", {
      rule_id: "RULE-SEC-001",
    });

    expect(res.isError).toBeFalsy();
    const parsed = JSON.parse(res.content[0]!.text);

    expect(parsed.rule_id).toBe("RULE-SEC-001");
    expect(parsed.precision).toBe("high");
    expect(parsed.maturity).toBe("stable");
    expect(parsed.explanation).toContain("Hardcoded secrets");
    expect(parsed.agent_action).toContain("Remove the hardcoded secret");
  });

  it("should return error for missing rule_id in bilt_explain", async () => {
    const res = await handleMcpToolCall("bilt_explain", {});
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("rule_id argument is required");
  });

  it("should return error for unknown tool call", async () => {
    const res = await handleMcpToolCall("non_existent_tool");
    expect(res.isError).toBe(true);
    expect(res.content[0]!.text).toContain("Unknown tool");
  });

  it("should execute bilt_check and return agent output", async () => {
    const res = await handleMcpToolCall("bilt_check", { dir: "." });

    expect(res.isError).toBeFalsy();
    const parsed = JSON.parse(res.content[0]!.text);

    expect(parsed.schema_version).toBe("1.0.0");
    expect(parsed.status).toBeDefined();
    expect(Array.isArray(parsed.findings)).toBe(true);
  });
});
