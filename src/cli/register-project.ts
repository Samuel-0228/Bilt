import type { Command } from "commander";
import { executeDoctor } from "../commands/doctor.js";
import { executeWelcome } from "../commands/welcome.js";
import { printError } from "./common.js";

export function registerProjectCommands(program: Command): void {
  // ─── bilt init ───────────────────────────────────────────────────────────────
  program
    .command("init")
    .description(
      "Initialize Bilt — scan, auto-fix safe issues, and show health report",
    )
    .argument("[dir]", "Project directory", ".")
    .option(
      "--agent [name]",
      "Initialize agent guidelines and hooks (e.g. claude, cursor, default)",
    )
    .option("--dry-run", "Preview changes without writing files")
    .option("--force", "Overwrite existing agent configuration files")
    .action(
      async (
        dir: string,
        opts: { agent?: string | boolean; dryRun?: boolean; force?: boolean },
      ) => {
        try {
          const agentName =
            typeof opts.agent === "string"
              ? opts.agent
              : opts.agent
                ? "default"
                : undefined;
          const { executeInit } = await import("../commands/init.js");
          await executeInit(dir, {
            agent: agentName,
            dryRun: opts.dryRun,
            force: opts.force,
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
    .option("--owasp", "Format health report mapped to OWASP Top 10 categories")
    .option("--debug", "Enable debug logging for file reads")
    .option("--fun", "Enable celebrations and streak counter")
    .action(
      async (
        dir: string,
        opts: { card?: boolean; owasp?: boolean; fun?: boolean; debug?: boolean },
      ) => {
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
      },
    );

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
}
