import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { startWatcher } from "../../src/core/watch/watcher.js";
import { DEFAULT_CONFIG } from "../../src/config/config.js";
import type { WatchEvent } from "../../src/types/index.js";

describe("Watcher Integration Tests", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "bilt-watcher-integration-"),
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should start watcher, detect secret when file is added, and close gracefully", async () => {
    const events: WatchEvent[] = [];
    const watcher = startWatcher(tmpDir, DEFAULT_CONFIG, (event) => {
      events.push(event);
    });

    // Allow chokidar watcher to initialize
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      // Write a leaky file
      const stripeSecretVal = "sk_" + "test_4eC39HqLyjWDarjtT1zdp7dc";
      const leakyFile = path.join(tmpDir, "keys.js");
      await fs.writeFile(
        leakyFile,
        `const key = "${stripeSecretVal}";`,
        "utf-8",
      );

      // Wait for debounced watch event (configured for 300ms in watcher, let's wait 1.5s)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      expect(events.length).toBeGreaterThan(0);
      const firstEvent = events[0]!;
      expect(firstEvent.file).toContain("keys.js");
      expect(firstEvent.findings.length).toBeGreaterThan(0);
      expect(firstEvent.findings[0]?.category).toBe("secret-detected");
    } finally {
      await watcher.close();
    }
  });
});
