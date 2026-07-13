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
  reportScanStart,
  reportScanProgress,
  reportScanResults,
} from "../ui/reporter.js";

/**
 * Execute a full project scan, returning a ScanResult.
 *
 * 1. Load config
 * 2. Find & parse .env files
 * 3. Detect env mismatches (missing/unused vars)
 * 4. Check .gitignore coverage
 * 5. Scan working tree for secrets
 * 6. Scan git history for secrets
 * 7. Detect framework & client-exposed secrets
 * 8. Run plugins
 * 9. Calculate health score
 * 10. Report results
 */
export async function executeScan(
  projectDir: string,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const start = Date.now();
  const rootDir = path.resolve(projectDir);
  const config = await loadConfig(rootDir);
  const findings: ScanFinding[] = [];

  // Start spinner unless quiet mode
  const spinner = options.quiet ? null : reportScanStart(rootDir);

  try {
    // ── 1. Find & parse .env files ──────────────────────────────────────
    if (spinner) reportScanProgress(spinner, "Parsing .env files…");

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

    // ── 2. Env mismatch detection ───────────────────────────────────────
    if (spinner) reportScanProgress(spinner, "Checking env variable usage…");

    // Find code files
    const codeFiles = await fg(
      ["**/*.ts", "**/*.js", "**/*.tsx", "**/*.jsx", "**/*.py", "**/*.rb"],
      {
        cwd: rootDir,
        ignore: config.ignore,
        onlyFiles: true,
        absolute: true,
      },
    );

    // Scan code for env references and missing vars
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
          findings.push(...missingFindings);
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Compare env files to find mismatches
    if (parsedEnvFiles.length >= 2) {
      const diffFindings = diffEnvFiles(parsedEnvFiles);
      findings.push(...diffFindings);
    }

    // Find unused env vars
    if (primaryEnv) {
      const unusedFindings = findUnusedEnvVars(
        [...envRefs],
        [...primaryEnv.entries.values()],
        path.relative(rootDir, primaryEnv.filePath),
      );
      findings.push(...unusedFindings);
    }

    // ── 3. Check .gitignore coverage ────────────────────────────────────
    if (spinner) reportScanProgress(spinner, "Checking .gitignore…");

    let gitignoreContent = "";
    try {
      gitignoreContent = await fs.readFile(
        path.join(rootDir, ".gitignore"),
        "utf-8",
      );
    } catch {}

    const gitignoreFindings = await checkEnvFilesIgnoredWithGit(
      rootDir,
      envFiles,
    );
    findings.push(...gitignoreFindings);

    // ── 4. Scan working tree for secrets ────────────────────────────────
    if (spinner) reportScanProgress(spinner, "Scanning for secrets…");

    const scanTargets = await fg(["**/*"], {
      cwd: rootDir,
      ignore: config.ignore,
      onlyFiles: true,
    });

    // Filter to text-like files only
    const textExtensions = new Set([
      ".ts",
      ".js",
      ".tsx",
      ".jsx",
      ".mjs",
      ".cjs",
      ".py",
      ".rb",
      ".go",
      ".rs",
      ".java",
      ".kt",
      ".json",
      ".yaml",
      ".yml",
      ".toml",
      ".xml",
      ".env",
      ".cfg",
      ".conf",
      ".ini",
      ".properties",
      ".sh",
      ".bash",
      ".zsh",
      ".fish",
      ".tf",
      ".hcl",
      ".dockerfile",
      ".md",
      ".txt",
      ".csv",
    ]);

    let scannedFiles = 0;
    for (const file of scanTargets) {
      const ext = path.extname(file).toLowerCase();
      const basename = path.basename(file).toLowerCase();

      // Include dotfiles like .env, .env.local etc.
      const isEnvFile = basename.startsWith(".env");
      if (!isEnvFile && !textExtensions.has(ext) && ext !== "") continue;

      const fullPath = path.join(rootDir, file);
      try {
        const stat = await fs.stat(fullPath);
        // Skip files > 1MB
        if (stat.size > 1_048_576) continue;

        const content = await fs.readFile(fullPath, "utf-8");
        const secretFindings = scanFileForSecrets(
          content,
          file,
          SECRET_RULES,
          config.entropyThreshold,
        );
        findings.push(...secretFindings);
        scannedFiles++;
      } catch {
        // Skip binary/unreadable files
      }
    }

    // ── 5. Scan git history ─────────────────────────────────────────────
    if (spinner) reportScanProgress(spinner, "Scanning git history…");

    try {
      const depth = options.fullHistory ? undefined : config.historyDepth;
      const historyFindings = await scanGitHistory(
        rootDir,
        SECRET_RULES,
        config.entropyThreshold,
        depth,
      );
      findings.push(...historyFindings);
    } catch {
      // Not a git repo or git not available — skip
    }

    // ── 6. Detect framework & client-exposed secrets ────────────────────
    if (spinner) reportScanProgress(spinner, "Detecting framework…");

    let framework: FrameworkInfo | undefined;
    try {
      const detected = await detectFramework(rootDir);
      framework = detected || undefined;
      if (framework && parsedEnvFiles.length > 0) {
        const exposedFindings = checkClientExposedSecrets(
          parsedEnvFiles,
          framework,
          SECRET_RULES,
          config.entropyThreshold,
        );
        findings.push(...exposedFindings);
      }
    } catch {
      // Framework detection failed — non-critical
    }

    // ── 7. Load and run plugins ─────────────────────────────────────────
    if (spinner) reportScanProgress(spinner, "Running plugins…");

    try {
      const plugins = await loadPlugins(config, rootDir);
      if (plugins.length > 0) {
        const pluginContext = await createPluginContext(rootDir, config);
        for (const plugin of plugins) {
          try {
            const result = await plugin.check(pluginContext);
            findings.push(...result.findings);
          } catch {
            // Plugin error — skip silently
          }
        }
      }
    } catch {
      // Plugin loading failed — non-critical
    }

    // ── 8. Apply severity overrides ─────────────────────────────────────
    for (const finding of findings) {
      if (finding.ruleId) {
        const override = config.severityOverrides[finding.ruleId];
        if (override) {
          finding.severity = override;
        }
      }
    }

    // ── 9. Filter by severity if requested ──────────────────────────────
    let filteredFindings = findings;
    if (options.severity) {
      const severityOrder: Record<Severity, number> = {
        critical: 0,
        warning: 1,
        info: 2,
      };
      const minLevel = severityOrder[options.severity];
      filteredFindings = findings.filter(
        (f) => severityOrder[f.severity] <= minLevel,
      );
    }

    // ── 10. Calculate health score ──────────────────────────────────────
    const { score, grade } = calculateHealthScore(filteredFindings);

    const duration = Date.now() - start;
    const result: ScanResult = {
      findings: filteredFindings,
      healthScore: score,
      grade,
      timestamp: new Date(),
      scannedFiles,
      framework,
      duration,
    };

    // ── 11. Report ──────────────────────────────────────────────────────
    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!options.quiet) {
      reportScanResults(result, {
        fun: options.fun ?? config.funMode,
        verbose: options.verbose,
      });
    }

    return result;
  } catch (error) {
    if (spinner) spinner.fail("Scan failed");
    throw error;
  }
}
