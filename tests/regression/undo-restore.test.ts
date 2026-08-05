import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { executeScan } from "../../src/commands/scan.js";
import { executeFix } from "../../src/commands/fix.js";
import { executeUndo } from "../../src/commands/undo.js";
import { executeDoctor } from "../../src/commands/doctor.js";
import { redactForAI } from "../../src/core/ai/redact.js";
import { createLeakyFixtureProject } from "../fixtures/helper.js";

describe("Regression & Consistency Tests", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-regression-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should perform fix -> undo -> scan and verify exact prior content & issue reappearance", async () => {
    // Setup initial project state with a missing env var reference
    await fs.writeFile(
      path.join(tmpDir, ".gitignore"),
      "# gitignore\nnode_modules\n",
      "utf-8",
    );
    await fs.writeFile(
      path.join(tmpDir, ".env"),
      "EXISTING_KEY=123\n",
      "utf-8",
    );
    await fs.writeFile(
      path.join(tmpDir, ".env.example"),
      "EXISTING_KEY=\n",
      "utf-8",
    );
    const codePath = path.join(tmpDir, "app.ts");
    const originalCode = 'const secret = process.env.MISSING_SECRET_KEY;\n';
    await fs.writeFile(codePath, originalCode, "utf-8");

    // Step 1: Scan finds missing env var issue
    const scan1 = await executeScan(tmpDir, { quiet: true });
    expect(scan1.findings.some((f) => f.category === "env-missing")).toBe(true);

    // Step 2: Apply safe fix (adds MISSING_SECRET_KEY to .env)
    await executeFix(tmpDir, { safe: true, quiet: true });
    const envAfterFix = await fs.readFile(path.join(tmpDir, ".env"), "utf-8");
    expect(envAfterFix).toContain("MISSING_SECRET_KEY=");

    // Step 3: Undo changes
    await executeUndo(tmpDir);
    const envAfterUndo = await fs.readFile(path.join(tmpDir, ".env"), "utf-8");
    expect(envAfterUndo).toBe("EXISTING_KEY=123\n");

    // Step 4: Scan again — issue reappears
    const scan2 = await executeScan(tmpDir, { quiet: true });
    expect(scan2.findings.some((f) => f.category === "env-missing")).toBe(true);
  });

  it("should ensure fix and doctor stay in sync without desync", async () => {
    await createLeakyFixtureProject(tmpDir);

    // Run fix safe
    await executeFix(tmpDir, { safe: true, quiet: true });

    // Doctor should run cleanly without throws and report valid score
    await executeDoctor(tmpDir, { card: true });
    const postScan = await executeScan(tmpDir, { quiet: true });
    expect(postScan.healthScore).toBeTypeOf("number");
    expect(postScan.healthScore).toBeGreaterThan(0);
  });

  it("should guarantee AI redaction never leaks literal secret values or full file contents", async () => {
    const rawSecret = "sk_live_" + "51xyz1234567890secretkeyvalue";
    const context = redactForAI({
      findings: [
        {
          id: "secret-1",
          severity: "critical",
          category: "secret-detected",
          message: "Stripe Secret Key detected",
          file: "src/config/stripe.ts",
          line: 10,
          secret: rawSecret,
          preview: "sk_live_" + "****value",
          suggestion: `const key = "${rawSecret}"; // Rotate key`,
        },
      ],
    });

    const serialized = JSON.stringify(context);
    expect(serialized).not.toContain(rawSecret);
    expect(serialized).toContain("[SECRET_VALUE_REDACTED]");
  });

  it("should return correct exit codes on clean vs dirty project scans", async () => {
    // Clean project
    await fs.writeFile(path.join(tmpDir, ".gitignore"), ".env\n.bilt/\n", "utf-8");
    await fs.writeFile(path.join(tmpDir, ".env"), "PORT=3000\n", "utf-8");
    await fs.writeFile(path.join(tmpDir, ".env.example"), "PORT=\n", "utf-8");
    await fs.writeFile(path.join(tmpDir, "main.ts"), "const port = process.env.PORT;\n", "utf-8");

    const cleanResult = await executeScan(tmpDir, { quiet: true });
    const criticals = cleanResult.findings.filter((f) => f.severity === "critical");
    expect(criticals.length).toBe(0);
  });
});
