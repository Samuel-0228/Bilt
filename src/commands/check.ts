// ─── Command: bilt check ──────────────────────────────────────────────────────
// Main engineering supervision and production-readiness verification command
// for AI coding agents. Controls the agent loop through deterministic gating.
// ─────────────────────────────────────────────────────────────────────────────

import path from "node:path";
import { runChecks } from "../core/readiness/check-runner.js";
import { formatHumanOutput } from "../core/readiness/formatters/human.js";
import { formatAgentCheckOutput } from "../core/readiness/formatters/agent.js";
import type { ReadinessCategory } from "../core/readiness/taxonomy.js";
import { validateProjectDirectory } from "../core/safety/index.js";
import { VERSION } from "../version.js";
import { recordSessionIteration } from "../core/agent/session.js";
import { detectTampering } from "../core/trust/tamper.js";
import { colors, glyphs } from "../ui/theme.js";

export interface CheckCommandOptions {
  format?: "human" | "agent" | "json";
  changed?: boolean;
  base?: string;
  categories?: string;
  maxIterations?: number;
  noProgressThreshold?: number;
}

export async function executeCheck(
  dir: string = ".",
  options: CheckCommandOptions = {},
): Promise<number> {
  const targetDir = await validateProjectDirectory(dir);
  const format = options.format || "human";
  const projectRoot = path.resolve(targetDir);

  const selectedCategories = options.categories
    ? (options.categories.split(",").map((c) => c.trim()) as ReadinessCategory[])
    : undefined;

  // 1. Anti-tamper inspection against base git ref if available
  const baseRef = options.base || (options.changed ? "HEAD" : undefined);
  let tamperFindings = await detectTampering(projectRoot, baseRef || "HEAD~1").catch(() => []);
  const criticalTamper = tamperFindings.find((t) => t.severity === "critical");

  // 2. Run readiness verification checks
  const result = await runChecks({
    dir: targetDir,
    changed: options.changed,
    base: options.base,
    format: format === "agent" ? "agent" : "human",
    categories: selectedCategories,
  });

  // 3. Track Agent Session progression & loop governance
  const currentFingerprints = result.findings.map((f) => f.fingerprint);
  const sessionResult = await recordSessionIteration(projectRoot, currentFingerprints, {
    maxIterations: options.maxIterations,
    noProgressThreshold: options.noProgressThreshold,
    tamperDetected: Boolean(criticalTamper),
    tamperDetail: criticalTamper?.message,
    isCleanPass: result.gate.status === "production-ready" && !criticalTamper,
  });

  // 4. Build command string for execution metadata
  const commandParts = ["bilt check"];
  if (format !== "human") commandParts.push(`--format ${format}`);
  if (options.changed) commandParts.push("--changed");
  if (options.base) commandParts.push(`--base ${options.base}`);
  if (options.categories) commandParts.push(`--categories ${options.categories}`);
  const commandString = commandParts.join(" ");

  // 5. Construct canonical Agent Protocol response
  const agentOutput = formatAgentCheckOutput(
    result,
    VERSION,
    commandString,
    projectRoot,
    sessionResult.session.previousFingerprints,
    sessionResult.session,
    sessionResult.escalation,
    sessionResult.delta.regressions,
  );

  // If tamper was detected, ensure status is hard fail or escalate
  if (criticalTamper && agentOutput.status !== "escalate") {
    agentOutput.status = "fail";
    agentOutput.allowedToContinue = false;
    agentOutput.nextAction = {
      type: "fix",
      findingIds: ["TAMPER-CONFIG"],
      instruction: `CRITICAL: Anti-tamper violation detected: ${criticalTamper.message}. Revert configuration tampering immediately.`,
    };
  }

  // 6. Determine authoritative exit code
  let exitCode: number;
  if (agentOutput.status === "escalate") {
    exitCode = 4;
  } else if (agentOutput.status === "pass") {
    exitCode = 0;
  } else if (agentOutput.status === "needs-review") {
    exitCode = 2;
  } else {
    exitCode = 1;
  }

  // 7. Render output
  if (format === "agent" || format === "json") {
    console.log(JSON.stringify(agentOutput, null, 2));
  } else {
    const humanOutput = formatHumanOutput(result);
    console.log(humanOutput);

    // Supervision summary block in human format
    console.log("");
    console.log(colors.vitalTeal.bold(`  ── Bilt Supervision Session (${sessionResult.session.id}) ──`));
    console.log(`  Iteration: ${sessionResult.session.iteration}`);
    if (sessionResult.delta.resolved.length > 0) {
      console.log(`  ${colors.mintClear.apply(glyphs.passed)} Resolved findings: ${sessionResult.delta.resolved.length}`);
    }
    if (sessionResult.delta.regressions.length > 0) {
      console.log(`  ${colors.pulseCoral.bold("▲ REGRESSIONS DETECTED:")} ${sessionResult.delta.regressions.length} previously solved finding(s) re-appeared!`);
    }
    console.log(`  Allowed to continue: ${agentOutput.allowedToContinue ? colors.mintClear.apply("YES") : colors.pulseCoral.apply("NO")}`);
    console.log(`  Next action [${agentOutput.nextAction.type}]: ${agentOutput.nextAction.instruction}`);
    console.log("");
  }

  return exitCode;
}
