// ─── Theme — Pulse Design System ─────────────────────────────────────────────
// Single source of truth for all visual output in Bilt.
// No chalk calls should exist outside this file.

import chalk from "chalk";
import type { Severity } from "../types/index.js";

// ─── Plain Mode ──────────────────────────────────────────────────────────────

/** When true, all output is plain text — no color, no banner, no Pulse Bar. */
let _plainMode = false;

export function setPlainMode(enabled: boolean): void {
  _plainMode = enabled;
  if (enabled) {
    chalk.level = 0;
  }
}

export function isPlainMode(): boolean {
  return _plainMode;
}

// ─── NO_COLOR / --no-color Support ───────────────────────────────────────────

export function initColorSupport(noColorFlag?: boolean): void {
  if (
    noColorFlag ||
    process.env["NO_COLOR"] !== undefined ||
    process.env["TERM"] === "dumb"
  ) {
    chalk.level = 0;
  }
}

// ─── Color Palette — "Pulse" ─────────────────────────────────────────────────
//
// | Name        | Hex       | 256  | Use                                     |
// |-------------|-----------|------|-----------------------------------------|
// | Void Ink    | #0D1117   | 234  | exported card bg only, never terminal   |
// | Vital Teal  | #5EEAD4   | 86   | brand accent — banner, links, active    |
// | Pulse Coral | #FB7185   | 210  | critical (leak, broken var)             |
// | Amber Flag  | #FBBF24   | 220  | warning (inconsistency, unused var)     |
// | Mint Clear  | #34D399   | 78   | pass / healthy / fixed                  |
// | Slate Dim   | #64748B   | 244  | secondary text, labels, dividers        |

interface PaletteColor {
  hex: string;
  ansi256: number;
  /** Apply the color to text. */
  apply: (text: string) => string;
  /** Apply the color + bold to text. */
  bold: (text: string) => string;
  /** Apply the color + dim to text. */
  dim: (text: string) => string;
}

function makeColor(hex: string, ansi256: number): PaletteColor {
  const colorFn = () => {
    if (chalk.level >= 3) return chalk.hex(hex);
    if (chalk.level >= 2) return chalk.ansi256(ansi256);
    return chalk;
  };

  return {
    hex,
    ansi256,
    apply: (text: string) => colorFn()(text),
    bold: (text: string) => colorFn().bold(text),
    dim: (text: string) => colorFn().dim(text),
  };
}

export const colors = {
  voidInk: makeColor("#0D1117", 234),
  vitalTeal: makeColor("#5EEAD4", 86),
  pulseCoral: makeColor("#FB7185", 210),
  amberFlag: makeColor("#FBBF24", 220),
  mintClear: makeColor("#34D399", 78),
  slateDim: makeColor("#64748B", 244),
} as const;

// ─── Glyph System ────────────────────────────────────────────────────────────
// Closed set — never mix in a second glyph family.

export const glyphs = {
  critical: "\u2716", // ✖  U+2716
  warning: "\u25B2", // ▲  U+25B2
  passed: "\u25CF", // ●  U+25CF
  fixed: "\u2713", // ✓  U+2713
  info: "\u25C6", // ◆  U+25C6
  divider: "\u2500", // ─  U+2500
  rule: "\u2502", // │  U+2502
  filledBlock: "\u2588", // █  U+2588
  emptyBlock: "\u2591", // ░  U+2591
  arrow: "\u2192", // →  U+2192
} as const;

export const spinnerFrames = [
  "\u280B",
  "\u2819",
  "\u2839",
  "\u2838",
  "\u283C",
  "\u2834",
  "\u2826",
  "\u2827",
  "\u2807",
  "\u280F",
] as const; // ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏

// ─── Severity Mapping ────────────────────────────────────────────────────────

export function severityGlyph(severity: Severity): string {
  switch (severity) {
    case "critical":
      return glyphs.critical;
    case "warning":
      return glyphs.warning;
    case "info":
      return glyphs.info;
    case "passed":
      return glyphs.passed;
  }
}

export function severityColor(severity: Severity): PaletteColor {
  switch (severity) {
    case "critical":
      return colors.pulseCoral;
    case "warning":
      return colors.amberFlag;
    case "info":
      return colors.slateDim;
    case "passed":
      return colors.mintClear;
  }
}

/** Return the severity glyph already colored. */
export function styledGlyph(severity: Severity): string {
  return severityColor(severity).apply(severityGlyph(severity));
}

// ─── BILT Banner (hand-tuned 5-line ASCII wordmark) ──────────────────────────

const BANNER_LINES = [
  "  \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557",
  "  \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2551  \u255A\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255D",
  "  \u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2551\u2588\u2588\u2551     \u2588\u2588\u2551   ",
  "  \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2551     \u2588\u2588\u2551   ",
  "  \u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2551   ",
  "  \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u255D\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u255D   ",
];

export function banner(): string {
  if (_plainMode) return "BILT";
  return BANNER_LINES.map((line) => colors.vitalTeal.bold(line)).join("\n");
}

// ─── BliptBanner Mascot Startup Glyph ────────────────────────────────────────

let _bliptBannerShown = false;

export function resetBliptBannerSeen(): void {
  _bliptBannerShown = false;
}

