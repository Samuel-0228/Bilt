import type { Command } from "commander";
import { executeWatch } from "../commands/watch.js";
import { colors, glyphs, banner, pulseBar, sectionHeader, divider, spinnerFrames } from "../ui/theme.js";
import { printError } from "./common.js";

export function registerAdvancedCommands(program: Command): void {
  // ─── bilt watch ──────────────────────────────────────────────────────────────
  program
    .command("watch")
    .alias("live")
    .description("Watch the project for changes and scan in real-time")
    .argument("[dir]", "Project directory", ".")
    .option("--format <format>", "Output format: human, agent, json", "human")
    .option("--agent", "Agent supervision mode (streams machine-readable AgentResponse JSON)")
    .option("--quiet", "Only show findings, no status messages")
    .option("--debounce <ms>", "Debounce interval in milliseconds", "300")
    .option(
      "--poll",
      "Use polling instead of native file events (recommended for WSL/Docker)",
    )
    .option("--no-live", "Disable initial baseline scan before streaming changes")
    .action(
      async (
        dir: string,
        opts: {
          format?: "human" | "agent" | "json";
          agent?: boolean;
          quiet?: boolean;
          debounce?: string;
          poll?: boolean;
          live?: boolean;
        },
      ) => {
        try {
          await executeWatch(dir, {
            format: opts.format,
            agent: opts.agent,
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
    .option(
      "--stdout",
      "Print report directly to terminal stdout instead of saving to file",
    )
    .action(
      async (
        dir: string,
        opts: {
          format?: string;
          output?: string;
          export?: string;
          stdout?: boolean;
        },
      ) => {
        try {
          const { executeReport } = await import("../commands/report.js");
          await executeReport(dir, opts);
        } catch (error) {
          printError(error);
          process.exitCode = 2;
        }
      },
    );

  // ─── bilt plugin ─────────────────────────────────────────────────────────────
  program
    .command("plugin")
    .description("Manage Bilt plugins (install, list, create)")
    .argument("<action>", "Action to perform: list, install, create")
    .argument("[name]", "Plugin name or path")
    .option("--dir <dir>", "Project directory", ".")
    .action(
      async (
        action: string,
        name: string | undefined,
        opts: { dir?: string },
      ) => {
        try {
          const { executePlugin } = await import("../commands/plugin.js");
          await executePlugin(action, name, opts);
        } catch (error) {
          printError(error);
          process.exitCode = 2;
        }
      },
    );

  // ─── bilt baseline ───────────────────────────────────────────────────────────
  const baselineCmd = program
    .command("baseline")
    .description("Manage security baseline fingerprints");

  baselineCmd
    .command("create")
    .description(
      "Record current finding fingerprints as a baseline in .bilt/baseline.json",
    )
    .argument("[dir]", "Project directory", ".")
    .option("--json", "Output results as JSON")
    .action(async (dir: string, opts: { json?: boolean }) => {
      try {
        const { executeBaselineCreate } = await import("../commands/baseline.js");
        await executeBaselineCreate(dir, opts);
      } catch (error) {
        printError(error);
        process.exitCode = 2;
      }
    });

  // ─── bilt loop ───────────────────────────────────────────────────────────────
  const loopCmd = program
    .command("loop")
    .description("Manage agent supervision loop state and budget");

  loopCmd
    .command("reset")
    .description("Reset the runaway loop counter and iteration history")
    .argument("[dir]", "Project directory", ".")
    .option("--json", "Output results as JSON")
    .action(async (dir: string, opts: { json?: boolean }) => {
      try {
        const { resetLoopState } = await import("../core/loop/state.js");
        const rootDir = (await import("node:path")).resolve(dir);
        await resetLoopState(rootDir);
        if (opts.json) {
          console.log(
            JSON.stringify(
              { success: true, message: "Loop state reset successfully." },
              null,
              2,
            ),
          );
        } else {
          console.log(
            `  ${colors.mintClear.apply(glyphs.passed)} Loop state reset successfully.`,
          );
        }
      } catch (error) {
        printError(error);
        process.exitCode = 2;
      }
    });

  loopCmd
    .command("status")
    .description("Inspect current loop iteration count and history")
    .argument("[dir]", "Project directory", ".")
    .option("--json", "Output results as JSON")
    .action(async (dir: string, opts: { json?: boolean }) => {
      try {
        const { readLoopState } = await import("../core/loop/state.js");
        const rootDir = (await import("node:path")).resolve(dir);
        const state = await readLoopState(rootDir);
        if (opts.json) {
          console.log(JSON.stringify(state, null, 2));
        } else {
          console.log(
            `  Loop Iteration: ${colors.vitalTeal.bold(String(state.currentIteration))}`,
          );
          console.log(
            `  History Runs: ${colors.slateDim.dim(String(state.history.length))}`,
          );
        }
      } catch (error) {
        printError(error);
        process.exitCode = 2;
      }
    });

  // ─── bilt verify ─────────────────────────────────────────────────────────────
  program
    .command("verify")
    .description(
      "Strict verification against base ref for CI and pull requests (fails on tamper)",
    )
    .argument("[dir]", "Project directory", ".")
    .option(
      "--base <ref>",
      "Base git ref to compare against (e.g. origin/main, HEAD~1)",
      "HEAD~1",
    )
    .option(
      "--format <format>",
      "Output format: agent, sarif, json, text",
      "agent",
    )
    .option("--snippets", "Include sanitized code snippets in untrusted_snippet")
    .option(
      "--max-iterations <n>",
      "Maximum allowed loop iterations before escalating (default 15)",
      "15",
    )
    .action(
      async (
        dir: string,
        opts: {
          base?: string;
          format?: string;
          snippets?: boolean;
          maxIterations?: string;
        },
      ) => {
        try {
          const { executeVerify } = await import("../commands/verify.js");
          await executeVerify(dir, {
            base: opts.base,
            format: opts.format as any,
            snippets: opts.snippets,
            maxIterations: opts.maxIterations
              ? parseInt(opts.maxIterations, 10)
              : undefined,
          });
        } catch (error) {
          printError(error);
          process.exitCode = 3;
        }
      },
    );

  // ─── bilt mcp ────────────────────────────────────────────────────────────────
  program
    .command("mcp")
    .description(
      "Start the Model Context Protocol (MCP) stdio server for AI agents",
    )
    .action(async () => {
      try {
        const { startMcpServer } = await import("../mcp/server.js");
        startMcpServer();
      } catch (error) {
        printError(error);
        process.exitCode = 3;
      }
    });

  // ─── bilt prompt ─────────────────────────────────────────────────────────────
  program
    .command("prompt")
    .description("Print agent prompt instructions for LLM coding agents")
    .option(
      "--agent <name>",
      "Target agent name (e.g., claude, cursor, default)",
      "default",
    )
    .action(async (opts: { agent?: string }) => {
      try {
        const { executePrompt } = await import("../commands/prompt.js");
        await executePrompt({ agent: opts.agent });
      } catch (error) {
        printError(error);
        process.exitCode = 2;
      }
    });

  // ─── bilt test:foundation ────────────────────────────────────────────────────
  program
    .command("test:foundation")
    .description(
      "Run Phase 1 Foundation verification (safe ingestion, unknown facts, determinism, arch lint)",
    )
    .action(async () => {
      const { spawnSync } = await import("node:child_process");
      const result = spawnSync("npx", ["vitest", "run", "--project", "foundation"], {
        stdio: "inherit",
      });
      process.exitCode = result.status ?? 0;
    });

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
      console.log(
        `  ${colors.slateDim.dim("Spinner frames: " + spinnerFrames.join(" "))}`,
      );
      console.log("");
    });
}
