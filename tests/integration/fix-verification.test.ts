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

  it("should successfully purge a secret from Git history using purgeSecretFromHistory", async () => {
    const { execSync } = await import("node:child_process");

    // 1. Initialize a git repo in tmpDir
    execSync("git init", { cwd: tmpDir });
    execSync("git config user.name 'Test'", { cwd: tmpDir });
    execSync("git config user.email 'test@test.com'", { cwd: tmpDir });

    const jsPath = path.join(tmpDir, "index.js");
    const fakeSecret = "sk-1234567890abcdef1234567890abcdef1234567890abcdef"; // Matches OpenAI Secret Key pattern /sk-[a-zA-Z0-9]{20,}/
    
    await fs.writeFile(jsPath, `const key = "${fakeSecret}";`, "utf-8");
    execSync("git add index.js", { cwd: tmpDir });
    execSync('git commit -m "Initial_commit_with_secret"', { cwd: tmpDir });

    // 2. Scan history to find the secret
    const preScan = await executeScan(tmpDir, { quiet: true, fullHistory: true, retainSecrets: true });
    const secretFindings = preScan.findings.filter(f => f.category === "secret-detected");
    expect(secretFindings.length).toBeGreaterThan(0);
    expect(secretFindings[0].secret).toBe(fakeSecret);

    // 3. Apply fixes programmatically via executeFix (which calls executeScan with retainSecrets)
    await executeFix(tmpDir, { debug: true });

    // 4. Verify the secret is redacted in the git repository's HEAD commit
    const committedContent = execSync("git show HEAD:index.js", { cwd: tmpDir }).toString();
    expect(committedContent).not.toContain(fakeSecret);
    expect(committedContent).toContain("[REDACTED_BY_BILT]");
  });
});
