// ─── Command: bilt check ──────────────────────────────────────────────────────
// Main production-readiness verification command for AI-built software.
// ─────────────────────────────────────────────────────────────────────────────

import path from "node:path";
import { runChecks } from "../core/readiness/check-runner.js";
import { formatHumanOutput } from "../core/readiness/formatters/human.js";
import { formatAgentCheckOutput } from "../core/readiness/formatters/agent.js";
import type { ReadinessCategory } from "../core/readiness/taxonomy.js";
import { validateProjectDirectory } from "../core/safety/index.js";
import { VERSION } from "../version.js";
import { checkLoopProgress } from "../core/loop/state.js";

export interface CheckCommandOptions {
  format?: "human" | "agent" | "json";
  changed?: boolean;
  base?: string;
  categories?: string;
}

export async function executeCheck(
  dir: string = ".",
  options: CheckCommandOptions = {},
): Promise<number> {
  const targetDir = await validateProjectDirectory(dir);
  const format = options.format || "human";

  const selectedCategories = options.categories
    ? (options.categories.split(",").map((c) => c.trim()) as ReadinessCategory[])
    : undefined;

  const result = await runChecks({
    dir: targetDir,
    changed: options.changed,
    base: options.base,
    format: format === "agent" ? "agent" : "human",
    categories: selectedCategories,
  });

  // Build the CLI command string for the execution metadata
  const commandParts = ["bilt check"];
  if (format !== "human") commandParts.push(`--format ${format}`);
  if (options.changed) commandParts.push("--changed");
  if (options.base) commandParts.push(`--base ${options.base}`);
  if (options.categories) commandParts.push(`--categories ${options.categories}`);
  const commandString = commandParts.join(" ");

  const projectRoot = path.resolve(targetDir);

  if (format === "agent" || format === "json") {
    // Check loop state to detect runaway agent behavior
    const currentFingerprints = result.findings.map((f) => f.fingerprint);
    const loopCheck = await checkLoopProgress(projectRoot, currentFingerprints).catch(
      () => null,
    );

    let agentEscalation:
      | { reason: import("../core/agent/protocol.js").EscalationReason; detail: string }
      | undefined;

    if (loopCheck?.shouldEscalate) {
      agentEscalation = {
        reason: detectEscalationReason(loopCheck.escalationReason ?? ""),
        detail: loopCheck.escalationReason ?? "Loop escalation detected.",
      };
    }

    const agentOutput = formatAgentCheckOutput(
      result,
      VERSION,
      commandString,
      projectRoot,
      undefined, // previousFingerprints — wired to Change Ledger in P1
    );

    // Inject escalation if loop was detected
    if (agentEscalation && agentOutput.status !== "pass") {
      agentOutput.status = "escalate";
      agentOutput.escalation = agentEscalation;
      agentOutput.nextAction = {
        type: "escalate",
        findingIds: [],
        instruction:
          "HALT automated retries. Loop detected. Stop and explain the situation to the human maintainer.",
      };
    }

    console.log(JSON.stringify(agentOutput, null, 2));

    // Exit codes aligned with the Agent Protocol spec
    if (agentOutput.status === "escalate") return 4;
  } else {
    const humanOutput = formatHumanOutput(result);
    console.log(humanOutput);
  }

  // Determine exit code
  if (result.gate.status === "production-ready") {
    return 0;
  } else if (result.gate.status === "not-ready-needs-review") {
    return 2;
  } else {
    return 1;
  }
}

function detectEscalationReason(
  msg: string,
): import("../core/agent/protocol.js").EscalationReason {
  if (msg.includes("no progress")) return "no-progress";
  if (msg.includes("oscillation")) return "oscillation";
  if (msg.includes("budget")) return "budget-exhausted";
  if (msg.includes("tamper")) return "tamper-detected";
  return "unknown";
}
