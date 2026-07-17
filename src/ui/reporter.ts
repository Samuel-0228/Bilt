// ─── Reporter — Pulse Terminal Output ────────────────────────────────────────
// Renders every piece of user-visible CLI output using the Pulse design system.
// No direct chalk/boxen/ora calls — everything goes through theme.ts.

import {
  colors,
  glyphs,
  banner,
  pulseBar,
  sectionHeader,
  ruleLine,
  divider,
  summaryBox,
  styledGlyph,
  severityColor,
  text,
  Spinner,
  isPlainMode,
} from "./theme.js";
import type {
  ScanResult,
  ScanFinding,
  WatchEvent,
  FixAction,
  Snapshot,
  Severity,
  FindingCategory,
} from "../types/index.js";
import { formatFinding, formatProviderLink } from "./format.js";

// ─── Category Display Config ─────────────────────────────────────────────────

interface CategoryGroup {
  label: string;
  categories: FindingCategory[];
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    label: "Environment variables",
    categories: ["env-missing", "env-unused", "env-mismatch", "env-exposed"],
  },
  { label: "Secrets", categories: ["secret-detected"] },
  { label: ".gitignore", categories: ["gitignore-missing"] },
  { label: "Framework", categories: ["framework-warning"] },
  { label: "Plugins", categories: ["plugin-finding"] },
];

// ─── Scan Lifecycle ──────────────────────────────────────────────────────────

/**
 * Start a scan spinner — returns a Spinner instance for later updates.
 */
export function reportScanStart(projectDir: string): Spinner {
  const spinner = new Spinner(`Scanning project ${projectDir}\u2026`);
  spinner.start();
  return spinner;
}

/**
 * Update the spinner text mid-scan.
 */
export function reportScanProgress(spinner: Spinner, message: string): void {
  spinner.text = message;
}

// ─── Scan Results ────────────────────────────────────────────────────────────

/**
 * Print the full Pulse-styled scan report:
 * 1. Banner (BILT wordmark)
 * 2. Pulse Bar (health score)
 * 3. Findings grouped by category
 * 4. Provider rotation links
 * 5. Divider + summary line + CTA
 */
export function reportScanResults(
  result: ScanResult,
  options: { verbose?: boolean; details?: boolean } = {},
): void {
  const { findings, healthScore } = result;

  console.log("");

  // ── Banner ─────────────────────────────────────────────────────────
  console.log(banner());
  console.log("");

  const mode = (options.verbose || options.details || isPlainMode()) ? "detail" : "headline";

  // ── Findings ───────────────────────────────────────────────────────
  if (findings.length === 0) {
    console.log(
      `  ${colors.mintClear.apply(glyphs.passed)} ${colors.mintClear.bold("No issues found \u2014 your project is clean")}`,
    );
    console.log("");
  } else {
    for (const f of findings) {
      console.log(formatFinding(f, mode));
      console.log("");
    }
  }

  // ── Pulse Bar ──────────────────────────────────────────────────────
  console.log(pulseBar(healthScore));
  console.log("");

  // ── Summary & CTA ──────────────────────────────────────────────────
  const criticalCount = findings.filter(
    (f) => f.severity === "critical",
  ).length;
  const warningCount = findings.filter(
    (f) => f.severity === "warning",
  ).length;
  const issuesCount = criticalCount + warningCount;

  const parts: string[] = [];
  if (issuesCount === 0) {
    parts.push(colors.mintClear.apply("all clear"));
  } else {
    parts.push(colors.pulseCoral.apply(`${issuesCount} issue${issuesCount > 1 ? "s" : ""}`));
  }

  parts.push(colors.slateDim.apply("bilt fix"));
  if (mode !== "detail") {
    parts.push(colors.slateDim.apply("bilt scan --details"));
  }

  console.log(`  ${parts.join(colors.slateDim.dim(" \u00B7 "))}`);
  console.log("");
}

// ─── Watch Events ────────────────────────────────────────────────────────────

/**
 * Print a real-time watch notification for a file event.
 */
export function reportWatchEvent(event: WatchEvent): void {
  const ts = colors.slateDim.dim(
    event.timestamp.toLocaleTimeString("en-US", { hour12: false }),
  );

  if (event.findings.length === 0) {
    console.log(
      `${ts} ${colors.mintClear.apply(glyphs.passed)} ${colors.slateDim.apply(event.file)} \u2014 clean`,
    );
    return;
  }

  for (const f of event.findings) {
    const icon = styledGlyph(f.severity);
    const loc = colors.slateDim.apply(
      `${event.file}${f.line ? `:${f.line}` : ""}`,
    );
    console.log(`${ts} ${icon} ${text.bold(f.message)}  ${loc}`);
  }
}

