// ─── Scan Command ────────────────────────────────────────────────────────────
// Orchestrates all scanning passes and produces a unified ScanResult.

import path from "node:path";
import { promises as fs } from "node:fs";
import fg from "fast-glob";
import type {
  ScanResult,
  ScanFinding,
  ScanOptions,
  FrameworkInfo,
  Severity,
} from "../types/index.js";
import { loadConfig } from "../config/config.js";
import {
  parseEnvFile,
  findEnvFiles,
  diffEnvFiles,
  scanCodeForEnvRefs,
  findMissingEnvVars,
  findUnusedEnvVars,
} from "../core/scan/env.js";
import { checkEnvFilesIgnoredWithGit } from "../core/scan/gitignore.js";
import { scanFileForSecrets, scanGitHistory } from "../core/scan/secrets.js";
import {
  detectFramework,
  checkClientExposedSecrets,
} from "../core/scan/framework.js";
import { calculateHealthScore } from "../core/score/health.js";
import { loadPlugins } from "../plugins/loader.js";
import { createPluginContext } from "../plugins/interface.js";
import { SECRET_RULES } from "../core/rules/secret-rules.js";
import {
  colors,
  glyphs,
  banner,
  pulseBar,
  isPlainMode,
  Spinner,
} from "../ui/theme.js";
import { formatFinding } from "../ui/format.js";

