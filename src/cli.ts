#!/usr/bin/env node
// ─── Bilt CLI Entry Point ────────────────────────────────────────────────────
// Zero-configuration project health toolkit.

import { Command } from "commander";
import { createRequire } from "node:module";
import { executeScan } from "./commands/scan.js";
import { executeInit } from "./commands/init.js";
import { executeFix } from "./commands/fix.js";
import { executeUndo } from "./commands/undo.js";
import { executeDoctor } from "./commands/doctor.js";
import { executeWatch } from "./commands/watch.js";
import type { Severity } from "./types/index.js";
import { colors, glyphs, initColorSupport, setPlainMode, sectionHeader, divider, banner, pulseBar, styledGlyph, text, Spinner, spinnerFrames } from "./ui/theme.js";
import { severityIcon, formatFinding, formatHealthScore } from "./ui/format.js";

// ─── Color Support ───────────────────────────────────────────────────────────

initColorSupport();

// ─── Version ─────────────────────────────────────────────────────────────────

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

// ─── Program Setup ───────────────────────────────────────────────────────────

const program = new Command();

program.hook("preAction", (thisCommand) => {
  const opts = thisCommand.optsWithGlobals() as { color?: boolean; plain?: boolean };
  if (opts.color === false) {
    initColorSupport(true);
  }
  if (opts.plain) {
    setPlainMode(true);
  }
});

program
  .name("bilt")
  .description(
    "Zero-configuration project health toolkit. Catch secrets, fix env issues, and keep your repo clean.",
  )
  .version(pkg.version, "-v, --version")
  .option("--no-color", "Disable colored output")
  .option("--plain", "Plain output for CI — no banner, no color, greppable text");

// ─── bilt scan ───────────────────────────────────────────────────────────────

program
  .command("scan")
  .description(
    "Scan the project for secrets, env issues, and misconfigurations",
  )
  .argument("[dir]", "Project directory", ".")
  .option("--full-history", "Scan all git history (not just recent commits)")
  .option("--json", "Output results as JSON")
  .option(
    "--severity <level>",
    "Minimum severity to report (critical, warning, info)",
  )
  .option("--verbose", "Show detailed output with suggestions")
  .option("--no-details", "Hide detailed output under each headline")
  .option("--quiet", "Suppress all output except errors")
  .option("--dry-run", "Show what would be scanned without scanning")
  .option("--no-verify", "Disable live credential verification calls")
  .option("--debug", "Enable debug logging for path and file resolutions")
  .option("--fun", "Enable fun mode with celebrations")
  .action(
    async (
      dir: string,
      opts: {
        fullHistory?: boolean;
        json?: boolean;
        severity?: string;
        verbose?: boolean;
        details?: boolean;
        quiet?: boolean;
        dryRun?: boolean;
        fun?: boolean;
        verify?: boolean;
        debug?: boolean;
      },
    ) => {
      try {
        const result = await executeScan(dir, {
          fullHistory: opts.fullHistory,
          json: opts.json,
          severity: opts.severity as Severity | undefined,
          verbose: opts.verbose,
          details: opts.details,
          quiet: opts.quiet,
          dryRun: opts.dryRun,
          fun: opts.fun,
          noVerify: opts.verify === false,
          debug: opts.debug,
        });

        // Exit code based on findings
        const criticals = result.findings.filter(
          (f) => f.severity === "critical",
        ).length;
        if (criticals > 0) {
          process.exitCode = 1;
        }
      } catch (error) {
        printError(error);
        process.exitCode = 2;
      }
    },
  );

// ─── bilt init ───────────────────────────────────────────────────────────────

program
  .command("init")
  .description(
    "Initialize Bilt — scan, auto-fix safe issues, and show health report",
  )
  .argument("[dir]", "Project directory", ".")
  .action(async (dir: string) => {
    try {
      await executeInit(dir);
    } catch (error) {
      printError(error);
      process.exitCode = 2;
    }
  });

// ─── bilt fix ────────────────────────────────────────────────────────────────

program
  .command("fix")
  .description("Fix issues found by scan — interactively or automatically")
  .argument("[dir]", "Project directory", ".")
  .option("--safe", "Auto-apply safe fixes only (no prompts)")
  .option("--dry-run", "Preview fixes without applying")
  .option("--verbose", "Show detailed output")
  .option("--quiet", "Suppress non-essential output")
  .option("--debug", "Enable debug logging for file reads and writes")
  .action(
    async (
      dir: string,
      opts: {
        safe?: boolean;
        dryRun?: boolean;
        verbose?: boolean;
        quiet?: boolean;
        debug?: boolean;
      },
    ) => {
      try {
        await executeFix(dir, {
          safe: opts.safe,
          dryRun: opts.dryRun,
          verbose: opts.verbose,
          quiet: opts.quiet,
          debug: opts.debug,
        });
      } catch (error) {
        printError(error);
        process.exitCode = 2;
      }
    },
  );