export function showBliptBanner(version: string): void {
  if (_bliptBannerShown || _plainMode) return;
  _bliptBannerShown = true;
  console.log(bliptBanner(version));
  console.log("");
}

export function bliptBanner(version: string): string {
  if (_plainMode) {
    return `bilt v${version} · scanning your project…`;
  }
  const teal = colors.vitalTeal;
  const dim = colors.slateDim;
  const lines = [
    `    ${teal.apply("╭─────╮")}`,
    `   ${teal.apply("⟨ ◉   ◉ ⟩")}    ${teal.bold("bilt")}`,
    `    ${teal.apply("╰╌◡╌╌╯")}      ${dim.apply(`v${version} · scanning your project…`)}`,
  ];
  return lines.join("\n");
}

// Copy strings
export const SNAPSHOT_NOTICE = "A snapshot will be saved — undo anytime with 'bilt undo'.";


// ─── Pulse Bar ───────────────────────────────────────────────────────────────
// Segmented health-score meter. Filled segments color-shift by score range:
// 0-39 Pulse Coral, 40-74 Amber Flag, 75-100 Mint Clear.
// Empty segments always Slate Dim.

export function pulseBar(score: number, width = 25): string {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;

  if (_plainMode) {
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
  const label = colors.slateDim.apply("Health");
  const scoreStr = fillColor.bold(`${clamped}/100`);

  return `  ${label}  ${filledStr}${emptyStr}  ${scoreStr}`;
}

// ─── Section Header ──────────────────────────────────────────────────────────
// ◆ prefixed, bold, sentence case.

export function sectionHeader(text: string): string {
  if (_plainMode) return `\n${text}`;
  return `  ${colors.slateDim.apply(glyphs.info)} ${chalk.bold(text)}`;
}

// ─── Left-Rule Finding Line ──────────────────────────────────────────────────
// │ ✖  message   location

export function ruleLine(content: string): string {
  if (_plainMode) return `  ${content}`;
  return `  ${colors.slateDim.dim(glyphs.rule)} ${content}`;
}

// ─── Divider ─────────────────────────────────────────────────────────────────

export function divider(width = 45): string {
  if (_plainMode) return "-".repeat(width);
  return `  ${colors.slateDim.dim(glyphs.divider.repeat(width))}`;
}

// ─── Summary Box ─────────────────────────────────────────────────────────────
// The ONLY full box-border element in the app — reserved for the final card.

export function summaryBox(lines: string[]): string {
  if (_plainMode) return lines.join("\n");

  const maxLen = Math.max(...lines.map((l) => stripAnsi(l).length), 40);
  const border = colors.vitalTeal.apply;
  const h = glyphs.divider;
  const top = border(`  \u250C${h.repeat(maxLen + 2)}\u2510`);
  const bottom = border(`  \u2514${h.repeat(maxLen + 2)}\u2518`);
  const body = lines.map((line) => {
    const stripped = stripAnsi(line);
    const pad = maxLen - stripped.length;
    return `  ${border("\u2502")} ${line}${" ".repeat(Math.max(0, pad))} ${border("\u2502")}`;
  });

  return [top, ...body, bottom].join("\n");
}

// ─── Path Truncation ─────────────────────────────────────────────────────────
// Truncate from the left: …/src/config.js

export function truncatePath(filePath: string, maxLen = 40): string {
  if (filePath.length <= maxLen) return filePath;
  return "\u2026/" + filePath.slice(-(maxLen - 2));
}

// ─── Spinner ─────────────────────────────────────────────────────────────────
// Braille-cycle spinner in Vital Teal. Replaces `ora`.

export class Spinner {
  private frameIndex = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private _text: string;

  constructor(text: string) {
    this._text = text;
  }

  get text(): string {
    return this._text;
  }

  set text(value: string) {
    this._text = value;
  }

  start(): this {
    if (_plainMode) {
      process.stderr.write(`${this._text}\n`);
      return this;
    }

    this.interval = setInterval(() => {
      const frame = colors.vitalTeal.apply(
        spinnerFrames[this.frameIndex % spinnerFrames.length]!,
      );
      process.stderr.write(
        `\r  ${frame} ${colors.slateDim.apply(this._text)}`,
      );
      this.frameIndex++;
    }, 80);

    return this;
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (!_plainMode) {
      process.stderr.write("\r" + " ".repeat(80) + "\r");
    }
  }

  fail(message: string): void {
    this.stop();
    console.error(
      `  ${colors.pulseCoral.apply(glyphs.critical)} ${colors.pulseCoral.apply(message)}`,
    );
  }
}

// ─── Styled Text Helpers ─────────────────────────────────────────────────────

export const text = {
  bold: (t: string): string => chalk.bold(t),
  dim: (t: string): string => chalk.dim(t),
} as const;

// ─── ANSI Strip ──────────────────────────────────────────────────────────────

export function stripAnsi(str: string): string {
  // Covers SGR sequences and OSC 8 hyperlinks
  // eslint-disable-next-line no-control-regex
  return str
    .replace(/\u001B\[\d*;?\d*;?\d*m/g, "")
    .replace(/\u001B\]8;;[^\u001B]*\u001B\\/g, "");
}