// Helper to run a scan step and stream findings
async function runScanStep(
  name: string,
  quiet: boolean,
  action: () => Promise<ScanFinding[]>,
  detailsEnabled: boolean,
): Promise<ScanFinding[]> {
  const spinner = quiet ? null : new Spinner(name).start();
  const stepFindings = await action();
  if (spinner) {
    spinner.stop();
  }

  if (!quiet && stepFindings.length > 0) {
    const isPlain = isPlainMode();
    const mode = (detailsEnabled || isPlain) ? "detail" : "headline";
    for (const f of stepFindings) {
      console.log(formatFinding(f, mode));
      if (!isPlain) {
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      console.log("");
    }
  }

  return stepFindings;
}

// Apply overrides and severity filters to a list of findings
function applyOverridesAndFilter(
  findings: ScanFinding[],
  config: any,
  minSeverity?: Severity,
): ScanFinding[] {
  // Apply overrides
  for (const finding of findings) {
    if (finding.ruleId) {
      const override = config.severityOverrides[finding.ruleId];
      if (override) {
        finding.severity = override;
      }
    }
  }

  // Filter by severity
  if (minSeverity) {
    const severityOrder: Record<Severity, number> = {
      critical: 0,
      warning: 1,
      info: 2,
      passed: 3,
    };
    const minLevel = severityOrder[minSeverity];
    return findings.filter((f) => severityOrder[f.severity] <= minLevel);
  }

  return findings;
}

/**
 * Execute a full project scan, returning a ScanResult.
 *
 * 1. Load config
 * 2. Step 1: Check .gitignore
 * 3. Step 2: Check env variable usage (and mismatches, unused, client exposed)
 * 4. Step 3: Check for secrets (working tree & git history)
 * 5. Step 4: Run plugins
 * 6. Calculate health score
 * 7. Report final results
 */
export async function executeScan(
  projectDir: string,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const start = Date.now();
  const rootDir = path.resolve(projectDir);
  const config = await loadConfig(rootDir);
  const findings: ScanFinding[] = [];

  const isQuiet = !!options.quiet;
  const isJson = !!options.json;
  const detailsEnabled = !!options.details;

  if (!isQuiet && !isJson) {
    console.log("");
    console.log(banner());
    console.log("");
  }

  let scannedFiles = 0;
  let detectedFramework: FrameworkInfo | undefined;

  try {
    // ── STEP 1. Check .gitignore ──────────────────────────────────────────
    const gitignoreStepFindings = await runScanStep(
      "Checking .gitignore",
      isQuiet || isJson,
      async () => {
        const envFiles = await findEnvFiles(rootDir);
        const stepFindings = await checkEnvFilesIgnoredWithGit(rootDir, envFiles);
        return applyOverridesAndFilter(stepFindings, config, options.severity as Severity);
      },
      detailsEnabled,
    );
    findings.push(...gitignoreStepFindings);

    // ── STEP 2. Check environment variables ────────────────────────────────
    const envStepFindings = await runScanStep(
      "Checking environment variables",
      isQuiet || isJson,
      async () => {
        const stepFindings: ScanFinding[] = [];
        const envFiles = await findEnvFiles(rootDir);
        const parsedEnvFiles = [];
        for (const envFile of envFiles) {
          try {
            const content = await fs.readFile(envFile, "utf-8");
            const parsed = parseEnvFile(content, envFile);
            parsedEnvFiles.push(parsed);
          } catch {
            // Skip unreadable files
          }
        }

        const codeFiles = await fg(
          ["**/*.ts", "**/*.js", "**/*.tsx", "**/*.jsx", "**/*.py", "**/*.rb"],
          {
            cwd: rootDir,
            ignore: config.ignore,
            onlyFiles: true,
            absolute: true,
          },
        );

        const envRefs = new Set<string>();
        const primaryEnv = parsedEnvFiles[0];
        const definedKeys = primaryEnv ? [...primaryEnv.entries.keys()] : [];

        for (const codeFile of codeFiles) {
          try {
            const content = await fs.readFile(codeFile, "utf-8");
            const refs = scanCodeForEnvRefs(content, codeFile);
            for (const ref of refs) envRefs.add(ref);

            if (primaryEnv) {
              const missingFindings = findMissingEnvVars(
                refs,
                definedKeys,
                path.relative(rootDir, codeFile),
              );
              stepFindings.push(...missingFindings);
            }
          } catch {
            // Skip unreadable files
          }
        }

        if (parsedEnvFiles.length >= 2) {
          const diffFindings = diffEnvFiles(parsedEnvFiles);
          stepFindings.push(...diffFindings);
        }

        if (primaryEnv) {
          const unusedFindings = findUnusedEnvVars(
            [...envRefs],
            [...primaryEnv.entries.values()],
            path.relative(rootDir, primaryEnv.filePath),
          );
          stepFindings.push(...unusedFindings);
        }

        try {
          const detected = await detectFramework(rootDir);
          detectedFramework = detected || undefined;
          if (detectedFramework && parsedEnvFiles.length > 0) {
            const exposedFindings = checkClientExposedSecrets(
              parsedEnvFiles,
              detectedFramework,
              SECRET_RULES,
              config.entropyThreshold,
            );
            stepFindings.push(...exposedFindings);
          }
        } catch {
          // Framework detection failed
        }

        // Apply overrides and severity filters to raw step findings
        let filteredStepFindings = applyOverridesAndFilter(stepFindings, config, options.severity as Severity);

        // Compute healthy env vars
        if (primaryEnv) {
          const envIssueKeys = new Set<string>();
          for (const f of filteredStepFindings) {
            const keyMatch = f.message.match(/Variable "(?<key>[A-Z_][A-Z0-9_]*)"/) ||
                             f.message.match(/process\.env\.(?<key>[A-Z_][A-Z0-9_]*)/);
            if (keyMatch?.groups?.["key"]) {
              envIssueKeys.add(keyMatch.groups["key"]);
            }
          }
          const healthyKeys = definedKeys.filter((k) => !envIssueKeys.has(k));
          if (healthyKeys.length > 0) {
            filteredStepFindings.push({
              id: `env-healthy-${Date.now()}`,
              severity: "passed",
              category: "env-mismatch",
              message: `${healthyKeys.length} var${healthyKeys.length > 1 ? "s" : ""} healthy`,
              file: primaryEnv.filePath,
              suggestion: healthyKeys.join(", "),
            });
          }
        }

        return filteredStepFindings;
      },
      detailsEnabled,
    );
    findings.push(...envStepFindings);

    // ── STEP 3. Check for secrets ─────────────────────────────────────────
    const secretsStepFindings = await runScanStep(
      "Checking for secrets",
      isQuiet || isJson,
      async () => {
        const stepFindings: ScanFinding[] = [];
        const scanTargets = await fg(["**/*"], {
          cwd: rootDir,
          ignore: config.ignore,
          onlyFiles: true,
        });

        const textExtensions = new Set([
          ".ts", ".js", ".tsx", ".jsx", ".mjs", ".cjs", ".py", ".rb", ".go", ".rs",
          ".java", ".kt", ".json", ".yaml", ".yml", ".toml", ".xml", ".env", ".cfg",
          ".conf", ".ini", ".properties", ".sh", ".bash", ".zsh", ".fish", ".tf",
          ".hcl", ".dockerfile", ".md", ".txt", ".csv",
        ]);

        for (const file of scanTargets) {
          const ext = path.extname(file).toLowerCase();
          const basename = path.basename(file).toLowerCase();

          const isEnvFile = basename.startsWith(".env");
          if (!isEnvFile && !textExtensions.has(ext) && ext !== "") continue;

          const fullPath = path.join(rootDir, file);
          try {
            const stat = await fs.stat(fullPath);
            if (stat.size > 1_048_576) continue;

            const content = await fs.readFile(fullPath, "utf-8");
            const secretFindings = scanFileForSecrets(
              content,
              file,
              SECRET_RULES,
              config.entropyThreshold,
            );
            stepFindings.push(...secretFindings);
            scannedFiles++;
          } catch {
            // Skip
          }
        }

        try {
          const depth = options.fullHistory ? undefined : config.historyDepth;
          const historyFindings = await scanGitHistory(
            rootDir,
            SECRET_RULES,
            config.entropyThreshold,
            depth,
          );
          stepFindings.push(...historyFindings);
        } catch {
          // Skip
        }

        return applyOverridesAndFilter(stepFindings, config, options.severity as Severity);
      },
      detailsEnabled,
    );
    findings.push(...secretsStepFindings);

    // ── STEP 4. Running plugins ───────────────────────────────────────────
    const pluginsStepFindings = await runScanStep(
      "Running plugins",
      isQuiet || isJson,
      async () => {
        const stepFindings: ScanFinding[] = [];
        try {
          const plugins = await loadPlugins(config, rootDir);
          if (plugins.length > 0) {
            const pluginContext = await createPluginContext(rootDir, config);
            for (const plugin of plugins) {
              try {
                const result = await plugin.check(pluginContext);
                stepFindings.push(...result.findings);
              } catch {
                // Skip
              }
            }
          }
        } catch {
          // Skip
        }
        return applyOverridesAndFilter(stepFindings, config, options.severity as Severity);
      },
      detailsEnabled,
    );
    findings.push(...pluginsStepFindings);

    // Calculate final score
    // Passed findings don't count towards point deductions
    const { score, grade } = calculateHealthScore(findings);
    const duration = Date.now() - start;

    const result: ScanResult = {
      findings: findings.filter((f) => f.severity !== "passed"),
      healthScore: score,
      grade,
      timestamp: new Date(),
      scannedFiles,
      framework: detectedFramework,
      duration,
    };

    // Report
    if (isJson) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!isQuiet) {
      console.log(pulseBar(score));
      console.log("");

      const criticalCount = findings.filter((f) => f.severity === "critical").length;
      const warningCount = findings.filter((f) => f.severity === "warning").length;
      const issuesCount = criticalCount + warningCount;

      const parts: string[] = [];
      if (issuesCount === 0) {
        parts.push(colors.mintClear.apply("all clear"));
      } else {
        parts.push(colors.pulseCoral.apply(`${issuesCount} issue${issuesCount > 1 ? "s" : ""}`));
      }

      parts.push(colors.slateDim.apply("bilt fix"));
      const isPlain = isPlainMode();
      const mode = (options.verbose || options.details || isPlain) ? "detail" : "headline";
      if (mode !== "detail") {
        parts.push(colors.slateDim.apply("bilt scan --details"));
      }

      console.log(`  ${parts.join(colors.slateDim.dim(" \u00B7 "))}`);
      console.log("");

      // Interactive mode keypress listener
      if (process.stdin.isTTY && !options.details && !isPlain) {
        const hint = colors.slateDim.dim("  (press d for details, any other key to exit)");
        process.stdout.write(hint);

        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding("utf8");

        await new Promise<void>((resolve) => {
          const onData = (key: string) => {
            // Clear the hint line
            process.stdout.write("\r" + " ".repeat(hint.length + 10) + "\r");

            process.stdin.removeListener("data", onData);
            process.stdin.setRawMode(false);
            process.stdin.pause();

            if (key === "\u0003") {
              process.exit(0);
            }

            if (key.toLowerCase() === "d") {
              console.log("");
              // Reprint findings in detailed mode
              for (const f of findings) {
                console.log(formatFinding(f, "detail"));
                console.log("");
              }
              // Print pulse bar and summary again
              console.log(pulseBar(score));
              console.log("");
              console.log(`  ${parts.join(colors.slateDim.dim(" \u00B7 "))}`);
              console.log("");
            }
            resolve();
          };
          process.stdin.on("data", onData);
        });
      }
    }

    return result;
  } catch (error) {
    throw error;
  }
}
