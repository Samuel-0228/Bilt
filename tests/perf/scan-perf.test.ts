import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { scanFileForSecrets } from "../../src/core/scan/secrets.js";
import { parseEnvFile } from "../../src/core/scan/env.js";
import { executeScan } from "../../src/commands/scan.js";
import { SECRET_RULES } from "../../src/core/rules/secret-rules.js";
import { DEFAULT_CONFIG } from "../../src/config/config.js";

describe("Performance Threshold Tests", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-perf-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should scan a 10,000-line file for secrets in < 500ms", () => {
    let largeContent = "";
    for (let i = 0; i < 10000; i++) {
      if (i === 5000) {
        // Plant a secret
        largeContent +=
          'const stripeKey = "sk_test_' + '4eC39HqLyjWDarjtT1zdp7dc";\n';
      } else {
        largeContent += `const var${i} = "value${i}"; // line comment ${i}\n`;
      }
    }

    const start = performance.now();
    const findings = scanFileForSecrets(
      largeContent,
      "large-file.js",
      SECRET_RULES,
      DEFAULT_CONFIG.entropyThreshold,
    );
    const duration = performance.now() - start;

    expect(findings.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(500); // Must complete in under 500ms
  });

  it("should parse 100 env files in < 200ms", () => {
    const envContents: string[] = [];
    for (let i = 0; i < 100; i++) {
      let content = "";
      for (let j = 0; j < 50; j++) {
        content += `VAR_${j}=value_${j}_${Math.random()}\n`;
      }
      envContents.push(content);
    }

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      parseEnvFile(envContents[i]!, `env-${i}.env`);
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(200); // Must parse 100 env files in under 200ms
  });

  it("should scan a 50-file project tree in < 5s", async () => {
    // Generate 50 clean files
    await fs.mkdir(path.join(tmpDir, "src"), { recursive: true });
    for (let i = 0; i < 50; i++) {
      const filePath = path.join(tmpDir, `src/file_${i}.ts`);
      await fs.writeFile(
        filePath,
        `export const val_${i} = "clean-value";\n`,
        "utf-8",
      );
    }

    const start = performance.now();
    const result = await executeScan(tmpDir, { quiet: true });
    const duration = performance.now() - start;

    expect(result.healthScore).toBe(100);
    expect(duration).toBeLessThan(5000); // Must complete in under 5 seconds
  });
});
