// ─── Watch Command ───────────────────────────────────────────────────────────
// Real-time supervision layer supporting both developer interactive mode
// and machine-readable agent supervision mode (`bilt watch --format agent`).
// ─────────────────────────────────────────────────────────────────────────────

import path from "node:path";
import { colors, glyphs, sectionHeader, isPlainMode } from "../ui/theme.js";
import type { WatchOptions, WatchEvent } from "../types/index.js";
import { loadConfig } from "../config/config.js";
import { startWatcher, stopWatcher } from "../core/watch/watcher.js";
import { reportWatchEvent } from "../ui/reporter.js";
import { executeScan } from "./scan.js";
import { formatFinding } from "../ui/format.js";
import { BiltSupervisor } from "../core/watch/supervisor.js";

/**
 * Execute the `bilt watch` command.
 *
 * 1. Initialize BiltSupervisor state machine
 * 2. Start file watcher on project directory
 * 3. On file changes: run supervisory analysis & update change ledger
 * 4. Stream human terminal cards OR machine-readable AgentResponse JSON
 */
export async function executeWatch(
  projectDir: string,
  options: WatchOptions = {},
): Promise<void> {
  const rootDir = path.resolve(projectDir);
  const config = await loadConfig(rootDir);

  const isAgentFormat = options.format === "agent" || options.format === "json" || !!options.agent;
  const supervisor = new BiltSupervisor(rootDir);
  const session = await supervisor.initialize();

  // ── Status banner ───────────────────────────────────────────────────
  if (!isAgentFormat && !options.quiet) {
    console.log("");
    console.log(colors.vitalTeal.bold("  " + glyphs.info + " Bilt Supervisor Watch Mode"));
    if (!isPlainMode()) await new Promise((resolve) => setTimeout(resolve, 80));
    console.log(colors.slateDim.dim(`  Session: ${session.id} | Monitoring ${rootDir} for changes…`));
    if (!isPlainMode()) await new Promise((resolve) => setTimeout(resolve, 80));
    console.log(colors.slateDim.dim("  Press Ctrl+C to stop."));
    if (!isPlainMode()) await new Promise((resolve) => setTimeout(resolve, 80));
    console.log("");
  }

  // ── Initial live baseline ─────────────────────────────────────────
  if (options.live !== false) {
    if (isAgentFormat) {
      await supervisor.handleFileChanges([], true);
    } else {
      const baseline = await executeScan(rootDir, {
        silent: true,
        noVerify: true,
      });

      if (!options.quiet) {
        console.log(sectionHeader("Live Baseline"));
        if (baseline.findings.length === 0) {
          console.log(colors.mintClear.apply("  " + glyphs.passed + " No current findings in baseline scan."));
        } else {
          for (const finding of baseline.findings) {
            console.log(formatFinding(finding, "headline"));
          }
        }
        console.log("");
      }
    }
  }

  // ── Start watcher ──────────────────────────────────────────────────
  const watcher = startWatcher(
    rootDir,
    config,
    async (event: WatchEvent) => {
      const relativePath = path.relative(rootDir, event.file);

      if (isAgentFormat) {
        await supervisor.handleFileChanges([relativePath], true);
      } else {
        if (event.findings.length > 0 || event.type === "unlink") {
          const relativeFindings = event.findings.map((f) => ({
            ...f,
            file: path.relative(rootDir, f.file),
          }));

          await reportWatchEvent({
            ...event,
            file: relativePath,
            findings: relativeFindings,
          });
        }
      }
    },
    {
      debounce: options.debounce,
      poll: options.poll,
    },
  );

  // ── Graceful shutdown ──────────────────────────────────────────────
  const cleanup = async (): Promise<void> => {
    if (!isAgentFormat && !options.quiet) {
      console.log("");
      console.log(colors.slateDim.dim("  Stopping supervisor watcher…"));
    }
    await stopWatcher(watcher);
    if (!isAgentFormat && !options.quiet) {
      console.log(colors.mintClear.apply("  " + glyphs.fixed + " Watcher stopped."));
      console.log("");
    }
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void cleanup();
  });
  process.on("SIGTERM", () => {
    void cleanup();
  });

  // Keep the process running
  await new Promise(() => {
    // Process stays alive until SIGINT/SIGTERM
  });
}
