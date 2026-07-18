import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { executeScan } from "../../src/commands/scan";
import { executeFix } from "../../src/commands/fix";

describe("Fix Verification Integration Tests", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-fix-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should successfully apply the env-missing fix to the .env file and resolve the finding", async () => {
    // 1. Setup a project with a missing environment variable
    const jsPath = path.join(tmpDir, "index.js");
    const envPath = path.join(tmpDir, ".env");
    
    // Code references process.env.API_KEY, but it's not in .env
    await fs.writeFile(jsPath, 'console.log(process.env.API_KEY);', "utf-8");
    await fs.writeFile(envPath, 'EXISTING_KEY=1', "utf-8");

    // 2. Initial scan should detect the missing env var
    const preScan = await executeScan(tmpDir, { quiet: true });
    
    const missingFindings = preScan.findings.filter(f => f.category === "env-missing");
    expect(missingFindings.length).toBeGreaterThan(0);
    expect(missingFindings.some(f => f.message.includes("API_KEY"))).toBe(true);

    // 3. Apply fixes programmatically
    await executeFix(tmpDir, { safe: true, quiet: true });

    // 4. Verify the .env file was actually updated
    const envContent = await fs.readFile(envPath, "utf-8");
    expect(envContent).toContain("API_KEY=");

    // 5. Secondary scan should be entirely clean of env-missing
    const postScan = await executeScan(tmpDir, { quiet: true });
    
    const postMissingFindings = postScan.findings.filter(f => f.category === "env-missing");
    expect(postMissingFindings.length).toBe(0);
  });
});
