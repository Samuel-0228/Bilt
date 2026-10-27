import type { Command } from "commander";
import { printError } from "./common.js";

export function registerDesignCommands(program: Command): void {
  // ─── bilt design-check ──────────────────────────────────────────────────────
  program
    .command("design-check")
    .description(
      "Detect generic AI/template-driven UI patterns and production UX issues",
    )
    .argument("[dir]", "Project directory", ".")
    .option("--format <format>", "Output format: human, agent, json", "human")
    .option("--fix", "Apply deterministic safe accessibility and UX fixes")
    .option("--changed", "Scan only files modified in working tree vs HEAD")
    .option(
      "--base <ref>",
      "Scan only changes between base git ref and current branch",
    )
    .option("--debug", "Output debug snapshot and rule timing telemetry")
    .action(
      async (
        dir: string,
        opts: {
          format?: "human" | "agent" | "json";
          fix?: boolean;
          changed?: boolean;
          base?: string;
          debug?: boolean;
        },
      ) => {
        try {
          const { executeDesignCheck } = await import(
            "../commands/design-check.js"
          );
          const exitCode = await executeDesignCheck(dir, opts);
          process.exitCode = exitCode;
        } catch (error) {
          printError(error);
          process.exitCode = 2;
        }
      },
    );

  // ─── bilt design-brief ──────────────────────────────────────────────────────
  program
    .command("design-brief")
    .description("Manage the project design brief")
    .argument("[subcommand]", "Subcommand: show | edit | set | clear | questionnaire | questions")
    .argument("[dir]", "Project directory", ".")
    .option("--format <format>", "Output format: human, agent", "human")
    .option("--non-interactive", "Skip questionnaire; print machine-readable status")
    .option("-i, --interactive", "Force interactive questionnaire mode")
    .option("--purpose <text>", "Product purpose and domain")
    .option("--visual <text>", "Visual aesthetic direction (comma-separated or 'surprise me')")
    .option("--colors <text>", "Brand colors or palette (comma-separated hex/names or 'surprise me')")
    .option("--feeling <text>", "Interface atmosphere or emotional tone (comma-separated or 'surprise me')")
    .option("--creative-freedom <mode>", "Creative freedom mode: guided | balanced | creative")
    .option("--json <json>", "Raw JSON payload for setting the brief")
    .action(
      async (
        subcommand: string | undefined,
        dir: string,
        opts: {
          format?: "human" | "agent";
          nonInteractive?: boolean;
          interactive?: boolean;
          purpose?: string;
          visual?: string;
          colors?: string;
          feeling?: string;
          creativeFreedom?: "guided" | "balanced" | "creative";
          json?: string;
        },
      ) => {
        try {
          const known = ["show", "edit", "set", "clear", "questionnaire", "questions"];
          const isKnown = subcommand && known.includes(subcommand.toLowerCase());
          const actualSubcommand = isKnown ? subcommand.toLowerCase() : undefined;
          const targetDir = isKnown ? (dir || ".") : (subcommand || ".");
          const { executeDesignBrief } = await import("../commands/design-brief.js");
          const exitCode = await executeDesignBrief(targetDir, actualSubcommand, opts);
          process.exitCode = exitCode;
        } catch (error) {
          printError(error);
          process.exitCode = 2;
        }
      },
    );
}
