#!/usr/bin/env node
// ─── Bilt CLI Entry Point ────────────────────────────────────────────────────
// Zero-configuration project health toolkit.

import { Command } from "commander";
import chalk from "chalk";
import { createRequire } from "node:module";
import { executeScan } from "./commands/scan.js";
import { executeInit } from "./commands/init.js";
import { executeFix } from "./commands/fix.js";
import { executeUndo } from "./commands/undo.js";
import { executeDoctor } from "./commands/doctor.js";
import { executeWatch } from "./commands/watch.js";
import type { Severity } from "./types/index.js";

// ─── Version ─────────────────────────────────────────────────────────────────

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

// ─── Program Setup ───────────────────────────────────────────────────────────

const program = new Command();

program
  .name("bilt")
  .description(
    "Zero-configuration project health toolkit. Catch secrets, fix env issues, and keep your repo clean.",
  )
  .version(pkg.version, "-v, --version")
  .option("--no-color", "Disable colored output");

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
  .option("--quiet", "Suppress all output except errors")
  .option("--dry-run", "Show what would be scanned without scanning")
  .option("--fun", "Enable fun mode with celebrations")
  .action(
    async (
      dir: string,
      opts: {
        fullHistory?: boolean;
        json?: boolean;
        severity?: string;
        verbose?: boolean;
        quiet?: boolean;
        dryRun?: boolean;
        fun?: boolean;
      },
    ) => {
      try {
        const result = await executeScan(dir, {
          fullHistory: opts.fullHistory,
          json: opts.json,
          severity: opts.severity as Severity | undefined,
          verbose: opts.verbose,
          quiet: opts.quiet,
          dryRun: opts.dryRun,
          fun: opts.fun,
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
  .action(
    async (
      dir: string,
      opts: {
        safe?: boolean;
        dryRun?: boolean;
        verbose?: boolean;
        quiet?: boolean;
      },
    ) => {
      try {
        await executeFix(dir, {
          safe: opts.safe,
          dryRun: opts.dryRun,
          verbose: opts.verbose,
          quiet: opts.quiet,
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
  .action(async (dir: string) => {
    try {
      await executeUndo(dir);
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
  .action(async (dir: string, opts: { quiet?: boolean; debounce?: string }) => {
    try {
      await executeWatch(dir, {
        quiet: opts.quiet,
        debounce: opts.debounce ? parseInt(opts.debounce, 10) : undefined,
      });
    } catch (error) {
      printError(error);
      process.exitCode = 2;
    }
  });

// ─── bilt doctor ─────────────────────────────────────────────────────────────

program
  .command("doctor")
  .description("Comprehensive health report with detailed breakdown")
  .argument("[dir]", "Project directory", ".")
  .option("--card", "Output a markdown health card to stdout")
  .option("--fun", "Enable celebrations and streak counter")
  .action(async (dir: string, opts: { card?: boolean; fun?: boolean }) => {
    try {
      await executeDoctor(dir, {
        card: opts.card,
        fun: opts.fun,
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
  console.error(chalk.red.bold(`  ✗ Error: ${message}`));
  if (error instanceof Error && error.stack) {
    const stackLines = error.stack.split("\n").slice(1, 4);
    for (const line of stackLines) {
      console.error(chalk.dim(`  ${line.trim()}`));
    }
  }
  console.error("");
}

// ─── Parse & Run ─────────────────────────────────────────────────────────────

program.parse();
