import type { Command } from "commander";
import { executeScan } from "../commands/scan.js";
import { executeApiScan } from "../commands/api-scan.js";
import type { Severity } from "../types/index.js";
import { printError } from "./common.js";

export function registerScanCommands(program: Command): void {
  // ─── bilt scan ─────────────────────────────────────────────────────────────
  program
    .command("scan")
    .description(
      "Scan the project for secrets, env issues, and misconfigurations",
    )
    .argument("[dir]", "Project directory", ".")
    .option("--full-history", "Scan all git history (not just recent commits)")
    .option("--json", "Output results as JSON")
    .option(
      "--format <format>",
      "Output format: agent, sarif, json, text",
      "text",
    )
    .option(
      "--severity <level>",
      "Minimum severity to report (critical, warning, info)",
    )
    .option("--verbose", "Show detailed output with suggestions")
    .option("--no-details", "Hide detailed output under each headline")
    .option("--quiet", "Suppress all output except errors")
    .option("--dry-run", "Show what would be scanned without scanning")
    .option("--no-verify", "Disable live credential verification calls")
    .option(
      "--include-tests",
      "Include findings in test, fixture, and documentation files",
    )
    .option("--debug", "Enable debug logging for path and file resolutions")
    .option("--fun", "Enable fun mode with celebrations")
    .option("--changed", "Scan only files modified in working tree vs HEAD")
    .option(
      "--base <ref>",
      "Scan only changes between base git ref and current branch",
    )
    .option(
      "--max-iterations <n>",
      "Maximum allowed loop iterations before escalating (default 15)",
      "15",
    )
    .action(
      async (
        dir: string,
        opts: {
          fullHistory?: boolean;
          json?: boolean;
          format?: "text" | "json" | "agent" | "sarif";
          severity?: string;
          verbose?: boolean;
          details?: boolean;
          quiet?: boolean;
          dryRun?: boolean;
          fun?: boolean;
          verify?: boolean;
          debug?: boolean;
          includeTests?: boolean;
          changed?: boolean;
          base?: string;
          maxIterations?: string;
        },
      ) => {
        try {
          const result = await executeScan(dir, {
            fullHistory: opts.fullHistory,
            json: opts.json,
            format: opts.format,
            severity: opts.severity as Severity | undefined,
            verbose: opts.verbose,
            details: opts.details,
            quiet: opts.quiet,
            dryRun: opts.dryRun,
            fun: opts.fun,
            noVerify: opts.verify === false,
            debug: opts.debug,
            includeTests: opts.includeTests,
            changed: opts.changed,
            base: opts.base,
            maxIterations: opts.maxIterations
              ? parseInt(opts.maxIterations, 10)
              : undefined,
          });

          // Exit code based on findings (preserve agent and sarif status exit codes)
          if (opts.format !== "agent" && opts.format !== "sarif") {
            const criticals = result.findings.filter(
              (f) => f.severity === "critical",
            ).length;
            if (criticals > 0) {
              process.exitCode = 1;
            }
          }
        } catch (error) {
          printError(error, opts.debug);
          process.exitCode = 2;
        }
      },
    );

  // ─── bilt api-scan ───────────────────────────────────────────────────────────
  program
    .command("api-scan")
    .description(
      "Static API security checks — mass assignment, method allowlists, content validation, exposed docs",
    )
    .argument("[dir]", "Project directory", ".")
    .option("--json", "Output results as JSON")
    .option(
      "--severity <level>",
      "Minimum severity to report (critical, warning, info)",
    )
    .option("--verbose", "Show detailed output with suggestions")
    .option(
      "--no-details",
      "Hide detailed five-question output under each headline",
    )
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
}
