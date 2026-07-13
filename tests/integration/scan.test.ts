import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { executeScan } from "../../src/commands/scan.js";
import {
  createLeakyFixtureProject,
  createNextjsFixtureProject,
} from "../fixtures/helper.js";

describe("Scan Integration Tests", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-scan-integration-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should scan a clean project and return perfect score", async () => {
    // Copy clean-project files
    const cleanSource = path.resolve(__dirname, "../fixtures/clean-project");
    await fs.mkdir(path.join(tmpDir, "src"), { recursive: true });
    await fs.copyFile(
      path.join(cleanSource, ".gitignore"),
      path.join(tmpDir, ".gitignore"),
    );
    await fs.copyFile(
      path.join(cleanSource, "package.json"),
      path.join(tmpDir, "package.json"),
    );
    await fs.copyFile(
      path.join(cleanSource, "src/index.ts"),
      path.join(tmpDir, "src/index.ts"),
    );
    await fs.copyFile(
      path.join(cleanSource, ".env-source"),
      path.join(tmpDir, ".env"),
    );
    await fs.copyFile(
      path.join(cleanSource, ".env.example"),
      path.join(tmpDir, ".env.example"),
    );

    const result = await executeScan(tmpDir, { quiet: true });

    expect(result.healthScore).toBe(100);
    expect(result.grade).toBe("A+");
    expect(result.findings.length).toBe(0);
  });

  it("should scan a leaky project and find issues", async () => {
    await createLeakyFixtureProject(tmpDir);

    const result = await executeScan(tmpDir, { quiet: true });

    expect(result.healthScore).toBeLessThan(100);
    expect(result.findings.length).toBeGreaterThan(0);

    const categories = result.findings.map((f) => f.category);
    expect(categories).toContain("secret-detected");
    expect(categories).toContain("env-mismatch");
    expect(categories).toContain("gitignore-missing"); // Since .gitignore doesn't exist
  });

  it("should check client-exposed secrets in frameworks", async () => {
    await createNextjsFixtureProject(tmpDir);

    const result = await executeScan(tmpDir, { quiet: true });

    // Next.js detected, NEXT_PUBLIC_STRIPE_KEY is matched as Stripe key
    const clientExposed = result.findings.filter(
      (f) => f.category === "env-exposed",
    );
    expect(clientExposed.length).toBeGreaterThan(0);
  });
});
