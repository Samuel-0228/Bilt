// ─── Doctor Command ──────────────────────────────────────────────────────────
// Comprehensive health report with detailed breakdown and recommendations.

import path from "node:path";
import chalk from "chalk";
import boxen from "boxen";
import type { ScanFinding, Severity, FindingCategory } from "../types/index.js";
import { executeScan } from "./scan.js";
import { formatHealthScore, severityIcon } from "../ui/format.js";

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

  // ── Markdown card mode ──────────────────────────────────────────────
  if (options.card) {
    const md = generateMarkdownCard(
      result.healthScore,
      result.grade,
      findings,
      framework?.displayName,
    );
    console.log(md);
    return;
  }

  // ── Header ──────────────────────────────────────────────────────────
  console.log("");
  const header = boxen(
    `\n${chalk.bold.cyan("  🏗️  BILT DOCTOR — Comprehensive Health Report")}\n`,
    {
      padding: 0,
      margin: { top: 0, bottom: 0, left: 1, right: 1 },
      borderStyle: "round",
      borderColor: "cyan",
    },
  );
  console.log(header);
  console.log("");

  // ── Overall score ───────────────────────────────────────────────────
  console.log(chalk.bold("  📊 Overall Health"));
  console.log("");
  console.log(`  ${formatHealthScore(healthScore, grade)}`);
  console.log("");
  console.log(
    chalk.dim(
      `  Scanned ${scannedFiles} files in ${duration}ms${framework ? ` • Framework: ${framework.displayName}` : ""}`,
    ),
  );
  console.log("");

  // ── Fun mode ────────────────────────────────────────────────────────
  if (options.fun) {
    if (healthScore === 100) {
      console.log(
        chalk.bold.green("  🎉🏆🎉 PERFECT SCORE! You absolute legend! 🎉🏆🎉"),
      );
      console.log("");
    } else if (healthScore >= 90) {
      console.log(chalk.green("  🔥 So close to perfection — you got this!"));
      console.log("");
    }
  }

  // ── Category breakdown ──────────────────────────────────────────────
  console.log(chalk.bold("  📋 Category Breakdown"));
  console.log("");

  const categories: { key: FindingCategory; label: string; icon: string }[] = [
    { key: "secret-detected", label: "Secret Detection", icon: "🔐" },
    { key: "env-missing", label: "Missing Env Vars", icon: "📦" },
    { key: "env-unused", label: "Unused Env Vars", icon: "🗑️" },
    { key: "env-mismatch", label: "Env Mismatches", icon: "🔀" },
    { key: "env-exposed", label: "Client-Exposed Secrets", icon: "🌐" },
    { key: "gitignore-missing", label: ".gitignore Coverage", icon: "📄" },
    { key: "framework-warning", label: "Framework Warnings", icon: "⚙️" },
    { key: "plugin-finding", label: "Plugin Findings", icon: "🔌" },
  ];

  for (const cat of categories) {
    const catFindings = findings.filter((f) => f.category === cat.key);
    if (catFindings.length === 0) {
      console.log(
        chalk.green(`  ${cat.icon} ${cat.label}: ${chalk.bold("Clean")} ✓`),
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
      if (critCount > 0) parts.push(chalk.red(`${critCount} critical`));
      if (warnCount > 0) parts.push(chalk.yellow(`${warnCount} warning`));
      if (infoCount > 0) parts.push(chalk.cyan(`${infoCount} info`));

      console.log(
        `  ${cat.icon} ${cat.label}: ${parts.join(", ")} ${chalk.dim(`(${catFindings.length} total)`)}`,
      );
    }
  }

  console.log("");

  // ── Detailed findings ───────────────────────────────────────────────
  if (findings.length > 0) {
    console.log(chalk.bold("  🔍 Detailed Findings"));
    console.log("");

    const order: Severity[] = ["critical", "warning", "info"];
    for (const sev of order) {
      const sevFindings = findings.filter((f) => f.severity === sev);
      if (sevFindings.length === 0) continue;

      const icon = severityIcon(sev);
      console.log(
        `  ${icon} ${chalk.bold(sev.charAt(0).toUpperCase() + sev.slice(1))}`,
      );

      for (const f of sevFindings) {
        const loc = f.line ? `${f.file}:${f.line}` : f.file;
        console.log(`     ${chalk.dim("›")} ${f.message}  ${chalk.dim(loc)}`);
        if (f.suggestion) {
          console.log(chalk.dim(`       💡 ${f.suggestion}`));
        }
      }
      console.log("");
    }
  }

  // ── Recommendations ─────────────────────────────────────────────────
  console.log(chalk.bold("  💡 Recommendations"));
  console.log("");

  const recommendations = generateRecommendations(findings);
  if (recommendations.length === 0) {
    console.log(
      chalk.green("  Everything looks great! No recommendations needed."),
    );
  } else {
    for (let i = 0; i < recommendations.length; i++) {
      console.log(`  ${chalk.cyan(`${i + 1}.`)} ${recommendations[i]}`);
    }
  }

  console.log("");

  // ── Footer ──────────────────────────────────────────────────────────
  const footer = boxen(
    chalk.dim(
      `\n  Run ${chalk.white("bilt fix --safe")} to auto-fix safe issues\n` +
        `  Run ${chalk.white("bilt fix")} for interactive fix mode\n` +
        `  Run ${chalk.white("bilt watch")} for real-time monitoring\n`,
    ),
    {
      padding: 0,
      margin: { top: 0, bottom: 0, left: 1, right: 1 },
      borderStyle: "round",
      borderColor: "gray",
    },
  );
  console.log(footer);
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
  const bar = "█".repeat(filled) + "░".repeat(empty);

  let md = "# 🏗️ Bilt Health Report\n\n";
  md += `**Score:** ${score}/100 — **${grade}**\n\n`;
  md += "```\n";
  md += `${bar} ${score}%\n`;
  md += "```\n\n";
  md += "## Summary\n\n";
  md += `| Metric | Count |\n`;
  md += `|--------|-------|\n`;
  md += `| 🔴 Critical | ${criticals} |\n`;
  md += `| 🟡 Warning | ${warnings} |\n`;
  md += `| 🔵 Info | ${infos} |\n`;

  if (frameworkName) {
    md += `\n**Framework:** ${frameworkName}\n`;
  }

  md += "\n---\n";
  md += "*Generated by [Bilt](https://github.com/bilt-cli/bilt)*\n";

  return md;
}
