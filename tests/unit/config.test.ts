import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadConfig, DEFAULT_CONFIG } from "../../src/config/config.js";

describe("Configuration Loader", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-config-test-"));
    process.chdir(tmpDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should load default configuration when no config file is found", async () => {
    const config = await loadConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("should load and merge configuration from .biltrc.json", async () => {
    const userConfig = {
      entropyThreshold: 5.2,
      historyDepth: 20,
      funMode: true,
      ignore: ["custom-ignore/**"],
    };

    await fs.writeFile(
      path.join(tmpDir, ".biltrc.json"),
      JSON.stringify(userConfig),
      "utf-8",
    );

    const config = await loadConfig();

    expect(config.entropyThreshold).toBe(5.2);
    expect(config.historyDepth).toBe(20);
    expect(config.funMode).toBe(true);
    expect(config.ignore).toContain("custom-ignore/**");
    expect(config.ignore).toContain("node_modules/**"); // Preserves defaults
  });
});
