// ─── Doctor Command ──────────────────────────────────────────────────────────
// Comprehensive health report with detailed breakdown and recommendations.

import path from "node:path";
import type { ScanFinding, Severity, FindingCategory } from "../types/index.js";
import { executeScan } from "./scan.js";
import { formatHealthScore, severityIcon, formatFinding } from "../ui/format.js";
import { colors, glyphs, banner, pulseBar, sectionHeader, divider, summaryBox, styledGlyph, severityColor, text, ruleLine, isPlainMode, showBliptBanner } from "../ui/theme.js";
import { createRequire } from "node:module";

/**
 * Execute the `bilt doctor` command.
 *
 * 1. Run full scan
 * 2. Display comprehensive health report
 * 3. If --card: output markdown summary
 * 4. Show recommendations per category
 */
export async function executeDoctor(
  projectDir: string,
  options: { card?: boolean; fun?: boolean } = {},
): Promise<void> {
  const rootDir = path.resolve(projectDir);

  // ── Run full scan ───────────────────────────────────────────────────
  const result = await executeScan(rootDir, {
    quiet: true,
    fullHistory: true,
  });

  const { findings, healthScore, grade, scannedFiles, duration, framework } =
    result;

  // ── PNG card mode ──────────────────────────────────────────────────
  if (options.card) {
    const repoName = path.basename(rootDir);
    const filledWidth = Math.max(0, Math.min(800, (healthScore / 100) * 800));
    const fillColor =
      healthScore <= 39
        ? "#FB7185" // Pulse Coral
        : healthScore <= 74
          ? "#FBBF24" // Amber Flag
          : "#34D399"; // Mint Clear

    const cardSvg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0D1117" />
  <rect x="20" y="20" width="1160" height="590" rx="20" fill="none" stroke="#5EEAD4" stroke-width="1.5" stroke-opacity="0.15" />
  <circle cx="150" cy="480" r="250" fill="#5EEAD4" opacity="0.03" />
  <circle cx="1000" cy="150" r="300" fill="#5EEAD4" opacity="0.02" />
  <text x="100" y="200" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="800" fill="#5EEAD4">
    ${repoName}
  </text>
  <text x="100" y="310" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" fill="#64748B">
    HEALTH
  </text>
  <rect x="100" y="340" width="800" height="40" rx="8" fill="#1E293B" />
  <rect x="100" y="340" width="${filledWidth}" height="40" rx="8" fill="${fillColor}" />
  <text x="930" y="374" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="800" fill="${fillColor}">
    ${healthScore}/100
  </text>
  <text x="1100" y="570" text-anchor="end" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" fill="#64748B" opacity="0.4">
    bilt.dev
  </text>
</svg>
    `.trim();

    try {
      const sharp = (await import("sharp")).default;
      const outputPath = path.join(rootDir, "bilt-health-card.png");
      await sharp(Buffer.from(cardSvg)).png().toFile(outputPath);
      console.log("");
      console.log(colors.mintClear.apply("  " + glyphs.fixed + " Generated card: " + outputPath));
      console.log("");
      console.log(colors.slateDim.apply("  Share this card on social media:"));
      console.log(colors.vitalTeal.bold(`  Score: ${healthScore}/100 — scanned with bilt \u2192 bilt.dev`));
      console.log("");
    } catch (err: any) {
      console.error(colors.pulseCoral.apply("  " + glyphs.critical + " Failed to generate card PNG: " + err.message));
    }
    return;
  }

  const isPlain = isPlainMode();
  const maybeSleep = async () => {
    if (!isPlain) {
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
  };

  // ── Header ──────────────────────────────────────────────────────────
  console.log("");
  const require = createRequire(import.meta.url);
  const pkg = require("../../package.json") as { version: string };
  showBliptBanner(pkg.version);
  await maybeSleep();
  console.log("");
  console.log(colors.vitalTeal.bold("  BILT DOCTOR \u2014 Comprehensive Health Report"));
  await maybeSleep();
  console.log("");

  // ── Overall score ───────────────────────────────────────────────────
  console.log(sectionHeader("Overall Health"));
  await maybeSleep();
  console.log("");
  console.log(`  ${formatHealthScore(healthScore)}`);
  await maybeSleep();
  console.log("");
  console.log(
    colors.slateDim.dim(
      `  Scanned ${scannedFiles} files in ${duration}ms${framework ? ` • Framework: ${framework.displayName}` : ""}`,
    ),
  );
  await maybeSleep();
  console.log("");

  // ── Fun mode ────────────────────────────────────────────────────────
  if (options.fun) {
    if (healthScore === 100) {
      console.log(
        colors.mintClear.bold("  Perfect score! You absolute legend!"),
      );
      await maybeSleep();
      console.log("");
    } else if (healthScore >= 90) {
      console.log(colors.mintClear.apply("  So close to perfection — you got this!"));
      await maybeSleep();
      console.log("");
    }
  }

  // ── Category breakdown ──────────────────────────────────────────────
  console.log(sectionHeader("Category Breakdown"));
  await maybeSleep();
  console.log("");

  const categories: { key: FindingCategory; label: string }[] = [
    { key: "secret-detected", label: "Secret Detection" },
    { key: "env-missing", label: "Missing Env Vars" },
    { key: "env-unused", label: "Unused Env Vars" },
    { key: "env-mismatch", label: "Env Mismatches" },
    { key: "env-exposed", label: "Client-Exposed Secrets" },
    { key: "gitignore-missing", label: ".gitignore Coverage" },
    { key: "framework-warning", label: "Framework Warnings" },
    { key: "plugin-finding", label: "Plugin Findings" },
  ];

  for (const cat of categories) {
    const catFindings = findings.filter((f) => f.category === cat.key);
    if (catFindings.length === 0) {
      console.log(
        colors.mintClear.apply(`  ${colors.slateDim.apply(glyphs.info)} ${cat.label}: ${text.bold("Clean")} ${glyphs.fixed}`),
      );
    } else {
      const critCount = catFindings.filter(
        (f) => f.severity === "critical",
      ).length;
      const warnCount = catFindings.filter(
        (f) => f.severity === "warning",
      ).length;
      const infoCount = catFindings.filter((f) => f.severity === "info").length;

      const parts: string[] = [];
      if (critCount > 0) parts.push(colors.pulseCoral.apply(`${critCount} critical`));
      if (warnCount > 0) parts.push(colors.amberFlag.apply(`${warnCount} warning`));
      if (infoCount > 0) parts.push(colors.vitalTeal.apply(`${infoCount} info`));

      console.log(
        `  ${colors.slateDim.apply(glyphs.info)} ${cat.label}: ${parts.join(", ")} ${colors.slateDim.dim(`(${catFindings.length} total)`)}`,
      );
    }
    await maybeSleep();
  }

  console.log("");

  // ── Detailed findings ───────────────────────────────────────────────
  if (findings.length > 0) {
    console.log(sectionHeader("Detailed Findings"));
    await maybeSleep();
    console.log("");

    const order: Severity[] = ["critical", "warning", "info"];
    for (const sev of order) {
      const sevFindings = findings.filter((f) => f.severity === sev);
      if (sevFindings.length === 0) continue;

      const icon = severityIcon(sev);
      console.log(
        `  ${icon} ${text.bold(sev.charAt(0).toUpperCase() + sev.slice(1))}`,
      );
      await maybeSleep();

      for (const f of sevFindings) {
        const loc = f.line ? `${f.file}:${f.line}` : f.file;
        console.log(`     ${colors.slateDim.dim("›")} ${f.message}  ${colors.slateDim.dim(loc)}`);
        await maybeSleep();
        if (f.suggestion) {
          console.log(colors.slateDim.dim(`       ${glyphs.arrow} ${f.suggestion}`));
          await maybeSleep();
        }
      }
      console.log("");
    }
  }

  // ── Recommendations ─────────────────────────────────────────────────
  console.log(sectionHeader("Recommendations"));
  await maybeSleep();
  console.log("");

  const recommendations = generateRecommendations(findings);
  if (recommendations.length === 0) {
    console.log(
      colors.mintClear.apply("  Everything looks great! No recommendations needed."),
    );
  } else {
    for (let i = 0; i < recommendations.length; i++) {
      console.log(`  ${colors.vitalTeal.apply(`${i + 1}.`)} ${recommendations[i]}`);
      await maybeSleep();
    }
  }

  console.log("");

  // ── Footer ──────────────────────────────────────────────────────────
  console.log(divider());
  await maybeSleep();
  console.log("");
  console.log(
    colors.slateDim.dim(
      `  Run ${text.bold("bilt fix --safe")} to auto-fix safe issues`,
    ),
  );
  await maybeSleep();
  console.log(
    colors.slateDim.dim(
      `  Run ${text.bold("bilt fix")} for interactive fix mode`,
    ),
  );
  await maybeSleep();
  console.log(
    colors.slateDim.dim(
      `  Run ${text.bold("bilt watch")} for real-time monitoring`,
    ),
  );
  await maybeSleep();
  console.log("");
}

// ─── Recommendation Generator ────────────────────────────────────────────────

function generateRecommendations(findings: ScanFinding[]): string[] {
  const recs: string[] = [];
  const categories = new Set(findings.map((f) => f.category));

  if (categories.has("secret-detected")) {
    recs.push(
      "Move hardcoded secrets to .env files and rotate compromised keys immediately.",
    );
  }

  if (categories.has("gitignore-missing")) {
    recs.push(
      "Add .env file patterns to .gitignore to prevent accidental commits.",
    );
  }

  if (categories.has("env-missing")) {
    recs.push(
      "Add missing environment variables or generate a .env.example for onboarding.",
    );
  }

  if (categories.has("env-unused")) {
    recs.push("Remove unused environment variables to keep your config clean.");
  }

  if (categories.has("env-mismatch")) {
    recs.push(
      "Sync environment files — ensure all environments have the same variables.",
    );
  }

  if (categories.has("env-exposed")) {
    recs.push(
      "Review client-exposed env vars — only public keys should use framework-specific prefixes.",
    );
  }

  if (categories.has("framework-warning")) {
    recs.push(
      "Review framework-specific configuration for potential security issues.",
    );
  }

  if (categories.has("plugin-finding")) {
    recs.push(
      "Address plugin-specific findings — check Docker, Terraform, or other tool configurations.",
    );
  }

  return recs;
}

// ─── Markdown Card Generator ─────────────────────────────────────────────────

function generateMarkdownCard(
  score: number,
  grade: string,
  findings: ScanFinding[],
  frameworkName?: string,
): string {
  const criticals = findings.filter((f) => f.severity === "critical").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const infos = findings.filter((f) => f.severity === "info").length;

  const barWidth = 20;
  const filled = Math.round((score / 100) * barWidth);
  const empty = barWidth - filled;
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);

  let md = "# 🏗️ Bilt Health Report\n\n";
  md += `**Score:** ${score}/100 — **${grade}**\n\n`;
  md += "```\n";
  md += `${bar} ${score}%\n`;
  md += "```\n\n";
  md += "## Summary\n\n";
  md += `| Metric | Count |\n`;
  md += `|--------|-------|\n`;
  md += `| [CRITICAL] | ${criticals} |\n`;
  md += `| [WARNING] | ${warnings} |\n`;
  md += `| [INFO] | ${infos} |\n`;

  if (frameworkName) {
    md += `\n**Framework:** ${frameworkName}\n`;
  }

  md += "\n---\n";
  md += "*Generated by [Bilt](https://github.com/bilt-cli/bilt)*\n";

  return md;
}
