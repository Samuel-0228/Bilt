// ─── Scan Command Orchestrator ──────────────────────────────────────────────
// Coordinates all domain scanning passes and produces a unified ScanResult.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ScanResult,
  ScanFinding,
  ScanOptions,
  FrameworkInfo,
} from "../types/index.js";
import { loadConfig } from "../config/config.js";
import { detectEcosystem } from "../core/ecosystem/detector.js";
import { showBliptBanner } from "../ui/theme.js";
import { validateProjectDirectory } from "../core/safety/index.js";
import { VERSION } from "../version.js";
import { runScanStep } from "./scan/runner.js";
import {
  type ScanStepContext,
  runGitAndEnvStep,
  runEnvVariablesStep,
  runSecretsStep,
  runSecurityRulesStep,
  runApiSecurityStep,
  runDependenciesStep,
  runConfigStep,
  runPerformanceStep,
  runPluginsStep,
} from "./scan/steps/index.js";
import { enrichScanFindings, buildScanResult } from "./scan/enricher.js";
import { reportScanResult } from "./scan/reporter.js";

export * from "./scan/runner.js";
export * from "./scan/filter.js";
export * from "./scan/steps/index.js";
export * from "./scan/enricher.js";
export * from "./scan/reporter.js";

/**
 * Execute a full project scan across all 6 health domains.
 */
export async function executeScan(
  projectDir: string,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const startTime = Date.now();
  const rootDir = await validateProjectDirectory(projectDir);
  const config = await loadConfig(rootDir);
  const findings: ScanFinding[] = [];

  const isMachineFormat =
    !!options.json ||
    options.format === "agent" ||
    options.format === "sarif" ||
    options.format === "json";
  const isSilent = !!options.silent || isMachineFormat;
  const isQuiet = !!options.quiet;
  const isJson = !!options.json || options.format === "json";
  const detailsEnabled = options.details !== false;

  if (!isQuiet && !isSilent && !isJson && !isMachineFormat) {
    console.log("");
    showBliptBanner(VERSION);
  }

  const runStep = (name: string, action: () => Promise<ScanFinding[]>) =>
    runScanStep(
      name,
      isQuiet || isSilent || isJson,
      action,
      detailsEnabled,
      isSilent,
      isQuiet,
    );

  let scannedFiles = 0;

  // Auto-detect ecosystem
  const ecosystem = await detectEcosystem(rootDir);
  const detectedFramework: FrameworkInfo | undefined =
    ecosystem.primaryFramework
      ? {
          name: ecosystem.primaryFramework.id,
          displayName: ecosystem.primaryFramework.name,
          clientExposedPrefixes: ecosystem.clientExposedPrefixes,
          configFiles: ecosystem.primaryFramework.configFiles || [],
        }
      : undefined;

  const stepContext: ScanStepContext = {
    rootDir,
    config,
    options,
    detectedFramework,
  };

  try {
    // 1. Environment & Gitignore Step
    const gitEnvFindings = await runStep(
      "Checking Git & Environment hygiene",
      () => runGitAndEnvStep(stepContext),
    );
    findings.push(...gitEnvFindings);

    // 2. Environment Variables Step
    const envFindings = await runStep(
      "Checking environment variable usage",
      () => runEnvVariablesStep(stepContext),
    );
    findings.push(...envFindings);

    // 3. Secret Intelligence & Credentials Step
    const secretsResult = await runStep(
      "Scanning code & history for secrets",
      async () => {
        const result = await runSecretsStep(stepContext);
        scannedFiles += result.scannedFiles;
        return result.findings;
      },
    );
    findings.push(...secretsResult);

    // 4. Security Rule Engine Step (Deterministic Anti-Patterns)
    const secRuleFindings = await runStep(
      "Auditing deterministic security anti-patterns",
      () => runSecurityRulesStep(stepContext),
    );
    findings.push(...secRuleFindings);

    // 5. API Security Scan Step (Static Local Analysis)
    const apiFindings = await runStep(
      "Auditing local API routes & spec files",
      () => runApiSecurityStep(stepContext),
    );
    findings.push(...apiFindings);

    // 6. Dependencies & Lockfiles Step
    const depFindings = await runStep(
      "Auditing dependencies & lockfiles",
      () => runDependenciesStep(stepContext),
    );
    findings.push(...depFindings);

    // 7. Configuration Intelligence Step
    const configFindings = await runStep(
      "Auditing tool & deployment configurations",
      () => runConfigStep(stepContext),
    );
    findings.push(...configFindings);

    // 8. Performance Insights Step
    const perfFindings = await runStep(
      "Analyzing performance & bundle health",
      () => runPerformanceStep(stepContext),
    );
    findings.push(...perfFindings);

    // 9. Plugin Execution Step
    const pluginFindings = await runStep(
      "Running third-party plugins",
      () => runPluginsStep(stepContext),
    );
    findings.push(...pluginFindings);

    // Resolve git scope, baseline, and enrich findings
    await enrichScanFindings(findings, rootDir, options);

    const result = buildScanResult(
      findings,
      scannedFiles,
      detectedFramework,
      startTime,
    );

    await reportScanResult({
      result,
      findings,
      options,
      config,
      rootDir,
      isJson,
      isQuiet,
      isSilent,
    });

    return result;
  } catch (error) {
    throw error;
  }
}
