import type { Command } from "commander";
import {
  executeAISetup,
  executeAIStatus,
  executeAIRemove,
  executeAITest,
  executeAILastRequest,
  executeAISwitch,
  executeAIModel,
  executeAIProvider,
} from "../commands/ai.js";
import { executeAsk } from "../commands/ask.js";
import { printError } from "./common.js";

export function registerAiCommands(program: Command): void {
  // ─── bilt ai ─────────────────────────────────────────────────────────────────
  const aiCommand = program
    .command("ai")
    .description(
      "Manage optional AI integration (providers, key storage, redaction debug)",
    );

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
    .description(
      "Show configured AI provider, masked key, active model, and validation status",
    )
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
    .argument(
      "[model]",
      "Model ID string (e.g. gpt-4o, claude-3-5-sonnet, gemini-2.0-flash)",
    )
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
    .argument(
      "[provider]",
      "Provider ID (openai, anthropic, gemini, openrouter, groq)",
    )
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
    .description(
      "Ask a question scoped to current project findings (requires optional AI setup)",
    )
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
}
