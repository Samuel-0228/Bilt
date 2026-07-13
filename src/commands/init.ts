// ─── Init Command ────────────────────────────────────────────────────────────
// Zero-friction onboarding: scan, auto-fix safe issues, show health card.

import path from 'node:path';
import chalk from 'chalk';
import boxen from 'boxen';
import { promises as fs } from 'node:fs';
import { executeScan } from './scan.js';
import { createSnapshot } from '../core/fix/snapshot.js';
import { addToGitignore, generateEnvExample } from '../core/fix/env-fix.js';
import { checkEnvFilesIgnoredWithGit } from '../core/scan/gitignore.js';
import { findEnvFiles, parseEnvFile } from '../core/scan/env.js';
import { reportInitComplete } from '../ui/reporter.js';
import { SECRET_RULES } from '../core/rules/secret-rules.js';
import { loadConfig } from '../config/config.js';

/**
 * Execute the `bilt init` command.
 *
 * 1. Print welcome banner
 * 2. Run full scan
 * 3. Create snapshot
 * 4. Auto-fix safe issues (.gitignore, .env.example)
 * 5. Report results with the beautiful health card
 */
export async function executeInit(projectDir: string): Promise<void> {
  const rootDir = path.resolve(projectDir);
  const config = await loadConfig(rootDir);

  // ── Welcome banner ──────────────────────────────────────────────────
  const banner = boxen(
    `\n${chalk.bold.cyan('  🏗️  BILT — Project Health Toolkit')}\n\n` +
      chalk.dim('  Zero-configuration setup. One command to a healthy repo.\n'),
    {
      padding: 0,
      margin: { top: 1, bottom: 0, left: 1, right: 1 },
      borderStyle: 'round',
      borderColor: 'cyan',
    },
  );
  console.log(banner);
  console.log('');

  // ── Run full scan ───────────────────────────────────────────────────
  const result = await executeScan(rootDir, {
    quiet: false,
    fun: true,
  });

  // ── Snapshot before fixes ───────────────────────────────────────────
  let fixesApplied = 0;

  // Determine what safe fixes we can apply
  const envFiles = await findEnvFiles(rootDir);
  const envRelativePaths = envFiles.map((f) => path.relative(rootDir, f));

  // Collect files to snapshot
  const filesToSnapshot = ['.gitignore', ...envRelativePaths];
  try {
    await createSnapshot(
      filesToSnapshot.map((f) => path.join(rootDir, f)),
      'Pre-init snapshot',
      rootDir,
    );
  } catch {
    // Snapshot creation failed — proceed anyway
  }

  // ── Auto-fix: .gitignore entries ────────────────────────────────────
  let gitignoreContent = '';
  try {
    gitignoreContent = await fs.readFile(path.join(rootDir, '.gitignore'), 'utf-8');
  } catch {}

  const gitignoreFindings = await checkEnvFilesIgnoredWithGit(
    rootDir,
    envFiles,
  );

  if (gitignoreFindings.length > 0) {
    try {
      const envPatterns = ['.env', '.env.*', '.env.local', '.env.*.local'];
      const gitignorePath = path.join(rootDir, '.gitignore');
      const newContent = await addToGitignore(envPatterns, gitignorePath);
      await fs.writeFile(gitignorePath, newContent, 'utf-8');
      fixesApplied++;
      console.log(chalk.green('  ✅ Added .env patterns to .gitignore'));
    } catch {
      // Failed to update .gitignore — non-critical
    }
  }

  // ── Auto-fix: generate .env.example ─────────────────────────────────
  if (envFiles.length > 0) {
    try {
      const envFilePath = envFiles[0]!;
      const envContent = await fs.readFile(envFilePath, 'utf-8');
      const parsed = parseEnvFile(envContent, envFilePath);
      const exampleContent = generateEnvExample(
        parsed,
        SECRET_RULES,
        config.entropyThreshold,
      );
      await fs.writeFile(
        path.join(rootDir, '.env.example'),
        exampleContent,
        'utf-8',
      );
      fixesApplied++;
      console.log(chalk.green('  ✅ Generated .env.example'));
    } catch {
      // Failed to generate .env.example — non-critical
    }
  }

  // ── Re-run scan to get updated results ──────────────────────────────
  const updatedResult = fixesApplied > 0
    ? await executeScan(rootDir, { quiet: true })
    : result;

  // ── Report ──────────────────────────────────────────────────────────
  reportInitComplete(updatedResult, fixesApplied);
}
