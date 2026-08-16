// ─── API Scan Command ─────────────────────────────────────────────────────────
// Runs static, local API security analysis against local source code & OpenAPI specs.
// ─────────────────────────────────────────────────────────────────────────────

import path from "node:path";
import { createRequire } from "node:module";
import type { ScanFinding, ScanOptions, ScanResult, Severity } from "../types/index.js";
import { loadConfig } from "../config/config.js";
import { performApiScan } from "../core/api-scan/index.js";
import { calculateHealthScore } from "../core/score/health.js";
import { generateAIExplanation } from "../core/ai/explainer.js";
import { colors, isPlainMode, pulseBar, Spinner, showBliptBanner } from "../ui/theme.js";
import { formatFinding } from "../ui/format.js";

export async function executeApiScan(
  projectDir: string,
  options: ScanOptions = {}
): Promise<ScanResult> {
  const start = Date.now();
  const rootDir = path.resolve(projectDir);
  const config = await loadConfig(rootDir);

  const isQuiet = !!options.quiet;
  const isJson = !!options.json;
  const detailsEnabled = options.details !== false || options.verbose;

  if (!isQuiet && !isJson) {
    console.log("");
    const require = createRequire(import.meta.url);
    const pkg = require("../../package.json") as { version: string };
    showBliptBanner(pkg.version);
  }

  const spinner = isQuiet || isJson ? null : new Spinner("Analyzing local API routes & spec files").start();

  const { findings, routes } = await performApiScan(rootDir);

  if (spinner) {
    spinner.stop();
  }

  // Enrich findings with AI explanations if missing
  for (const f of findings) {
    if (!f.aiExplanation) {
      f.aiExplanation = generateAIExplanation(f);
    }
  }

  // Filter by min severity if requested
  let filteredFindings = findings;
  if (options.severity) {
    const severityOrder: Record<Severity, number> = {
      critical: 0,
      warning: 1,
      info: 2,
      passed: 3,
    };
    const minLevel = severityOrder[options.severity as Severity] ?? 3;
    filteredFindings = findings.filter((f) => severityOrder[f.severity] <= minLevel);
  }

  const { score, domainScores, grade } = calculateHealthScore(filteredFindings);
  const duration = Date.now() - start;

  const result: ScanResult = {
    findings: filteredFindings,
    healthScore: score,
    domainScores,
    grade,
    timestamp: new Date(),
    scannedFiles: routes.length,
    duration,
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else if (!isQuiet) {
    const isPlain = isPlainMode();
    const mode = detailsEnabled || isPlain ? "detail" : "headline";

    if (filteredFindings.length > 0) {
      console.log("");
      for (const f of filteredFindings) {
        console.log(formatFinding(f, mode));
        console.log("");
      }
    }

    console.log(pulseBar(score));
    console.log("");

    const criticalCount = filteredFindings.filter((f) => f.severity === "critical").length;
    const warningCount = filteredFindings.filter((f) => f.severity === "warning").length;
    const issuesCount = criticalCount + warningCount;

    const parts: string[] = [];
    if (issuesCount === 0) {
      parts.push(colors.mintClear.apply("all API security checks clear"));
    } else {
      parts.push(colors.pulseCoral.apply(`${issuesCount} API vulnerability risk${issuesCount > 1 ? "s" : ""}`));
    }
    parts.push(colors.slateDim.apply(`${routes.length} route${routes.length !== 1 ? "s" : ""} analyzed`));

    console.log(`  ${parts.join(colors.slateDim.dim(" \u00B7 "))}`);
    console.log("");
  }

  return result;
}
