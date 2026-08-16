// ─── Scan Command ────────────────────────────────────────────────────────────
// Orchestrates all domain scanning passes and produces a unified ScanResult.
// ─────────────────────────────────────────────────────────────────────────────

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
import { detectEcosystem } from "../core/ecosystem/detector.js";
import { generateAIExplanation } from "../core/ai/explainer.js";
import { performEnvScan, findEnvFiles } from "../core/scan/env.js";
import { checkEnvFilesIgnoredWithGit, checkCommonDirsIgnored } from "../core/scan/gitignore.js";
import { scanFileForSecrets, scanGitHistory } from "../core/scan/secrets.js";
import { scanGitRepository } from "../core/scan/git.js";
import { scanDependencies } from "../core/scan/dependencies.js";
import { scanConfigurations } from "../core/scan/config.js";
import { scanPerformance } from "../core/scan/performance.js";
import { performApiScan } from "../core/api-scan/index.js";
import { calculateHealthScore } from "../core/score/health.js";
import { loadPlugins } from "../plugins/loader.js";
import { createPluginContext } from "../plugins/interface.js";
import { SECRET_RULES } from "../core/rules/secret-rules.js";
import { SecurityRuleEngine } from "../core/security-engine/rule-engine.js";
import type { SecurityFindingDetails } from "../core/security-engine/types.js";
import {
  colors,
  glyphs,
  pulseBar,
  isPlainMode,
  Spinner,
  showBliptBanner,
} from "../ui/theme.js";
import { formatFinding } from "../ui/format.js";
import { playSound } from "../ui/sound.js";
import { VERIFIERS } from "../core/scan/verifiers/index.js";
import { createRequire } from "node:module";

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
    const mode = detailsEnabled || isPlain ? "detail" : "headline";
    for (const f of stepFindings) {
      console.log(formatFinding(f, mode));
      if (!isPlain) {
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
      console.log("");
    }
  }

  return stepFindings;
}

