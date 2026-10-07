import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import { applyDesignSafeFixes } from "../../src/core/design/fix.js";

const FIX_FIXTURE_DIR = path.resolve(__dirname, "../fixtures/design/fix-test-app");

describe("Design Check Automated Safe Fixes (--fix)", () => {
  beforeEach(async () => {
    await fs.mkdir(path.join(FIX_FIXTURE_DIR, "src"), { recursive: true });
    const content = `
import React from 'react';

export function BrokenComponent() {
  return (
    <div>
      <div className="absolute top-0 w-72 h-72 rounded-full bg-purple-600/20 blur-3xl" />
      <h1 className="text-5xl bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
        Vibecoded Title
      </h1>
      <button className="outline-none hover:scale-105">
        <svg><path d="M0 0" /></svg>
      </button>
      <div className="rounded-3xl p-6 border">
        <span>24 people viewing right now</span>
      </div>
      <img src="/avatar.jpg" className="w-10 h-10" />
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
    </div>
  );
}
`;
    await fs.writeFile(
      path.join(FIX_FIXTURE_DIR, "src/Broken.tsx"),
      content,
      "utf-8",
    );
  });

  afterEach(async () => {
    try {
      await fs.rm(FIX_FIXTURE_DIR, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it("applies deterministic safe fixes to aria-label, img alt, and focus styles", async () => {
    const fixes = await applyDesignSafeFixes(FIX_FIXTURE_DIR);
    expect(fixes.length).toBeGreaterThanOrEqual(6);

    const fixedContent = await fs.readFile(
      path.join(FIX_FIXTURE_DIR, "src/Broken.tsx"),
      "utf-8",
    );

    // 1. Accessibility label added
    expect(fixedContent).toContain('aria-label="Action"');
    // 2. Alt attribute added
    expect(fixedContent).toContain('alt=""');
    // 3. Focus-visible outline replacement added
    expect(fixedContent).toContain("focus-visible:ring-2");
    // 4. Lorem ipsum replaced with semantic placeholder
    expect(fixedContent).not.toContain("Lorem ipsum dolor sit amet");
    // 5. Gradient text replaced with solid high-contrast typography
    expect(fixedContent).not.toContain("bg-clip-text text-transparent");
    expect(fixedContent).toContain("text-foreground font-semibold");
    // 6. Non-functional decorative blur orb neutralized
    expect(fixedContent).toContain("Decorative background blur removed by Bilt");
    // 7. Extreme container corner radius calibrated to rounded-xl
    expect(fixedContent).not.toContain("rounded-3xl");
    expect(fixedContent).toContain("rounded-xl");
    // 8. Hover scale jitter normalized to subtle border transition
    expect(fixedContent).not.toContain("hover:scale-105");
    // 9. Fake viewer activity count replaced with operational status
    expect(fixedContent).not.toContain("24 people viewing right now");
    expect(fixedContent).toContain("All systems operational");
  });
});
