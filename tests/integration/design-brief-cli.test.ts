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
});
