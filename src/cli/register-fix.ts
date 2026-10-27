import type { Command } from "commander";
import { executeFix } from "../commands/fix.js";
import { executeUndo } from "../commands/undo.js";
import { printError } from "./common.js";

export function registerFixCommands(program: Command): void {
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
}
