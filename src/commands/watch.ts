// ─── Watch Command ───────────────────────────────────────────────────────────
// Real-time file monitoring with instant secret & env scanning.

import path from 'node:path';
import chalk from 'chalk';
import type { WatchOptions, WatchEvent } from '../types/index.js';
import { loadConfig } from '../config/config.js';
import { startWatcher, stopWatcher } from '../core/watch/watcher.js';
import { reportWatchEvent } from '../ui/reporter.js';

/**
 * Execute the `bilt watch` command.
 *
 * 1. Start file watcher on the project directory
 * 2. On file changes: scan for secrets and report findings
 * 3. Handle SIGINT for graceful shutdown
 */
export async function executeWatch(
  projectDir: string,
  options: WatchOptions = {},
): Promise<void> {
  const rootDir = path.resolve(projectDir);
  const config = await loadConfig(rootDir);

  // ── Status banner ───────────────────────────────────────────────────
  if (!options.quiet) {
    console.log('');
    console.log(
      chalk.cyan.bold('  👁️  Bilt Watch Mode'),
    );
    console.log(
      chalk.dim(`  Monitoring ${rootDir} for changes…`),
    );
    console.log(
      chalk.dim('  Press Ctrl+C to stop.'),
    );
    console.log('');
  }

  // ── Start watcher ──────────────────────────────────────────────────
  const watcher = startWatcher(rootDir, config, (event: WatchEvent) => {
    // Only report if there are findings or the file was deleted
    if (event.findings.length > 0 || event.type === 'unlink') {
      // Map absolute path back to relative path for formatting
      const relativePath = path.relative(rootDir, event.file);
      const relativeFindings = event.findings.map(f => ({
        ...f,
        file: path.relative(rootDir, f.file),
      }));

      reportWatchEvent({
        ...event,
        file: relativePath,
        findings: relativeFindings,
      });
    }
  });

  // ── Graceful shutdown ──────────────────────────────────────────────
  const cleanup = async (): Promise<void> => {
    if (!options.quiet) {
      console.log('');
      console.log(chalk.dim('  Stopping watcher…'));
    }
    await stopWatcher(watcher);
    if (!options.quiet) {
      console.log(chalk.green('  ✓ Watcher stopped.'));
      console.log('');
    }
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void cleanup();
  });
  process.on('SIGTERM', () => {
    void cleanup();
  });

  // Keep the process running
  await new Promise(() => {
    // This promise intentionally never resolves — the process stays alive
    // until SIGINT/SIGTERM.
  });
}
