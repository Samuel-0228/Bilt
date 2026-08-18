import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { executeScan } from "../../src/commands/scan";
import { executeFix } from "../../src/commands/fix";

describe("Security Rules & Expanded Auto-Fix Integration Tests", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-sec-fix-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should detect SEC-CRY-001 (Math.random token) and automatically fix it", async () => {
    const jsPath = path.join(tmpDir, "token.js");
    await fs.writeFile(
      jsPath,
      'const generateToken = () => Math.random().toString(36).substring(2);',
      "utf-8"
    );

    // Initial scan should detect weak PRNG
    const preScan = await executeScan(tmpDir, { quiet: true });
    const cryFindings = preScan.findings.filter((f) => f.ruleId === "SEC-CRY-001");
    expect(cryFindings.length).toBe(1);

    // Execute fix in safe mode
    await executeFix(tmpDir, { safe: true, quiet: true });

    // File content should now use crypto.randomBytes
    const fixedContent = await fs.readFile(jsPath, "utf-8");
    expect(fixedContent).not.toContain("Math.random().toString(36)");
    expect(fixedContent).toContain("randomBytes");

    // Post scan should be clear of SEC-CRY-001
    const postScan = await executeScan(tmpDir, { quiet: true });
    const postCryFindings = postScan.findings.filter((f) => f.ruleId === "SEC-CRY-001");
    expect(postCryFindings.length).toBe(0);
  });

  it("should remove unused dependency from package.json", async () => {
    const pkgPath = path.join(tmpDir, "package.json");
    const jsPath = path.join(tmpDir, "app.js");

    await fs.writeFile(
      pkgPath,
      JSON.stringify(
        {
          name: "test-app",
          version: "1.0.0",
          dependencies: {
            express: "^4.18.2",
            "unused-dep-pkg": "^1.0.0",
          },
        },
        null,
        2
      ),
      "utf-8"
    );

    await fs.writeFile(jsPath, 'const express = require("express");', "utf-8");

    // Execute scan
    const preScan = await executeScan(tmpDir, { quiet: true });
    const unusedDepFindings = preScan.findings.filter((f) => f.category === "dep-unused");
    expect(unusedDepFindings.length).toBe(1);

    // Apply fixes
    await executeFix(tmpDir, { safe: true, quiet: true });

    // Verify package.json
    const fixedPkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
    expect(fixedPkg.dependencies["unused-dep-pkg"]).toBeUndefined();
    expect(fixedPkg.dependencies["express"]).toBeDefined();
  });
});
