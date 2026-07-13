import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  generateEnvExample,
  addToGitignore,
  addMissingEnvVars,
} from "../../src/core/fix/env-fix.js";
import { parseEnvFile } from "../../src/core/scan/env.js";
import { SECRET_RULES } from "../../src/core/rules/secret-rules.js";

describe("Environment Fix Utilities", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-env-fix-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("generateEnvExample", () => {
    it("should strip secrets but keep keys and comments", () => {
      const content = `
# Server Configuration
PORT=3000
# Stripe key
STRIPE_KEY=sk_test_${"4eC39HqLyjWDarjtT1zdp7dc"}
# Other setting
API_URL=https://api.example.com
      `.trim();

      const parsed = parseEnvFile(content, ".env");
      const example = generateEnvExample(parsed, SECRET_RULES, 4.5);

      expect(example).toContain("PORT=3000");
      expect(example).toContain("STRIPE_KEY=your-secret-here"); // Replaced with template placeholder
      expect(example).toContain("API_URL=https://api.example.com");
      expect(example).toContain("# Stripe key");
    });
  });

  describe("addToGitignore", () => {
    it("should add patterns to gitignore", async () => {
      const gitignorePath = path.join(tmpDir, ".gitignore");
      await fs.writeFile(gitignorePath, "node_modules\ndist\n", "utf-8");

      const result = await addToGitignore(
        [".env", ".env.local"],
        gitignorePath,
      );

      expect(result).toContain("node_modules");
      expect(result).toContain(".env");
      expect(result).toContain(".env.local");
    });

    it("should create new file if gitignore does not exist", async () => {
      const gitignorePath = path.join(tmpDir, ".gitignore");
      const result = await addToGitignore([".env"], gitignorePath);

      expect(result.trim()).toContain(".env");
    });
  });

  describe("addMissingEnvVars", () => {
    it("should append missing variables to file content", () => {
      const original = "A=1\nB=2\n";
      const result = addMissingEnvVars(original, ["C", "D"]);

      expect(result).toBe(
        "A=1\nB=2\n\n# Added by bilt — missing variables\nC=\nD=\n",
      );
    });
  });
});