// ─── Fix Previews ────────────────────────────────────────────────────────────

/**
 * Show a preview of all fix actions that will be applied.
 */
export function reportFixPreview(actions: FixAction[]): void {
  console.log("");
  console.log(sectionHeader("Fix plan"));
  console.log("");

  for (const action of actions) {
    const typeGlyph =
      action.type === "safe"
        ? colors.mintClear.apply(glyphs.passed)
        : action.type === "destructive"
          ? colors.amberFlag.apply(glyphs.warning)
          : colors.pulseCoral.apply(glyphs.critical);
    const typeLabel = colors.slateDim.dim(`[${action.type}]`);
    console.log(`  ${typeGlyph} ${action.description}  ${typeLabel}`);
    if (action.preview) {
      console.log(colors.slateDim.dim(`      ${action.preview}`));
    }
  }

  console.log("");
  console.log(
    colors.slateDim.dim(
      `  ${colors.mintClear.apply(glyphs.passed)} safe  ${colors.amberFlag.apply(glyphs.warning)} destructive  ${colors.pulseCoral.apply(glyphs.critical)} irreversible`,
    ),
  );
  console.log("");
}

/**
 * Report fix application summary.
 */
export function reportFixComplete(applied: number, skipped: number): void {
  console.log("");
  if (applied > 0) {
    console.log(
      colors.mintClear.bold(
        `  ${glyphs.fixed} ${applied} fix${applied !== 1 ? "es" : ""} applied successfully`,
      ),
    );
  }
  if (skipped > 0) {
    console.log(
      colors.amberFlag.apply(
        `  ${glyphs.info} ${skipped} fix${skipped !== 1 ? "es" : ""} skipped`,
      ),
    );
  }
  if (applied > 0) {
    console.log(
      colors.slateDim.dim(
        `  A snapshot was saved \u2014 run ${text.bold("bilt undo")} to revert`,
      ),
    );
  }
  console.log("");
}

// ─── Undo ────────────────────────────────────────────────────────────────────

/**
 * Report a successful undo (snapshot restore).
 */
export function reportUndoComplete(snapshot: Snapshot): void {
  console.log("");
  console.log(
    colors.mintClear.bold(`  ${glyphs.fixed} Undo successful`),
  );
  console.log(
    colors.slateDim.dim(
      `  Restored snapshot ${text.bold(snapshot.id)} (${snapshot.description})`,
    ),
  );
  console.log(
    colors.slateDim.dim(
      `  ${snapshot.files.length} file${snapshot.files.length !== 1 ? "s" : ""} restored`,
    ),
  );
  console.log("");
}

// ─── Init Summary ────────────────────────────────────────────────────────────

/**
 * Print the zero-friction onboarding summary after `bilt init`.
 */
export function reportInitComplete(
  result: ScanResult,
  fixesApplied: number,
): void {
  console.log("");

  // Banner
  console.log(banner());
  console.log("");
  console.log(
    `  ${colors.vitalTeal.bold("Welcome to Bilt")}`,
  );
  console.log(
    colors.slateDim.dim("  Your project has been scanned and hardened."),
  );
  console.log(
    colors.slateDim.dim("  Zero configuration needed."),
  );
  console.log("");

  if (fixesApplied > 0) {
    console.log(
      colors.mintClear.apply(
        `  ${glyphs.fixed} ${fixesApplied} safe fix${fixesApplied !== 1 ? "es" : ""} applied automatically`,
      ),
    );
  }

  // Delegate to the main scan results display
  reportScanResults(result);

  // Next steps
  console.log(sectionHeader("Next steps"));
  console.log(
    colors.slateDim.dim(`     ${text.bold("bilt scan")}     Full project scan`),
  );
  console.log(
    colors.slateDim.dim(`     ${text.bold("bilt fix")}      Auto-fix issues`),
  );
  console.log(
    colors.slateDim.dim(`     ${text.bold("bilt watch")}    Real-time monitoring`),
  );
  console.log(
    colors.slateDim.dim(`     ${text.bold("bilt doctor")}   Detailed health report`),
  );
  console.log("");
}
