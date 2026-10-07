// ─── Automated Safe Fixer for Design & Production UX Issues ─────────────────
// Deterministic safe modifications only. Does NOT blindly redesign or change visual identity.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";

export interface FixApplyResult {
  file: string;
  ruleId: string;
  description: string;
}

export async function applyDesignSafeFixes(rootDir: string): Promise<FixApplyResult[]> {
  const normalizedRoot = path.resolve(rootDir);
  const files = await fg(["**/*.{tsx,jsx,html,vue,svelte}"], {
    cwd: normalizedRoot,
    ignore: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.next/**", "**/.git/**"],
    absolute: true,
  });

  const appliedFixes: FixApplyResult[] = [];

  for (const filePath of files) {
    const rel = path.relative(normalizedRoot, filePath).replace(/\\/g, "/");
    let content: string;
    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch {
      continue;
    }

    let modified = content;

    // 1. Fix missing alt attributes on <img>
    // <img src="..." /> without alt
    const imgRegex = /<img(?![^>]*\balt=)([^>]+)>/gi;
    if (imgRegex.test(modified)) {
      modified = modified.replace(imgRegex, `<img alt=""$1>`);
      appliedFixes.push({
        file: rel,
        ruleId: "A11Y-UI-003",
        description: 'Added missing alt="" attribute to <img> tag',
      });
    }

    // 2. Fix missing aria-label on icon-only buttons
    // Preserves exact tag casing (<button> vs <Button>)
    const buttonIconRegex =
      /<(button|Button)(?![^>]*\baria-label=)([^>]*)>(\s*<(?:[A-Z][a-zA-Z0-9]*Icon|Sparkles|Check|ArrowRight|X|Menu|Trash)[^>]*\/>|\s*<svg[^>]*>[\s\S]*?<\/svg>)(\s*)<\/\1>/g;
    if (buttonIconRegex.test(modified)) {
      modified = modified.replace(buttonIconRegex, `<$1 aria-label="Action"$2>$3$4</$1>`);
      appliedFixes.push({
        file: rel,
        ruleId: "A11Y-UI-001",
        description: 'Added accessible aria-label="Action" to icon-only button',
      });
    }

    // 3. Fix outline-none without focus-visible
    // Replace standalone "outline-none" or "focus:outline-none" with focus-visible ring
    if (
      /outline-none/.test(modified) &&
      !/focus-visible:|focus:ring/.test(modified)
    ) {
      modified = modified.replace(
        /\boutline-none\b/g,
        "outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
      );
      appliedFixes.push({
        file: rel,
        ruleId: "A11Y-UI-002",
        description: "Added focus-visible:ring-2 visible focus indicator alongside outline-none",
      });
    }

    // 4. Safe placeholder text cleanup
    if (/Lorem ipsum dolor sit amet/i.test(modified)) {
      modified = modified.replace(/Lorem ipsum dolor sit amet[^\n"']*/gi, "Product overview and workflow details.");
      appliedFixes.push({
        file: rel,
        ruleId: "CONTENT-QUALITY-001",
        description: "Replaced raw 'Lorem ipsum' placeholder copy with semantic placeholder",
      });
    }

    // 5. Replace generic low-contrast gradient text with solid high-contrast typography
    const gradientTextRegex =
      /\b(?:bg-gradient-to-[a-z]+(?:\s+from-[a-z0-9/\[\]_-]+)?(?:\s+via-[a-z0-9/\[\]_-]+)?(?:\s+to-[a-z0-9/\[\]_-]+)?\s+bg-clip-text\s+text-transparent|bg-clip-text\s+text-transparent\s+bg-gradient-to-[a-z]+(?:\s+from-[a-z0-9/\[\]_-]+)?(?:\s+via-[a-z0-9/\[\]_-]+)?(?:\s+to-[a-z0-9/\[\]_-]+)?)\b/g;
    if (gradientTextRegex.test(modified)) {
      modified = modified.replace(gradientTextRegex, "text-foreground font-semibold");
      appliedFixes.push({
        file: rel,
        ruleId: "DESIGN-VISUAL-001",
        description: "Replaced generic low-contrast gradient text with solid high-contrast typography",
      });
    }

    // 6. Neutralize non-functional decorative radial blur orbs and glowing background blobs
    const blurOrbTagRegex =
      /<div\s+className="[^"]*(?:(?:radial-gradient|rounded-full|from-purple|bg-purple)[^"]*blur-(?:2xl|3xl)|blur-(?:2xl|3xl)[^"]*(?:radial-gradient|rounded-full|from-purple|bg-purple))[^"]*"[^>]*\/>/gi;
    if (blurOrbTagRegex.test(modified)) {
      modified = modified.replace(
        blurOrbTagRegex,
        "{/* Decorative background blur removed by Bilt for visual clarity */}",
      );
      appliedFixes.push({
        file: rel,
        ruleId: "DECORATION-OVERLOAD-001",
        description: "Removed non-functional decorative background blur orb",
      });
    }

    // 7. Normalize extreme container radii from rounded-3xl to crisp rounded-xl
    if (/\brounded-3xl\b|\brounded-\[3[0-9]px\]\b|\brounded-\[4[0-9]px\]\b/.test(modified)) {
      modified = modified.replace(
        /\brounded-3xl\b|\brounded-\[3[0-9]px\]\b|\brounded-\[4[0-9]px\]\b/g,
        "rounded-xl",
      );
      appliedFixes.push({
        file: rel,
        ruleId: "DESIGN-VISUAL-004",
        description: "Calibrated extreme container corner radius from rounded-3xl to rounded-xl",
      });
    }

    // 8. Normalize excessive hover scale transforms causing layout jitter
    if (/\bhover:scale-(?:105|110|102)\b/.test(modified)) {
      modified = modified.replace(
        /\bhover:scale-(?:105|110|102)\b/g,
        "transition-colors hover:border-zinc-700",
      );
      appliedFixes.push({
        file: rel,
        ruleId: "DESIGN-INTERACTION-001",
        description: "Replaced layout-displacing hover:scale-105 with subtle border transition",
      });
    }

    // 9. Replace simulated fake live counter with authentic operational status
    const fakeViewerRegex = /[0-9]+\s+(?:people|users)\s+(?:viewing|online)\s+right\s+now/gi;
    if (fakeViewerRegex.test(modified)) {
      modified = modified.replace(fakeViewerRegex, "All systems operational");
      appliedFixes.push({
        file: rel,
        ruleId: "DESIGN-AUTHENTICITY-004",
        description: "Replaced hardcoded fake visitor activity count with authentic operational status",
      });
    }

    // If changes were made, write back
    if (modified !== content) {
      await fs.writeFile(filePath, modified, "utf-8");
    }
  }

  return appliedFixes;
}
