import { describe, it, expect } from "vitest";
import path from "node:path";
import { executeApiScan } from "../../src/commands/api-scan.js";
import { executeDoctor } from "../../src/commands/doctor.js";
import { executeScan } from "../../src/commands/scan.js";

const FIXTURE_DIR = path.resolve(__dirname, "../fixtures/vulnerable-api-app");

describe("bilt api-scan CLI Integration", () => {
  it("should run bilt api-scan and return structured findings and health score", async () => {
    const result = await executeApiScan(FIXTURE_DIR, { quiet: true });
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.healthScore).toBeLessThan(100);
    expect(result.domainScores.security).toBeLessThan(100);
  });

  it("should integrate API security findings into main bilt scan step", async () => {
    const result = await executeScan(FIXTURE_DIR, { quiet: true });
    const apiFindings = result.findings.filter((f) => f.category.startsWith("api-"));
    expect(apiFindings.length).toBeGreaterThan(0);
    expect(result.domainScores.security).toBeLessThan(100);
  });
});
