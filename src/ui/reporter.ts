// ─── Reporter — Stunning Terminal Output ─────────────────────────────────────
// Renders every piece of user-visible CLI output.

import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import type { Ora } from 'ora';
import type {
  ScanResult,
  ScanFinding,
  WatchEvent,
  FixAction,
  Snapshot,
  Severity,
} from '../types/index.js';
import {
  formatFinding,
  formatHealthScore,
  formatProviderLink,
  severityIcon,
} from './format.js';

// ─── Scan Lifecycle ──────────────────────────────────────────────────────────

/**
 * Start a scan spinner — returns the ora instance for later updates.
 */
export function reportScanStart(projectDir: string): Ora {
  const spinner = ora({
    text: chalk.cyan(`Scanning project ${chalk.bold(projectDir)}…`),
    spinner: 'dots12',
    color: 'cyan',
  }).start();
  return spinner;
}

/**
 * Update the spinner text mid-scan.
 */
export function reportScanProgress(spinner: Ora, message: string): void {
  spinner.text = chalk.cyan(message);
}

// ─── Scan Results ────────────────────────────────────────────────────────────

/**
 * Print a comprehensive, beautiful scan report with findings grouped by
 * severity and a framed health card.
 */
export function reportScanResults(
  result: ScanResult,
  options: { fun?: boolean; verbose?: boolean } = {},
): void {
  const { findings, healthScore, grade, scannedFiles, duration, framework } =
    result;

  console.log('');

  // ── Group findings by severity ───────────────────────────────────────
  const grouped = groupBySeverity(findings);

  if (findings.length === 0) {
    console.log(
      chalk.green.bold('  ✨ No issues found — your project is squeaky clean!'),
    );
    console.log('');
  } else {
    // Print critical first, then warning, then info
    const order: Severity[] = ['critical', 'warning', 'info'];
    for (const sev of order) {
      const group = grouped.get(sev);
      if (!group || group.length === 0) continue;

      const icon = severityIcon(sev);
      const label = sev.charAt(0).toUpperCase() + sev.slice(1);
      console.log(
        `  ${icon} ${chalk.bold(label)} ${chalk.dim(`(${group.length})`)}`,
      );

      for (const f of group) {
        console.log(formatFinding(f));
        if (options.verbose && f.suggestion) {
          console.log(chalk.dim(`      💡 ${f.suggestion}`));
        }
      }
      console.log('');
    }
  }

  // ── Provider rotation links for secrets ──────────────────────────────
  const providers = new Map<string, ScanFinding>();
  for (const f of findings) {
    if (f.provider && !providers.has(f.provider.name)) {
      providers.set(f.provider.name, f);
    }
  }
  if (providers.size > 0) {
    console.log(chalk.bold('  🔑 Rotate compromised keys:'));
    for (const [, f] of providers) {
      if (f.provider) {
        console.log(formatProviderLink(f.provider));
      }
    }
    console.log('');
  }

  // ── Health card ──────────────────────────────────────────────────────
  const healthBar = formatHealthScore(healthScore, grade);

  const criticalCount = grouped.get('critical')?.length ?? 0;
  const warningCount = grouped.get('warning')?.length ?? 0;
  const envMissing = findings.filter((f) => f.category === 'env-missing').length;
  const gitignoreOk =
    findings.filter((f) => f.category === 'gitignore-missing').length === 0;
  const secretsClean = criticalCount === 0;

  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.bold('  🏗️  BILT HEALTH REPORT'));
  lines.push('');
  lines.push(
    `  Score: ${chalk.bold(String(healthScore))}/100              ${chalk.bold(grade)}`,
  );
  lines.push(`  ${healthBar}`);
  lines.push('');

  // Status lines
  if (secretsClean) {
    lines.push(chalk.green('  ✓ Secrets: Clean'));
  } else {
    lines.push(chalk.red(`  ✗ Secrets: ${criticalCount} found`));
  }

  if (envMissing === 0) {
    lines.push(chalk.green('  ✓ Env vars: All present'));
  } else {
    lines.push(chalk.yellow(`  ⚠ Env vars: ${envMissing} missing`));
  }

  if (gitignoreOk) {
    lines.push(chalk.green('  ✓ .gitignore: OK'));
  } else {
    lines.push(chalk.yellow('  ⚠ .gitignore: Needs attention'));
  }

  if (framework) {
    lines.push(
      chalk.green(`  ✓ Framework: ${framework.displayName} detected`),
    );
  }

  lines.push('');
  lines.push(
    chalk.dim(
      `  Scanned ${scannedFiles} files in ${duration}ms`,
    ),
  );
  lines.push('');

  // Fun mode extras
  if (options.fun) {
    if (healthScore === 100) {
      lines.push(
        chalk.bold.green(
          '  🎉🎉🎉 PERFECT SCORE! You are a security legend! 🎉🎉🎉',
        ),
      );
      lines.push('');
    } else if (healthScore >= 90) {
      lines.push(chalk.green('  🔥 Almost there — keep the streak alive!'));
      lines.push('');
    } else if (healthScore >= 70) {
      lines.push(chalk.yellow('  💪 Not bad! A few tweaks and you\'ll be golden.'));
      lines.push('');
    } else {
      lines.push(chalk.red('  🩹 Time to roll up those sleeves.'));
      lines.push('');
    }
  }

  if (warningCount > 0 && criticalCount === 0) {
    lines.push(
      chalk.dim('  Run `bilt fix` to auto-fix safe issues.'),
    );
    lines.push('');
  } else if (criticalCount > 0) {
    lines.push(
      chalk.dim(
        '  Run `bilt fix --safe` to fix what can be safely automated.',
      ),
    );
    lines.push('');
  }

  const card = boxen(lines.join('\n'), {
    padding: 0,
    margin: { top: 0, bottom: 0, left: 1, right: 1 },
    borderStyle: 'round',
    borderColor: healthScore >= 90 ? 'green' : healthScore >= 70 ? 'yellow' : 'red',
    dimBorder: false,
  });

  console.log(card);
  console.log('');
}