// ─── bilt undo ───────────────────────────────────────────────────────────────

program
  .command("undo")
  .description("Undo the last set of changes made by bilt fix")
  .argument("[dir]", "Project directory", ".")
  .option("--list", "List the last 10 snapshots")
  .action(async (dir: string, opts: { list?: boolean }) => {
    try {
      await executeUndo(dir, { list: opts.list });
    } catch (error) {
      printError(error);
      process.exitCode = 2;
    }
  });

// ─── bilt watch ──────────────────────────────────────────────────────────────

program
  .command("watch")
  .description("Watch the project for changes and scan in real-time")
  .argument("[dir]", "Project directory", ".")
  .option("--quiet", "Only show findings, no status messages")
  .option("--debounce <ms>", "Debounce interval in milliseconds", "300")
  .option("--poll", "Use polling instead of native file events (recommended for WSL/Docker)")
  .action(
    async (
      dir: string,
      opts: { quiet?: boolean; debounce?: string; poll?: boolean },
    ) => {
      try {
        await executeWatch(dir, {
          quiet: opts.quiet,
          debounce: opts.debounce ? parseInt(opts.debounce, 10) : undefined,
          poll: opts.poll,
        });
      } catch (error) {
        printError(error);
        process.exitCode = 2;
      }
    },
  );

// ─── bilt doctor ─────────────────────────────────────────────────────────────

program
  .command("doctor")
  .description("Comprehensive health report with detailed breakdown")
  .argument("[dir]", "Project directory", ".")
  .option("--card", "Output a markdown health card to stdout")
  .option("--debug", "Enable debug logging for file reads")
  .option("--fun", "Enable celebrations and streak counter")
  .action(async (dir: string, opts: { card?: boolean; fun?: boolean; debug?: boolean }) => {
    try {
      await executeDoctor(dir, {
        card: opts.card,
        fun: opts.fun,
        debug: opts.debug,
      });
    } catch (error) {
      printError(error);
      process.exitCode = 2;
    }
  });

// ─── Error Handler ───────────────────────────────────────────────────────────

function printError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error("");
  console.error(colors.pulseCoral.bold(`  ${glyphs.critical} Error: ${message}`));
  if (error instanceof Error && error.stack) {
    const stackLines = error.stack.split("\n").slice(1, 4);
    for (const line of stackLines) {
      console.error(colors.slateDim.dim(`  ${line.trim()}`));
    }
  }
  console.error("");
}

// ─── bilt theme-preview (hidden) ─────────────────────────────────────────────

program
  .command("theme-preview", { hidden: true })
  .description("Preview all theme glyphs, colors, and components")
  .action(() => {
    console.log("");
    console.log(banner());
    console.log("");
    console.log(pulseBar(92));
    console.log(pulseBar(65));
    console.log(pulseBar(25));
    console.log("");
    console.log(sectionHeader("Glyphs"));
    console.log(`  ${colors.pulseCoral.apply(glyphs.critical)}  critical`);
    console.log(`  ${colors.amberFlag.apply(glyphs.warning)}  warning`);
    console.log(`  ${colors.mintClear.apply(glyphs.passed)}  passed`);
    console.log(`  ${colors.vitalTeal.apply(glyphs.fixed)}  fixed`);
    console.log(`  ${colors.slateDim.apply(glyphs.info)}  info`);
    console.log("");
    console.log(sectionHeader("Colors"));
    console.log(`  ${colors.vitalTeal.apply("Vital Teal")}  — brand accent`);
    console.log(`  ${colors.pulseCoral.apply("Pulse Coral")} — critical`);
    console.log(`  ${colors.amberFlag.apply("Amber Flag")}  — warning`);
    console.log(`  ${colors.mintClear.apply("Mint Clear")}  — pass/healthy`);
    console.log(`  ${colors.slateDim.apply("Slate Dim")}   — secondary`);
    console.log("");
    console.log(divider());
    console.log(`  ${colors.slateDim.dim("Spinner frames: " + spinnerFrames.join(" "))}`);
    console.log("");
  });

// ─── Parse & Run ─────────────────────────────────────────────────────────────

program.parse();
