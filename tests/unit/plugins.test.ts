import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { validatePlugin } from "../../src/plugins/interface.js";
import dockerPlugin from "../../src/plugins/official/docker.js";
import terraformPlugin from "../../src/plugins/official/terraform.js";
import type { PluginContext } from "../../src/types/index.js";

describe("Plugin System", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-plugins-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("validatePlugin", () => {
    it("should validate correctly formatted plugins", () => {
      const validPlugin = {
        name: "test-plugin",
        version: "1.0.0",
        description: "tests validation",
        check: async () => ({ findings: [] }),
      };

      expect(validatePlugin(validPlugin)).toBe(true);
    });

    it("should reject invalid plugins missing check function", () => {
      const invalidPlugin = {
        name: "invalid",
        version: "1.0.0",
      };

      expect(validatePlugin(invalidPlugin)).toBe(false);
    });
  });

  describe("official/docker", () => {
    it("should find hardcoded secrets in Dockerfile", async () => {
      const dockerfileContent = `
        FROM node:18
        ENV API_KEY="sk_test_${"4eC39HqLyjWDarjtT1zdp7dc"}"
        COPY . .
      `;

      await fs.writeFile(
        path.join(tmpDir, "Dockerfile"),
        dockerfileContent,
        "utf-8",
      );

      // Mock plugin context
      const context: PluginContext = {
        rootDir: tmpDir,
        files: ["Dockerfile"],
        envVars: [],
        git: null as any,
        config: {} as any,
      };

      const result = await dockerPlugin.check(context);

      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.findings[0]?.category).toBe("plugin-finding");
    });
  });

  describe("official/terraform", () => {
    it("should find hardcoded secrets in TF files", async () => {
      const tfContent = `
        provider "aws" {
          region     = "us-west-2"
          access_key = "AKIAIOSFODNN7EXAMPLE"
          secret_key = "secret12345secret12345secret12345secret12"
        }
      `;

      await fs.writeFile(path.join(tmpDir, "main.tf"), tfContent, "utf-8");

      const context: PluginContext = {
        rootDir: tmpDir,
        files: ["main.tf"],
        envVars: [],
        git: null as any,
        config: {} as any,
      };

      const result = await terraformPlugin.check(context);

      expect(result.findings.length).toBeGreaterThan(0);
    });
  });
});
