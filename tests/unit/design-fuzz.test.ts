import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { buildDesignSnapshot } from "../../src/core/design/snapshot.js";
import { runDesignCheck } from "../../src/core/design/engine.js";

describe("Design Snapshot Builder Fuzz & Fail-Soft Properties", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bilt-design-fuzz-"));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("handles completely empty project gracefully", async () => {
    const snapshot = await buildDesignSnapshot(tempDir);
    expect(snapshot.routes).toEqual([]);
    expect(snapshot.components).toEqual([]);
    expect(snapshot.styles).toEqual([]);
    expect(snapshot.totalFilesScanned).toBe(0);

    const check = await runDesignCheck(tempDir);
    expect(check.status).toBe("pass");
    expect(check.findings).toHaveLength(0);
  });

  it("handles malformed JSON in package.json without crashing", async () => {
    fs.writeFileSync(path.join(tempDir, "package.json"), "{ invalid json: true, ");
    const snapshot = await buildDesignSnapshot(tempDir);
    expect(snapshot.framework).toBeUndefined();
  });

  it("handles corrupted or malformed JSX/HTML with unclosed tags and hostile strings", async () => {
    const hostileInputs = [
      "<div class=\"bg-purple-500<<<<<<>>>>>>>",
      "<div><button><Sparkles",
      "<img src=\"x\" onerror=\"alert(1)\"",
      "const x = `\u0000\u0001\u0002\u0003\u0004\u0005`;",
      "<!-- unclosed comment <section class=\"grid-cols-3\">",
      "<script>alert('test')</script><div class='rounded-3xl'>",
      "<div>".repeat(500) + "</div>".repeat(200),
    ];

    fs.mkdirSync(path.join(tempDir, "app"), { recursive: true });
    hostileInputs.forEach((content, i) => {
      fs.writeFileSync(path.join(tempDir, "app", `corrupted-${i}.tsx`), content);
    });

    const snapshot = await buildDesignSnapshot(tempDir);
    expect(snapshot).toBeDefined();
    expect(snapshot.components.length).toBeGreaterThan(0);

    // Rule evaluation against corrupted input must never throw
    const result = await runDesignCheck(tempDir);
    expect(["pass", "needs-improvement"]).toContain(result.status);
  });

  it("handles giant files without memory exhaustion", async () => {
    fs.mkdirSync(path.join(tempDir, "app"), { recursive: true });
    const giantContent = "export function Giant() { return (<div className=\"text-sm p-4\">" +
      "<span>Item</span>".repeat(10000) +
      "</div>); }";
    fs.writeFileSync(path.join(tempDir, "app", "giant.tsx"), giantContent);

    const snapshot = await buildDesignSnapshot(tempDir);
    expect(snapshot.components.length).toBe(1);
    expect(snapshot.totalFilesScanned).toBe(1);
  });
});
