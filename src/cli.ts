#!/usr/bin/env node
// ─── Bilt CLI Entry Point ────────────────────────────────────────────────────
// Zero-configuration project health toolkit.

import { Command } from "commander";
import { createRequire } from "node:module";
import { executeScan } from "./commands/scan.js";
import { executeApiScan } from "./commands/api-scan.js";
import { executeInit } from "./commands/init.js";
import { executeFix } from "./commands/fix.js";
import { executeUndo } from "./commands/undo.js";
import { executeDoctor } from "./commands/doctor.js";
import { executeWatch } from "./commands/watch.js";
import {
  executeAISetup,
  executeAIStatus,
  executeAIRemove,
  executeAITest,
  executeAILastRequest,
  executeAISwitch,
  executeAIModel,
  executeAIProvider,
} from "./commands/ai.js";
import { executeAsk } from "./commands/ask.js";
import { executeWelcome } from "./commands/welcome.js";
import { checkAndRunFirstTimeOnboarding } from "./core/onboarding/first-run.js";
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

program.hook("preAction", async (thisCommand, actionCommand) => {
  const opts = thisCommand.optsWithGlobals() as { color?: boolean; plain?: boolean; json?: boolean };
  if (opts.color === false) {
    initColorSupport(true);
  }
  if (opts.plain) {
    setPlainMode(true);
  }
  if (actionCommand.name() !== "welcome" && actionCommand.name() !== "theme-preview") {
    await checkAndRunFirstTimeOnboarding({ plain: opts.plain, json: opts.json });
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
  .option("--include-tests", "Include findings in test, fixture, and documentation files")
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
        includeTests?: boolean;
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
          includeTests: opts.includeTests,
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

// ─── bilt api-scan ───────────────────────────────────────────────────────────

program
  .command("api-scan")
  .description("Static API security checks — mass assignment, method allowlists, content validation, exposed docs")
  .argument("[dir]", "Project directory", ".")
  .option("--json", "Output results as JSON")
  .option("--severity <level>", "Minimum severity to report (critical, warning, info)")
  .option("--verbose", "Show detailed output with suggestions")
  .option("--no-details", "Hide detailed five-question output under each headline")
  .option("--quiet", "Suppress all output except errors")
  .option("--debug", "Enable debug logging")
  .action(
    async (
      dir: string,
      opts: {
        json?: boolean;
        severity?: string;
        verbose?: boolean;
        details?: boolean;
        quiet?: boolean;
        debug?: boolean;
      },
    ) => {
      try {
        const result = await executeApiScan(dir, {
          json: opts.json,
          severity: opts.severity as Severity | undefined,
          verbose: opts.verbose,
          details: opts.details,
          quiet: opts.quiet,
          debug: opts.debug,
        });

        const criticals = result.findings.filter((f) => f.severity === "critical").length;
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
  .alias("live")
  .description("Watch the project for changes and scan in real-time")
  .argument("[dir]", "Project directory", ".")
  .option("--quiet", "Only show findings, no status messages")
  .option("--debounce <ms>", "Debounce interval in milliseconds", "300")
  .option("--poll", "Use polling instead of native file events (recommended for WSL/Docker)")
  .option("--no-live", "Disable initial baseline scan before streaming changes")
  .action(
    async (
      dir: string,
      opts: { quiet?: boolean; debounce?: string; poll?: boolean; live?: boolean },
    ) => {
      try {
        await executeWatch(dir, {
          quiet: opts.quiet,
          debounce: opts.debounce ? parseInt(opts.debounce, 10) : undefined,
          poll: opts.poll,
          live: opts.live,
        });
      } catch (error) {
        printError(error);
        process.exitCode = 2;
      }
    },
  );

// ─── bilt report ─────────────────────────────────────────────────────────────

program
  .command("report")
  .description("Export project health report as Markdown or JSON")
  .argument("[dir]", "Project directory", ".")
  .option("--format <format>", "Export format (markdown or json)", "markdown")
  .option("--output <path>", "File path to save the report")
  .option("--export <path>", "File path to save the report (alias)")
  .option("--stdout", "Print report directly to terminal stdout instead of saving to file")
  .action(async (dir: string, opts: { format?: string; output?: string; export?: string; stdout?: boolean }) => {
    try {
      const { executeReport } = await import("./commands/report.js");
      await executeReport(dir, opts);
    } catch (error) {
      printError(error);
      process.exitCode = 2;
    }
  });

// ─── bilt plugin ─────────────────────────────────────────────────────────────

program
  .command("plugin")
  .description("Manage Bilt plugins (install, list, create)")
  .argument("<action>", "Action to perform: list, install, create")
  .argument("[name]", "Plugin name or path")
  .option("--dir <dir>", "Project directory", ".")
  .action(async (action: string, name: string | undefined, opts: { dir?: string }) => {
    try {
      const { executePlugin } = await import("./commands/plugin.js");
      await executePlugin(action, name, opts);
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
  .option("--owasp", "Format health report mapped to OWASP Top 10 categories")
  .option("--debug", "Enable debug logging for file reads")
  .option("--fun", "Enable celebrations and streak counter")
  .action(async (dir: string, opts: { card?: boolean; owasp?: boolean; fun?: boolean; debug?: boolean }) => {
    try {
      await executeDoctor(dir, {
        card: opts.card,
        owasp: opts.owasp,
        fun: opts.fun,
        debug: opts.debug,
      });
    } catch (error) {
      printError(error);
      process.exitCode = 2;
    }
  });

// ─── bilt welcome ────────────────────────────────────────────────────────────

program
  .command("welcome")
  .alias("onboarding")
  .alias("guide")
  .description("Interactive welcome guide & quick-start setup menu")
  .action(async () => {
    try {
      await executeWelcome();
    } catch (error) {
      printError(error);
      process.exitCode = 2;
    }
  });

// ─── bilt ai ─────────────────────────────────────────────────────────────────

const aiCommand = program
  .command("ai")
  .description("Manage optional AI integration (providers, key storage, redaction debug)");

aiCommand
  .command("setup")
  .description("Interactive wizard to connect an AI provider key")
  .action(async () => {
    try {
      await executeAISetup();
    } catch (error) {
      printError(error);
      process.exitCode = 2;
    }
  });

aiCommand
  .command("status")
  .description("Show configured AI provider, masked key, active model, and validation status")
  .action(async () => {
    try {
      await executeAIStatus();
    } catch (error) {
      printError(error);
      process.exitCode = 2;
    }
  });

aiCommand
  .command("switch")
  .description("Interactive menu to switch active AI provider or active model")
  .action(async () => {
    try {
      await executeAISwitch();
    } catch (error) {
      printError(error);
      process.exitCode = 2;
    }
  });

aiCommand
  .command("model")
  .description("Select or change active AI model for the current provider")
  .argument("[model]", "Model ID string (e.g. gpt-4o, claude-3-5-sonnet, gemini-2.0-flash)")
  .action(async (model?: string) => {
    try {
      await executeAIModel(model);
    } catch (error) {
      printError(error);
      process.exitCode = 2;
    }
  });

aiCommand
  .command("provider")
  .description("Switch active AI provider among configured providers")
  .argument("[provider]", "Provider ID (openai, anthropic, gemini, openrouter, groq)")
  .action(async (provider?: string) => {
    try {
      await executeAIProvider(provider);
    } catch (error) {
      printError(error);
      process.exitCode = 2;
    }
  });

aiCommand
  .command("remove")
  .description("Delete stored AI provider key and disable AI features")
  .action(async () => {
    try {
      await executeAIRemove();
    } catch (error) {
      printError(error);
      process.exitCode = 2;
    }
  });

aiCommand
  .command("test")
  .description("Re-validate stored API key against active provider")
  .action(async () => {
    try {
      await executeAITest();
    } catch (error) {
      printError(error);
      process.exitCode = 2;
    }
  });

aiCommand
  .command("last-request")
  .description("Display the last redacted payload sent to AI for user auditing")
  .option("--debug", "Enable debug output")
  .action(async () => {
    try {
      await executeAILastRequest();
    } catch (error) {
      printError(error);
      process.exitCode = 2;
    }
  });

// ─── bilt ask ────────────────────────────────────────────────────────────────

program
  .command("ask")
  .description("Ask a question scoped to current project findings (requires optional AI setup)")
  .argument("<question>", "Question to ask about project health and findings")
  .argument("[dir]", "Project directory", ".")
  .option("--debug", "Show redacted payload context before sending")
  .action(async (question: string, dir: string, opts: { debug?: boolean }) => {
    try {
      await executeAsk(question, dir, { debug: opts.debug });
    } catch (error) {
      printError(error);
      process.exitCode = 2;
    }
  });

// ─── Error Handler ───────────────────────────────────────────────────────────

function printError(error: unknown, debug?: boolean): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error("");
  console.error(colors.pulseCoral.bold(`  ${glyphs.critical} Error: ${message}`));
  if (debug && error instanceof Error && error.stack) {
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
