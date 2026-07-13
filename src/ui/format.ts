// ─── UI Format Utilities ─────────────────────────────────────────────────────
// Atomic formatters used across the entire CLI output layer.

import chalk from "chalk";
import type { ScanFinding, Severity, ProviderInfo } from "../types/index.js";

// ─── Severity Helpers ────────────────────────────────────────────────────────

/**
 * Return the emoji icon for a severity level.
 */
export function severityIcon(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "🔴";
    case "warning":
      return "🟡";
    case "info":
      return "🔵";
  }
}

/**
 * Return the chalk color function for a severity level.
 */
export function severityColor(severity: Severity): (text: string) => string {
  switch (severity) {
    case "critical":
      return (t: string) => chalk.red(t);
    case "warning":
      return (t: string) => chalk.yellow(t);
    case "info":
      return (t: string) => chalk.cyan(t);
  }
}

// ─── Finding Formatter ───────────────────────────────────────────────────────

/**
 * Format a single finding as a one-line string with severity icon,
 * colored message, and file:line reference.
 *
 * Example: 🔴 AWS access key detected  config.js:12
 */
export function formatFinding(finding: ScanFinding): string {
  const icon = severityIcon(finding.severity);
  const colorFn = severityColor(finding.severity);
  const location = finding.line
    ? chalk.dim(`${finding.file}:${finding.line}`)
    : chalk.dim(finding.file);
  const message = colorFn(finding.message);

  let line = `  ${icon} ${message}  ${location}`;

  if (finding.preview) {
    line += `  ${chalk.dim(`[${finding.preview}]`)}`;
  }

  return line;
}

// ─── Health Score Formatter ──────────────────────────────────────────────────

/**
 * Format a health score as a colored ASCII progress bar with grade.
 *
 * Example:  ████████████████████░░░  92%  A
 */
export function formatHealthScore(score: number, grade: string): string {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const barWidth = 25;
  const filled = Math.round((clamped / 100) * barWidth);
  const empty = barWidth - filled;

  const filledChar = "█";
  const emptyChar = "░";

  const gradeColorFn = gradeColor(grade);
  const bar =
    gradeColorFn(filledChar.repeat(filled)) +
    chalk.dim(emptyChar.repeat(empty));
  const pct = gradeColorFn(`${clamped}%`);
  const gradeLabel = gradeColorFn(chalk.bold(grade));

  return `${bar}  ${pct}  ${gradeLabel}`;
}

/**
 * Determine chalk color for a letter grade.
 */
function gradeColor(grade: string): (text: string) => string {
  const letter = grade.charAt(0).toUpperCase();
  switch (letter) {
    case "A":
      return (t: string) => chalk.green(t);
    case "B":
      return (t: string) => chalk.blue(t);
    case "C":
      return (t: string) => chalk.yellow(t);
    case "D":
    case "F":
      return (t: string) => chalk.red(t);
    default:
      return (t: string) => chalk.white(t);
  }
}

// ─── Provider Link Formatter ─────────────────────────────────────────────────

/**
 * Format a provider name with a clickable rotation URL as a terminal hyperlink.
 *
 * Terminals that support OSC 8 will render this as a clickable link.
 */
export function formatProviderLink(provider: ProviderInfo): string {
  const icon = provider.icon || "🔑";
  // OSC 8 hyperlink: \e]8;;URL\e\\LABEL\e]8;;\e\\
  const link = `\u001B]8;;${provider.rotationUrl}\u001B\\${chalk.underline.cyan(provider.rotationUrl)}\u001B]8;;\u001B\\`;
  return `  ${icon} ${chalk.bold(provider.displayName)}  →  Rotate: ${link}`;
}

// ─── Secret Masker ───────────────────────────────────────────────────────────

/**
 * Mask a secret value for safe display.
 *
 * - If value ≥ 12 chars: show first 4 + asterisks + last 4
 * - If value < 12 chars: show first 2 + asterisks for rest
 */
export function maskSecret(value: string): string {
  if (value.length >= 12) {
    const first = value.slice(0, 4);
    const last = value.slice(-4);
    const masked = "*".repeat(Math.min(value.length - 8, 16));
    return `${first}${masked}${last}`;
  }

  if (value.length <= 2) {
    return "*".repeat(value.length);
  }

  const first = value.slice(0, 2);
  const masked = "*".repeat(value.length - 2);
  return `${first}${masked}`;
}

// ─── Diff Formatter ──────────────────────────────────────────────────────────

/**
 * Simple colored diff between two strings.
 * Lines prefixed with - are colored red (removed).
 * Lines prefixed with + are colored green (added).
 * Context lines are dimmed.
 */
export function formatDiff(before: string, after: string): string {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const output: string[] = [];

  // Build a simple LCS-based diff
  const lcs = buildLCS(beforeLines, afterLines);
  let bi = 0;
  let ai = 0;
  let li = 0;

  while (bi < beforeLines.length || ai < afterLines.length) {
    if (
      li < lcs.length &&
      bi < beforeLines.length &&
      ai < afterLines.length &&
      beforeLines[bi] === lcs[li] &&
      afterLines[ai] === lcs[li]
    ) {
      // Context line — common to both
      output.push(chalk.dim(`  ${beforeLines[bi]}`));
      bi++;
      ai++;
      li++;
    } else if (
      bi < beforeLines.length &&
      (li >= lcs.length || beforeLines[bi] !== lcs[li])
    ) {
      // Removed line
      output.push(chalk.red(`- ${beforeLines[bi]}`));
      bi++;
    } else if (
      ai < afterLines.length &&
      (li >= lcs.length || afterLines[ai] !== lcs[li])
    ) {
      // Added line
      output.push(chalk.green(`+ ${afterLines[ai]}`));
      ai++;
    } else {
      // Fallback safety — shouldn't happen
      break;
    }
  }

  return output.join("\n");
}

/**
 * Build the Longest Common Subsequence of two string arrays.
 */
function buildLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  // Build DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = (dp[i - 1]?.[j - 1] ?? 0) + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]?.[j] ?? 0, dp[i]?.[j - 1] ?? 0);
      }
    }
  }

  // Backtrack to recover the LCS
  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]!);
      i--;
      j--;
    } else if ((dp[i - 1]?.[j] ?? 0) > (dp[i]?.[j - 1] ?? 0)) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}
