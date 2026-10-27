import {
  colors,
  pulseBar,
  isPlainMode,
} from "../../ui/theme.js";
import { playSound } from "../../ui/sound.js";
import { toAgentFinding } from "../../core/finding/mapper.js";
import { formatAgentOutput } from "../../core/output/formatters/agent.js";
import { formatSarifOutput } from "../../core/output/formatters/sarif.js";
import { statusToExitCode } from "../../core/output/types.js";
import { checkLoopProgress } from "../../core/loop/state.js";
import { VERSION } from "../../version.js";
import type { ScanResult, ScanFinding, ScanOptions } from "../../types/index.js";

export interface ReportScanOptions {
  result: ScanResult;
  findings: ScanFinding[];
  options: ScanOptions;
  config: any;
  rootDir: string;
  isJson: boolean;
  isQuiet: boolean;
  isSilent: boolean;
}

export async function reportScanResult(opts: ReportScanOptions): Promise<void> {
  const { result, findings, options, config, rootDir, isJson, isQuiet, isSilent } = opts;

  if (options.format === "agent") {
    const agentFindings = result.findings.map((f) =>
      toAgentFinding(f, {
        introducedByChange: f.introducedByChange !== false,
        surroundingSnippet: f.preview,
      }),
    );

    const loopResult = await checkLoopProgress(
      rootDir,
      agentFindings.map((af) => af.fingerprint),
      { maxIterations: options.maxIterations },
    );

    const agentOutput = formatAgentOutput({
      toolVersion: VERSION,
      findings: agentFindings,
      introducedOnly: Boolean(options.changed || options.base),
      iteration: loopResult.iteration,
      statusOverride: loopResult.shouldEscalate ? "escalate" : undefined,
      escalationMessage: loopResult.escalationReason,
    });
    console.log(JSON.stringify(agentOutput, null, 2));
    process.exitCode = statusToExitCode(agentOutput.status);
    return;
  }

  if (options.format === "sarif") {
    const scopedFindings =
      options.changed || options.base
        ? result.findings.filter((f) => f.introducedByChange !== false)
        : result.findings;
    const agentFindings = scopedFindings.map((f) =>
      toAgentFinding(f, {
        introducedByChange: f.introducedByChange !== false,
        surroundingSnippet: f.preview,
      }),
    );
    const sarif = formatSarifOutput(agentFindings, VERSION);
    console.log(JSON.stringify(sarif, null, 2));
    const criticalCount = scopedFindings.filter(
      (f) => f.severity === "critical",
    ).length;
    if (criticalCount > 0) process.exitCode = 1;
    return;
  }

  if (isJson || options.format === "json") {
    console.log(JSON.stringify(result, null, 2));
    const criticalCount = findings.filter(
      (f) => f.severity === "critical",
    ).length;
    if (criticalCount > 0) process.exitCode = 1;
    return;
  }

  if (isQuiet) {
    const criticalCount = findings.filter(
      (f) => f.severity === "critical",
    ).length;
    if (criticalCount > 0) process.exitCode = 1;
    return;
  }

  if (!isSilent) {
    console.log(pulseBar(result.healthScore));
    console.log("");

    const criticalCount = findings.filter(
      (f) => f.severity === "critical",
    ).length;
    const warningCount = findings.filter(
      (f) => f.severity === "warning",
    ).length;
    const issuesCount = criticalCount + warningCount;

    if (criticalCount > 0 && config.sound) {
      playSound();
    }

    const parts: string[] = [];
    if (issuesCount === 0) {
      parts.push(colors.mintClear.apply("all clear"));
    } else {
      parts.push(
        colors.pulseCoral.apply(
          `${issuesCount} issue${issuesCount > 1 ? "s" : ""}`,
        ),
      );
    }

    parts.push(colors.slateDim.apply("bilt fix"));
    const isPlain = isPlainMode();
    const mode =
      options.verbose || options.details !== false || isPlain
        ? "detail"
        : "headline";
    if (mode !== "detail") {
      parts.push(colors.slateDim.apply("bilt scan"));
    }

    console.log(`  ${parts.join(colors.slateDim.dim(" \u00B7 "))}`);
    console.log("");
    if (criticalCount > 0) {
      process.exitCode = 1;
    }
  }
}
