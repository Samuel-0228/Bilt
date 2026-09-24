import path from "node:path";
import { executeScan } from "./scan.js";
import { toAgentFinding } from "../core/finding/mapper.js";
import { formatAgentOutput } from "../core/output/formatters/agent.js";
import { formatSarifOutput } from "../core/output/formatters/sarif.js";
import { detectTampering } from "../core/trust/tamper.js";
import {
  statusToExitCode,
  type OutputFormat,
  type AgentOutput,
} from "../core/output/types.js";
import { colors, glyphs } from "../ui/theme.js";
import { sanitizeSnippet } from "../core/safety/sanitizer.js";

export interface VerifyOptions {
  base?: string;
  format?: OutputFormat;
  snippets?: boolean;
  maxIterations?: number;
}

export async function executeVerify(
  dir: string = ".",
  options: VerifyOptions = {},
): Promise<{ output: AgentOutput; exitCode: number }> {
  const rootDir = path.resolve(dir);
  const baseRef = options.base || "HEAD~1";
  const format = options.format || "agent";

  // 1. Run git-scoped scan against base ref
  const scanResult = await executeScan(rootDir, {
    base: baseRef,
    quiet: true,
  });

  // 2. Map findings into Agent Finding model
  const agentFindings = scanResult.findings.map((f) => {
    return toAgentFinding(f, {
      untrustedSnippet:
        options.snippets && f.preview
          ? sanitizeSnippet(f.preview, 200)
          : undefined,
      introducedByChange: f.introducedByChange !== false,
    });
  });

  // 3. Detect any tampering with config/rules vs baseRef
  const tamperFindings = await detectTampering(rootDir, baseRef);

  const introducedFindings = agentFindings.filter(
    (af) => af.introduced_by_change !== false,
  );

  // 4. Check loop progress and iteration budget
  const { checkLoopProgress, resetLoopState } = await import("../core/loop/state.js");
  const loopResult = await checkLoopProgress(
    rootDir,
    introducedFindings.map((af) => af.fingerprint),
    { maxIterations: options.maxIterations },
  );

  if (introducedFindings.length === 0) {
    await resetLoopState(rootDir);
  }

  // 5. Construct Agent output
  const agentOutput = formatAgentOutput({
    toolVersion: "1.0.5",
    findings: agentFindings,
    tamper: tamperFindings,
    introducedOnly: true,
    iteration: loopResult.iteration,
    statusOverride: loopResult.shouldEscalate ? "escalate" : undefined,
    escalationMessage: loopResult.escalationReason,
  });

  const exitCode = statusToExitCode(agentOutput.status);
  process.exitCode = exitCode;

  // 5. Emit formatted output
  if (format === "agent" || format === "json") {
    console.log(JSON.stringify(agentOutput, null, 2));
  } else if (format === "sarif") {
    const sarif = formatSarifOutput(agentOutput.findings, "1.0.5");
    console.log(JSON.stringify(sarif, null, 2));
  } else {
    // Human readable text summary for CI
    console.log("");
    if (exitCode === 0) {
      console.log(
        `  ${colors.mintClear.apply(glyphs.passed)} Verification Passed: No introduced findings vs ${baseRef}.`,
      );
    } else {
      console.log(
        `  ${colors.pulseCoral.apply(glyphs.critical)} Verification ${agentOutput.status.toUpperCase()} (Exit code ${exitCode}) vs ${baseRef}.`,
      );
    }
    if (tamperFindings.length > 0) {
      console.log(`  ${colors.pulseCoral.bold("Tamper Violations Detected:")}`);
      for (const t of tamperFindings) {
        console.log(`    - [${t.rule_id}] ${t.file}: ${t.message}`);
      }
    }
    console.log("");
  }

  return { output: agentOutput, exitCode };
}
