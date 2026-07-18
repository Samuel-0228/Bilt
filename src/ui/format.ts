// ─── UI Format Utilities ─────────────────────────────────────────────────────
// Atomic formatters used across the entire CLI output layer.
// All color/glyph usage goes through theme.ts — no direct chalk calls here.

import {
  colors,
  glyphs,
  styledGlyph,
  severityColor as themeSeverityColor,
  severityGlyph,
  truncatePath,
  isPlainMode,
  text,
} from "./theme.js";
import type { ScanFinding, Severity, ProviderInfo } from "../types/index.js";

// ─── Severity Helpers ────────────────────────────────────────────────────────

/**
 * Return the themed glyph for a severity level.
 *
 * - critical → ✖  (Pulse Coral)
 * - warning  → ▲  (Amber Flag)
 * - info     → ◆  (Slate Dim)
 */
export function severityIcon(severity: Severity): string {
  return severityGlyph(severity);
}

/**
 * Return the theme color function for a severity level.
 */
export function severityColorFn(
  severity: Severity,
): (text: string) => string {
  return themeSeverityColor(severity).apply;
}

/**
 * Compatibility wrapper returning a styling function.
 */
export function severityColor(severity: Severity): (text: string) => string {
  return themeSeverityColor(severity).apply;
}

function getFindingHeadlineAndDetail(finding: ScanFinding): { headline: string; detail: string } {
  const file = truncatePath(finding.file);
  const loc = finding.line ? `${file}:${finding.line}` : file;

  if (finding.severity === "passed") {
    return {
      headline: finding.message,
      detail: finding.suggestion || "",
    };
  }

  const baseName = (fp: string) => fp.split(/[\\/]/).pop() ?? fp;

  switch (finding.category) {
    case "secret-detected": {
      const headline = finding.message;
      let detail = loc;
      if (finding.provider) {
        detail += ` ${glyphs.arrow} rotate at ${finding.provider.rotationUrl}`;
      } else if (finding.suggestion) {
        detail += ` ${glyphs.arrow} ${finding.suggestion}`;
      }
      return { headline, detail };
    }

    case "env-missing": {
      const match = finding.message.match(/process\.env\.(?<key>[A-Z_][A-Z0-9_]*)/);
      const key = match?.groups?.["key"] ?? "Unknown key";
      return {
        headline: `${key} missing from env`,
        detail: `referenced in ${loc}`,
      };
    }

    case "env-unused": {
      const match = finding.message.match(/Variable "(?<key>[A-Z_][A-Z0-9_]*)"/);
      const key = match?.groups?.["key"] ?? "Unknown key";
      return {
        headline: `${key} defined but unused`,
        detail: `defined in ${loc}`,
      };
    }

    case "env-mismatch": {
      const match = finding.message.match(/Variable "(?<key>[A-Z_][A-Z0-9_]*)" is defined in (?<fileA>[^\s]+) but missing from (?<fileB>[^\s]+)/);
      if (match?.groups) {
        const { key, fileA, fileB } = match.groups as { key: string; fileA: string; fileB: string };
        return {
          headline: `${key} missing from ${baseName(fileB)}`,
          detail: `defined in ${baseName(fileA)}, absent from ${baseName(fileB)}`,
        };
      }
      return {
        headline: finding.message,
        detail: `in ${loc}`,
      };
    }

    case "env-exposed": {
      const match = finding.message.match(/Variable "(?<key>[A-Z_][A-Z0-9_]*)" is exposed to the client bundle via (?<framework>[^\n]+) and contains a secret \((?<ruleName>[^\)]+)\)/);
      if (match?.groups) {
        const { key, framework, ruleName } = match.groups as { key: string; framework: string; ruleName: string };
        return {
          headline: `${key} exposed to client`,
          detail: `via ${framework}, contains secret (${ruleName})`,
        };
      }
      return {
        headline: finding.message,
        detail: `exposed in ${loc}`,
      };
    }

    case "gitignore-missing": {
      return {
        headline: `${baseName(finding.file)} not ignored`,
        detail: `secrets may be committed. Add env patterns to ${file}`,
      };
    }

    case "plugin-finding": {
      if (finding.id.startsWith("docker-no-dockerignore")) {
        return {
          headline: `No .dockerignore found`,
          detail: `.env files may be copied into Docker image. Create one and add .env*`,
        };
      }
      if (finding.id.startsWith("docker-dockerignore-env")) {
        return {
          headline: `.dockerignore misses .env`,
          detail: `.dockerignore does not exclude .env files. Add .env*`,
        };
      }
      if (finding.id.startsWith("docker-env-secret")) {
        return {
          headline: `Hardcoded key in Dockerfile`,
          detail: `in ${loc}. Use ARG/--build-arg or mount secrets instead`,
        };
      }
      if (finding.id.startsWith("terraform-gitignore-tfvars")) {
        return {
          headline: `*.tfvars files not ignored`,
          detail: `in .gitignore. Add *.tfvars and *.tfvars.json to prevent commits`,
        };
      }
      if (finding.id.startsWith("terraform-gitignore-dir")) {
        return {
          headline: `.terraform/ not ignored`,
          detail: `in .gitignore. Add .terraform/ to exclude local state/providers`,
        };
      }
      if (finding.id.startsWith("terraform-hardcoded")) {
        return {
          headline: `Hardcoded key in Terraform`,
          detail: `in ${loc}. Use variables or env vars instead of hardcoding`,
        };
      }
      return {
        headline: finding.message,
        detail: `in ${loc}`,
      };
    }

    default: {
      return {
        headline: finding.message,
        detail: `in ${loc}`,
      };
    }
  }
}

