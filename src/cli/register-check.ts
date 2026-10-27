import type { Command } from "commander";
import { printError } from "./common.js";

export function registerCheckCommands(program: Command): void {
  // ─── bilt check ─────────────────────────────────────────────────────────────
  program
    .command("check")
    .description(
      "Comprehensive production-readiness verification for AI-built software",
    )
    .argument("[dir]", "Project directory", ".")
    .option("--format <format>", "Output format: human, agent, json", "human")
    .option("--changed", "Scan only files modified in working tree vs HEAD")
    .option(
      "--base <ref>",
      "Scan only changes between base git ref and current branch",
    )
    .option("--categories <list>", "Comma-separated list of categories to check")
    .action(
      async (
        dir: string,
        opts: {
          format?: "human" | "agent" | "json";
          changed?: boolean;
          base?: string;
          categories?: string;
        },
      ) => {
        try {
          const { executeCheck } = await import("../commands/check.js");
          const exitCode = await executeCheck(dir, opts);
          process.exitCode = exitCode;
        } catch (error) {
          printError(error);
          process.exitCode = 3;
        }
      },
    );

  // ─── bilt requirement ──────────────────────────────────────────────────────
  program
    .command("requirement")
    .alias("requirements")
    .description("Manage structured project requirements in .bilt/requirements.json")
    .argument("[subcommand]", "Subcommand: list | add | remove", "list")
    .argument("[dir]", "Project directory", ".")
    .option("--id <id>", "Requirement ID (e.g. REQ-AUTH-001)")
    .option("--description <text>", "Requirement description")
    .option("--type <type>", "Requirement type (functional, security, authentication, etc.)")
    .option("--priority <priority>", "Requirement priority (critical, high, medium, low)")
    .option("--target <files>", "Comma-separated target files or patterns")
    .option("--format <format>", "Output format: human, agent, json", "human")
    .action(
      async (
        subcommand: string,
        dir: string,
        opts: {
          id?: string;
          description?: string;
          type?: string;
          priority?: string;
          target?: string;
          format?: "human" | "agent" | "json";
        },
      ) => {
        try {
          const { executeRequirement } = await import("../commands/requirements.js");
          const exitCode = await executeRequirement(dir, subcommand, opts);
          process.exitCode = exitCode;
        } catch (error) {
          printError(error);
          process.exitCode = 2;
        }
      },
    );

  // ─── bilt explain ───────────────────────────────────────────────────────────
  program
    .command("explain")
    .description("Explain production-readiness concepts and inspection guidelines")
    .argument(
      "[target]",
      "Category or Rule ID to explain (e.g. auth, authorization, RULE-SEC-001)",
    )
    .option("--json", "Output explanation as JSON")
    .option("--format <format>", "Output format: text, json, agent", "text")
    .action(
      async (
        target?: string,
        opts?: { json?: boolean; format?: "text" | "json" | "agent" },
      ) => {
        try {
          const { executeExplain } = await import("../commands/explain.js");
          const exitCode = await executeExplain(target, {
            json: opts?.json,
            format: opts?.format,
          });
          process.exitCode = exitCode;
        } catch (error) {
          printError(error);
          process.exitCode = 2;
        }
      },
    );

  // ─── bilt accept-risk ───────────────────────────────────────────────────────
  program
    .command("accept-risk")
    .description(
      "Formally record an accepted risk for a non-mandatory readiness finding",
    )
    .argument("[finding-id...]", "Rule or finding ID to accept risk for")
    .option(
      "--id <id>",
      "Finding or rule ID to accept risk for",
    )
    .option(
      "--finding <id>",
      "Alias for --id",
    )
    .option(
      "--reason <reason>",
      "Detailed explanation why the risk is accepted",
    )
    .option(
      "--owner <owner>",
      "Person or team taking ownership of the accepted risk",
    )
    .option("--category <category>", "Finding category")
    .option(
      "--expires <date>",
      "ISO expiry date (YYYY-MM-DD) after which risk re-flags",
    )
    .option("--dir <dir>", "Project directory", ".")
    .action(
      async (
        findingIdArg: string | string[] | undefined,
        opts: {
          id?: string;
          finding?: string;
          reason?: string;
          owner?: string;
          category?: string;
          expires?: string;
          dir?: string;
        },
      ) => {
        try {
          const { executeAcceptRisk } = await import("../commands/accept-risk.js");
          const exitCode = await executeAcceptRisk(findingIdArg, opts);
          process.exitCode = exitCode;
        } catch (error) {
          printError(error);
          process.exitCode = 2;
        }
      },
    );
}
