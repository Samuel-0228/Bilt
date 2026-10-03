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
      <button className="outline-none">
        <svg><path d="M0 0" /></svg>
      </button>
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
    expect(fixes.length).toBeGreaterThanOrEqual(3);

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
  });
});