function renderFiveQuestions(finding: ScanFinding, defaultDetail: string): string {
  if (!finding.knowledge) return `     ${defaultDetail}`;
  
  const k = finding.knowledge;
  const fixable = finding.suggestion?.toLowerCase().includes("rotate") ? "yes → bilt fix" : "no → manual";
  // The default detail often includes rotation URLs, we just want the location prefix
  const loc = defaultDetail.split(" ")[0];
  
  const lines = [
    `     loc         ${loc}`,
    `     what        ${k.whatItIs}`,
    `     why         ${k.why}`,
    `     confidence  ${finding.confidence ?? "low"}`,
    `     do next     ${k.action}`,
    `     fixable     ${fixable}`
  ];
  return lines.join("\n");
}

/**
 * Format a single finding in either headline or detail mode.
 */
export function formatFinding(
  finding: ScanFinding,
  mode: "headline" | "detail" = "headline",
): string {
  const { headline, detail } = getFindingHeadlineAndDetail(finding);

  if (finding.category === "secret-detected" && finding.verificationState) {
    const state = finding.verificationState;
    if (state === "verified-live") {
      const icon = colors.pulseCoral.apply(glyphs.critical);
      const boldText = colors.pulseCoral.bold(`${headline} [verified-live]`);
      const headlineStr = `  ${icon}  ${boldText}`;
      if (mode === "headline") return headlineStr;
      return `${headlineStr}\n${colors.slateDim.apply(renderFiveQuestions(finding, detail))}`;
    } else if (state === "unverified") {
      const icon = colors.pulseCoral.dim(glyphs.critical);
      const boldText = colors.pulseCoral.dim(`${headline} [unverified]`);
      const headlineStr = `  ${icon}  ${boldText}`;
      if (mode === "headline") return headlineStr;
      const detailStr = colors.slateDim.dim(`${renderFiveQuestions(finding, detail)}\n     (detection could not confirm liveness)`);
      return `${headlineStr}\n${detailStr}`;
    } else if (state === "verified-dead") {
      const icon = colors.slateDim.dim(glyphs.critical);
      const boldText = colors.slateDim.dim(`${headline} [verified-dead]`);
      const headlineStr = `  ${icon}  ${boldText}`;
      if (mode === "headline") return headlineStr;
      return `${headlineStr}\n${colors.slateDim.dim(renderFiveQuestions(finding, detail))}`;
    }
  }

  const icon = styledGlyph(finding.severity);
  const color = themeSeverityColor(finding.severity);
  const headlineStr = `  ${icon}  ${color.bold(headline)}`;

  if (mode === "headline") {
    return headlineStr;
  } else {
    const detailStr = colors.slateDim.apply(renderFiveQuestions(finding, detail));
    return `${headlineStr}\n${detailStr}`;
  }
}

// ─── Health Score Formatter ──────────────────────────────────────────────────

/**
 * Format a health score using the Pulse Bar.
 *
 * Example:  Health  ████████████████████░░░  92/100
 *
 * Score-color mapping:
 *   0-39   Pulse Coral
 *   40-74  Amber Flag
 *   75-100 Mint Clear
 */
export function formatHealthScore(score: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const width = 25;
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;

  if (isPlainMode()) {
    return `Health  ${"#".repeat(filled)}${".".repeat(empty)}  ${clamped}/100`;
  }

  const fillColor =
    clamped <= 39
      ? colors.pulseCoral
      : clamped <= 74
        ? colors.amberFlag
        : colors.mintClear;

  const filledStr = fillColor.apply(glyphs.filledBlock.repeat(filled));
  const emptyStr = colors.slateDim.dim(glyphs.emptyBlock.repeat(empty));
  const scoreStr = fillColor.bold(`${clamped}/100`);

  return `${filledStr}${emptyStr}  ${scoreStr}`;
}

// ─── Provider Link Formatter ─────────────────────────────────────────────────

/**
 * Format a provider name with a clickable rotation URL as a terminal hyperlink.
 *
 * Terminals that support OSC 8 will render this as a clickable link.
 */
export function formatProviderLink(provider: ProviderInfo): string {
  // OSC 8 hyperlink: \e]8;;URL\e\\LABEL\e]8;;\e\\
  const link = `\u001B]8;;${provider.rotationUrl}\u001B\\${colors.vitalTeal.apply(provider.rotationUrl)}\u001B]8;;\u001B\\`;
  return `  ${colors.slateDim.apply(glyphs.info)} ${text.bold(provider.displayName)}  ${glyphs.arrow}  Rotate: ${link}`;
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
 * Lines prefixed with - are colored Pulse Coral (removed).
 * Lines prefixed with + are colored Mint Clear (added).
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
      output.push(colors.slateDim.dim(`  ${beforeLines[bi]}`));
      bi++;
      ai++;
      li++;
    } else if (
      bi < beforeLines.length &&
      (li >= lcs.length || beforeLines[bi] !== lcs[li])
    ) {
      // Removed line
      output.push(colors.pulseCoral.apply(`- ${beforeLines[bi]}`));
      bi++;
    } else if (
      ai < afterLines.length &&
      (li >= lcs.length || afterLines[ai] !== lcs[li])
    ) {
      // Added line
      output.push(colors.mintClear.apply(`+ ${afterLines[ai]}`));
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