// ─── Watch Events ────────────────────────────────────────────────────────────

/**
 * Print a real-time watch notification for a file event.
 */
export function reportWatchEvent(event: WatchEvent): void {
  const ts = chalk.dim(
    event.timestamp.toLocaleTimeString('en-US', { hour12: false }),
  );

  if (event.findings.length === 0) {
    console.log(`${ts} ${chalk.green('✓')} ${chalk.dim(event.file)} — clean`);
    return;
  }

  for (const f of event.findings) {
    const icon = severityIcon(f.severity);
    console.log(
      `${ts} ${icon} ${chalk.bold(f.message)}  ${chalk.dim(`${event.file}${f.line ? `:${f.line}` : ''}`)}`,
    );
  }
}

// ─── Fix Previews ────────────────────────────────────────────────────────────

/**
 * Show a preview of all fix actions that will be applied.
 */
export function reportFixPreview(actions: FixAction[]): void {
  console.log('');
  console.log(chalk.bold('  📋 Fix Plan'));
  console.log('');

  for (const action of actions) {
    const typeIcon =
      action.type === 'safe'
        ? chalk.green('●')
        : action.type === 'destructive'
          ? chalk.yellow('●')
          : chalk.red('●');
    const typeLabel = chalk.dim(`[${action.type}]`);
    console.log(`  ${typeIcon} ${action.description}  ${typeLabel}`);
    if (action.preview) {
      console.log(chalk.dim(`      ${action.preview}`));
    }
  }

  console.log('');
  console.log(
    chalk.dim(
      `  ${chalk.green('●')} safe  ${chalk.yellow('●')} destructive  ${chalk.red('●')} irreversible`,
    ),
  );
  console.log('');
}

/**
 * Report fix application summary.
 */
export function reportFixComplete(applied: number, skipped: number): void {
  console.log('');
  if (applied > 0) {
    console.log(
      chalk.green.bold(`  ✅ ${applied} fix${applied !== 1 ? 'es' : ''} applied successfully.`),
    );
  }
  if (skipped > 0) {
    console.log(
      chalk.yellow(`  ⏭  ${skipped} fix${skipped !== 1 ? 'es' : ''} skipped.`),
    );
  }
  if (applied > 0) {
    console.log(
      chalk.dim('  A snapshot was saved — run `bilt undo` to revert.'),
    );
  }
  console.log('');
}

// ─── Undo ────────────────────────────────────────────────────────────────────

/**
 * Report a successful undo (snapshot restore).
 */
export function reportUndoComplete(snapshot: Snapshot): void {
  console.log('');
  console.log(chalk.green.bold('  ⏪ Undo successful!'));
  console.log(
    chalk.dim(`  Restored snapshot ${chalk.white(snapshot.id)} (${snapshot.description})`),
  );
  console.log(
    chalk.dim(
      `  ${snapshot.files.length} file${snapshot.files.length !== 1 ? 's' : ''} restored.`,
    ),
  );
  console.log('');
}

// ─── Init Summary ────────────────────────────────────────────────────────────

/**
 * Print the zero-friction onboarding summary after `bilt init`.
 */
export function reportInitComplete(
  result: ScanResult,
  fixesApplied: number,
): void {
  console.log('');

  const banner = boxen(
    `\n${chalk.bold.cyan('  🏗️  Welcome to Bilt!')}\n\n` +
      chalk.dim('  Your project has been scanned and hardened.\n') +
      chalk.dim('  Zero configuration needed.\n'),
    {
      padding: 0,
      margin: { top: 0, bottom: 0, left: 1, right: 1 },
      borderStyle: 'round',
      borderColor: 'cyan',
    },
  );
  console.log(banner);
  console.log('');

  if (fixesApplied > 0) {
    console.log(
      chalk.green(`  ✅ ${fixesApplied} safe fix${fixesApplied !== 1 ? 'es' : ''} applied automatically.`),
    );
  }

  // Delegate to the main health card
  reportScanResults(result, { fun: true });

  console.log(chalk.bold('  🚀 Next steps:'));
  console.log(chalk.dim('     bilt scan     Full project scan'));
  console.log(chalk.dim('     bilt fix      Auto-fix issues'));
  console.log(chalk.dim('     bilt watch    Real-time monitoring'));
  console.log(chalk.dim('     bilt doctor   Detailed health report'));
  console.log('');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupBySeverity(findings: ScanFinding[]): Map<Severity, ScanFinding[]> {
  const map = new Map<Severity, ScanFinding[]>();
  for (const f of findings) {
    const list = map.get(f.severity) ?? [];
    list.push(f);
    map.set(f.severity, list);
  }
  return map;
}