function applyOverridesAndFilter(
  findings: ScanFinding[],
  config: any,
  minSeverity?: Severity,
): ScanFinding[] {
  for (const finding of findings) {
    if (finding.ruleId) {
      const override = config.severityOverrides[finding.ruleId];
      if (override) {
        finding.severity = override;
      }
    }
  }

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
 * Execute a full project scan across all 6 health domains.
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
  const detailsEnabled = options.details !== false;

  if (!isQuiet && !isJson) {
    console.log("");
    const require = createRequire(import.meta.url);
    const pkg = require("../../package.json") as { version: string };
    showBliptBanner(pkg.version);
  }

  let scannedFiles = 0;

  // Auto-detect ecosystem
  const ecosystem = await detectEcosystem(rootDir);
  const detectedFramework: FrameworkInfo | undefined = ecosystem.primaryFramework
    ? {
        name: ecosystem.primaryFramework.id,
        displayName: ecosystem.primaryFramework.name,
        clientExposedPrefixes: ecosystem.clientExposedPrefixes,
        configFiles: ecosystem.primaryFramework.configFiles || [],
      }
    : undefined;

  try {
    // 1. Environment & Gitignore Step
    const gitignoreStepFindings = await runScanStep(
      "Checking Git & Environment hygiene",
      isQuiet || isJson,
      async () => {
        const envFiles = await findEnvFiles(rootDir);
        const stepFindings = await checkEnvFilesIgnoredWithGit(rootDir, envFiles);
        const commonDirsFindings = await checkCommonDirsIgnored(rootDir);
        stepFindings.push(...commonDirsFindings);

        const gitRepoFindings = await scanGitRepository(rootDir, {
          historyDepth: config.historyDepth,
        });
        stepFindings.push(...gitRepoFindings);

        return applyOverridesAndFilter(stepFindings, config, options.severity as Severity);
      },
      detailsEnabled,
    );
    findings.push(...gitignoreStepFindings);

    // 2. Environment Variables Step
    const envStepFindings = await runScanStep(
      "Checking environment variable usage",
      isQuiet || isJson,
      async () => {
        return await performEnvScan(rootDir, config, {
          severity: options.severity,
          debug: options.debug,
        });
      },
      detailsEnabled,
    );
    findings.push(...envStepFindings);

    // 3. Secret Intelligence & Credentials Step
    const secretsStepFindings = await runScanStep(
      "Scanning code & history for secrets",
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
              { entropyThreshold: config.entropyThreshold, includeTests: options.includeTests },
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

        // Credential liveness verification
        for (const finding of stepFindings) {
          if (finding.category === "secret-detected" && finding.secret) {
            if (options.noVerify) {
              finding.verificationState = "unverified";
            } else {
              const providerName = finding.provider?.name;
              if (providerName && VERIFIERS[providerName]) {
                try {
                  const state = await VERIFIERS[providerName](finding.secret);
                  finding.verificationState = state;
                  if (state === "verified-live") {
                    finding.confidence = "high";
                  }
                } catch {
                  finding.verificationState = "unverified";
                }
              } else {
                finding.verificationState = "unverified";
              }
            }
            if (!options.retainSecrets) {
              delete finding.secret;
            }
          }
        }

        return applyOverridesAndFilter(stepFindings, config, options.severity as Severity);
      },
      detailsEnabled,
    );
    findings.push(...secretsStepFindings);

    // 3.5. Security Rule Engine Step (Deterministic Anti-Patterns)
    const securityEngineStepFindings = await runScanStep(
      "Auditing deterministic security anti-patterns",
      isQuiet || isJson,
      async () => {
        const stepFindings: ScanFinding[] = [];
        const ruleEngine = new SecurityRuleEngine();
        const scanTargets = await fg(["**/*.{ts,js,tsx,jsx,json,yml,yaml,md,env*,Dockerfile}"], {
          cwd: rootDir,
          ignore: config.ignore,
          onlyFiles: true,
        });

        const filePayloads: Array<{ path: string; content: string }> = [];
        for (const relPath of scanTargets) {
          const fullPath = path.join(rootDir, relPath);
          try {
            const stat = await fs.stat(fullPath);
            if (stat.size > 1_048_576) continue;
            const content = await fs.readFile(fullPath, "utf-8");
            filePayloads.push({ path: relPath, content });
          } catch {
            // Skip unreadable files
          }
        }

        const engineFindings = ruleEngine.analyzeProject(
          filePayloads,
          detectedFramework ? [detectedFramework.name] : []
        );

        engineFindings.forEach((ef: SecurityFindingDetails) => {
          stepFindings.push({
            id: `sec-rule-${ef.ruleId.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            severity: ef.severity,
            category: "framework-warning",
            message: `[${ef.ruleId}] ${ef.title}: ${ef.message}`,
            file: ef.evidence.file,
            line: ef.evidence.line,
            column: ef.evidence.column,
            suggestion: ef.suggestedFix,
            ruleId: ef.ruleId,
            confidence: ef.confidence,
            aiExplanation: {
              whatIsIt: `${ef.title}. ${ef.whyThisIsDangerous}`,
              whyIsItAProblem: ef.whyThisIsDangerous,
              howSerious: `${ef.severity.toUpperCase()} (${ef.confidence} confidence evidence)`,
              canItBeExploited: ef.howAttackersAbuseIt,
              howToFix: ef.suggestedFix,
              canBiltFix: ef.automaticFixAvailability.available,
            },
          });
        });

        return applyOverridesAndFilter(stepFindings, config, options.severity as Severity);
      },
      detailsEnabled,
    );
    findings.push(...securityEngineStepFindings);

    // 3.6. API Security Scan Step (Static Local Analysis)
    const apiScanStepFindings = await runScanStep(
      "Auditing local API routes & spec files",
      isQuiet || isJson,
      async () => {
        const { findings: apiFindings } = await performApiScan(rootDir);
        return applyOverridesAndFilter(apiFindings, config, options.severity as Severity);
      },
      detailsEnabled,
    );
    findings.push(...apiScanStepFindings);

    const depStepFindings = await runScanStep(
      "Auditing dependencies & lockfiles",
      isQuiet || isJson,
      async () => {
        const stepFindings = await scanDependencies(rootDir);
        return applyOverridesAndFilter(stepFindings, config, options.severity as Severity);
      },
      detailsEnabled,
    );
    findings.push(...depStepFindings);

    // 5. Configuration Intelligence Step
    const configStepFindings = await runScanStep(
      "Auditing tool & deployment configurations",
      isQuiet || isJson,
      async () => {
        const stepFindings = await scanConfigurations(rootDir);
        return applyOverridesAndFilter(stepFindings, config, options.severity as Severity);
      },
      detailsEnabled,
    );
    findings.push(...configStepFindings);

    // 6. Performance Insights Step
    const perfStepFindings = await runScanStep(
      "Analyzing performance & bundle health",
      isQuiet || isJson,
      async () => {
        const stepFindings = await scanPerformance(rootDir);
        return applyOverridesAndFilter(stepFindings, config, options.severity as Severity);
      },
      detailsEnabled,
    );
    findings.push(...perfStepFindings);

    // 7. Plugin Execution Step
    const pluginsStepFindings = await runScanStep(
      "Running third-party plugins",
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

    // Enriched findings with structured AI explanations
    for (const f of findings) {
      if (!f.aiExplanation) {
        f.aiExplanation = generateAIExplanation(f);
      }
    }

    // Sort live findings first
    findings.sort((a, b) => {
      const aLive = a.category === "secret-detected" && a.verificationState === "verified-live";
      const bLive = b.category === "secret-detected" && b.verificationState === "verified-live";
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;
      return 0;
    });

    const { score, domainScores, grade } = calculateHealthScore(findings);
    const duration = Date.now() - start;

    const result: ScanResult = {
      findings: findings.filter((f) => f.severity !== "passed"),
      healthScore: score,
      domainScores,
      grade,
      timestamp: new Date(),
      scannedFiles,
      framework: detectedFramework,
      duration,
    };

    if (isJson) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!isQuiet) {
      console.log(pulseBar(score));
      console.log("");

      const criticalCount = findings.filter((f) => f.severity === "critical").length;
      const warningCount = findings.filter((f) => f.severity === "warning").length;
      const issuesCount = criticalCount + warningCount;

      if (criticalCount > 0 && config.sound) {
        playSound();
      }

      const parts: string[] = [];
      if (issuesCount === 0) {
        parts.push(colors.mintClear.apply("all clear"));
      } else {
        parts.push(colors.pulseCoral.apply(`${issuesCount} issue${issuesCount > 1 ? "s" : ""}`));
      }

      parts.push(colors.slateDim.apply("bilt fix"));
      const isPlain = isPlainMode();
      const mode = options.verbose || options.details !== false || isPlain ? "detail" : "headline";
      if (mode !== "detail") {
        parts.push(colors.slateDim.apply("bilt scan"));
      }

      console.log(`  ${parts.join(colors.slateDim.dim(" \u00B7 "))}`);
      console.log("");
    }

    return result;
  } catch (error) {
    throw error;
  }
}
