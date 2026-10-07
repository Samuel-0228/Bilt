import { describe, it, expect } from "vitest";
import path from "node:path";
import { execa } from "execa";

const BILT_BIN = path.resolve(__dirname, "../../bin/bilt.js");
const GENERIC_FIXTURE = path.resolve(__dirname, "../fixtures/design/generic-app");
const INTENTIONAL_FIXTURE = path.resolve(__dirname, "../fixtures/design/intentional-app");

describe("Bilt CLI Design-Check Integration", () => {
  it("executes bilt design-check --format agent against generic fixture", async () => {
    const { stdout, exitCode } = await execa("node", [
      BILT_BIN,
      "design-check",
      GENERIC_FIXTURE,
      "--format",
      "agent",
    ], { reject: false });

    expect([1, 4]).toContain(exitCode);
    const parsed = JSON.parse(stdout);
    expect(parsed.schemaVersion).toBe("1");
    expect(parsed.summary.patternsDetected).toBeGreaterThan(0);
    expect(Array.isArray(parsed.findings)).toBe(true);
    expect(parsed.nextAction).toBeDefined();
    if (exitCode === 1) {
      expect(parsed.nextAction.type).toBe("fix");
    } else {
      expect(parsed.nextAction.type).toBe("escalate");
    }
    expect(parsed.findings[0].locations).toBeDefined();
    expect(parsed.findings[0].locations.length).toBeGreaterThan(0);
    expect(parsed.findings[0].locations[0].file).toBe("app/page.tsx");
  });

  it("executes bilt design-check --format human against intentional fixture", async () => {
    const { stdout, exitCode } = await execa("node", [
      BILT_BIN,
      "design-check",
      INTENTIONAL_FIXTURE,
      "--format",
      "human",
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("All clear");
  });

  it("executes bilt explain design and bilt explain design-genericity", async () => {
    const res1 = await execa("node", [BILT_BIN, "explain", "design"]);
    expect(res1.exitCode).toBe(0);
    expect(res1.stdout).toContain("Design & Anti-Vibecoding Quality");

    const res2 = await execa("node", [BILT_BIN, "explain", "design-genericity"]);
    expect(res2.exitCode).toBe(0);
    expect(res2.stdout).toContain("Design Genericity & Anti-Vibecoding");
  });

  it("executes bilt prompt and verifies design quality guidance is present", async () => {
    const { stdout, exitCode } = await execa("node", [BILT_BIN, "prompt"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("DESIGN QUALITY REQUIREMENT");
    expect(stdout).toContain("Do not default to recognizable AI-generated website patterns.");
    expect(stdout).toContain("bilt design-check");
  });
});
