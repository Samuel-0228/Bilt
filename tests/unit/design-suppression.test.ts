import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import { runDesignCheck } from "../../src/core/design/engine.js";
import { resetLoopState } from "../../src/core/loop/state.js";
import { clearConfigCache } from "../../src/config/config.js";

const SUPPRESSION_FIXTURE = path.resolve(
  __dirname,
  "../fixtures/design/suppression-test-app",
);

describe("Design Check Suppressions & Intentional Exceptions", () => {
  const configPath = path.join(SUPPRESSION_FIXTURE, ".biltrc.json");

  beforeEach(async () => {
    clearConfigCache();
    await fs.mkdir(path.join(SUPPRESSION_FIXTURE, "app"), { recursive: true });
    await fs.writeFile(
      path.join(SUPPRESSION_FIXTURE, "app/page.tsx"),
      `export default function Page() {
        return <div className="bg-[#09090b] text-purple-400">Dark purple theme</div>;
      }`,
      "utf-8",
    );
    await resetLoopState(SUPPRESSION_FIXTURE);
  });

  afterEach(async () => {
    clearConfigCache();
    try {
      await fs.rm(SUPPRESSION_FIXTURE, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it("suppresses a finding when an explicit valid reason is provided", async () => {
    const config = {
      designCheck: {
        ignore: ["DESIGN-VISUAL-002"],
        reason: {
          "DESIGN-VISUAL-002": "Dark aesthetic is intentional brand guideline for nighttime developers.",
        },
      },
    };
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");

    const result = await runDesignCheck(SUPPRESSION_FIXTURE);
    const activeIds = result.findings.map((f) => f.ruleId);
    expect(activeIds).not.toContain("DESIGN-VISUAL-002");

    const suppressed = result.suppressed.find((s) => s.ruleId === "DESIGN-VISUAL-002");
    expect(suppressed).toBeDefined();
    expect(suppressed?.reason).toContain("Dark aesthetic is intentional");
  });

  it("rejects suppression if reason is missing or empty string", async () => {
    const config = {
      designCheck: {
        ignore: ["DESIGN-VISUAL-002"],
        reason: {
          "DESIGN-VISUAL-002": "   ", // Blank whitespace
        },
      },
    };
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");

    const result = await runDesignCheck(SUPPRESSION_FIXTURE);
    const activeIds = result.findings.map((f) => f.ruleId);
    // Finding MUST remain active
    expect(activeIds).toContain("DESIGN-VISUAL-002");
    expect(result.suppressed.some((s) => s.ruleId === "DESIGN-VISUAL-002")).toBe(false);
  });

  it("rejects ignoreAll: true and never silently passes", async () => {
    const config = {
      designCheck: {
        ignoreAll: true,
        ignore: ["*"],
      },
    };
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");

    const result = await runDesignCheck(SUPPRESSION_FIXTURE);
    // Findings must still be present, status must NOT silently pass
    expect(result.status).toBe("needs-improvement");
    expect(result.findings.length).toBeGreaterThan(0);
  });
});
