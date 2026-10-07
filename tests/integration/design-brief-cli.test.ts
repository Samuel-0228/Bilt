import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";

describe("Design Brief CLI", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-cli-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("reports no brief configured in agent mode", () => {
    const cmd = `node ${path.resolve("bin/bilt.js")} design-brief --format agent --non-interactive ${tmpDir}`;
    const output = execSync(cmd).toString();
    const result = JSON.parse(output);
    
    expect(result.schemaVersion).toBe("1");
    expect(result.configured).toBe(false);
    expect(result.agentInstructions).toContain("No Bilt Design Brief exists");
  });

  it("reports correctly in human mode when no brief", () => {
    const cmd = `node ${path.resolve("bin/bilt.js")} design-brief --non-interactive ${tmpDir}`;
    const output = execSync(cmd).toString();
    expect(output).toContain("No Bilt Design Brief exists");
  });

  it("shows correct format when brief is configured", async () => {
    const biltDir = path.join(tmpDir, ".bilt");
    await fs.mkdir(biltDir);
    const brief = {
      schemaVersion: "1",
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z",
      purpose: { value: "test", source: "developer" },
      audience: { value: null, source: "not-provided" },
      visualDirection: { value: ["minimal"], source: "developer" },
      brandColors: { value: ["#ff0000"], source: "developer", type: "requirement" },
      desiredFeeling: { value: null, source: "not-provided" },
      creativeFreedom: "guided",
    };
    await fs.writeFile(path.join(biltDir, "design-brief.json"), JSON.stringify(brief));

    const cmdAgent = `node ${path.resolve("bin/bilt.js")} design-brief --format agent --non-interactive ${tmpDir}`;
    const outputAgent = execSync(cmdAgent).toString();
    const resultAgent = JSON.parse(outputAgent);
    
    expect(resultAgent.configured).toBe(true);
    expect(resultAgent.purpose).toBe("test");
    expect(resultAgent.constraints).toHaveLength(1);

    const cmdHuman = `node ${path.resolve("bin/bilt.js")} design-brief --non-interactive ${tmpDir}`;
    const outputHuman = execSync(cmdHuman).toString();
    expect(outputHuman).toContain("Purpose:      test");
    expect(outputHuman).toContain("Visual:       minimal");
  });

  it("outputs structured questionnaire in agent mode", () => {
    const cmd = `node ${path.resolve("bin/bilt.js")} design-brief questionnaire --format agent ${tmpDir}`;
    const output = execSync(cmd).toString();
    const result = JSON.parse(output);

    expect(result.schemaVersion).toBe("1");
    expect(Array.isArray(result.questions)).toBe(true);
    expect(result.questions).toHaveLength(4);
    expect(result.questions[0].id).toBe("purpose");
    expect(result.questions[1].id).toBe("visual");
    expect(result.questions[2].id).toBe("colors");
    expect(result.questions[3].id).toBe("feeling");
    expect(result.agentInstruction).toContain("npx bilt design-brief set");
  });

  it("prints human-readable questionnaire in human mode", () => {
    const cmd = `node ${path.resolve("bin/bilt.js")} design-brief questionnaire ${tmpDir}`;
    const output = execSync(cmd).toString();

    expect(output).toContain("BILT DESIGN INTENT QUESTIONNAIRE");
    expect(output).toContain("Purpose & Audience");
    expect(output).toContain("Visual Direction");
    expect(output).toContain("Brand Colors");
    expect(output).toContain("Desired Feeling");
    expect(output).toContain("npx bilt design-brief set");
  });

  it("does not contain agent-controlled escape hatch in agent instructions", () => {
    const cmd = `node ${path.resolve("bin/bilt.js")} design-brief --format agent --non-interactive ${tmpDir}`;
    const output = execSync(cmd).toString();
    const result = JSON.parse(output);

    expect(result.agentInstructions).not.toContain("agent-controlled");
    expect(result.agentInstructions).toContain("MANDATORY CHECKPOINT BEFORE UI WORK");
    expect(result.agentInstructions).toContain("DO NOT SKIP OR BYPASS THIS INTERVIEW");
  });
});
