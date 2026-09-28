// ─── Command: bilt check ──────────────────────────────────────────────────────
// Main production-readiness verification command for AI-built software.
// ─────────────────────────────────────────────────────────────────────────────

import { runChecks } from "../core/readiness/check-runner.js";
import { formatHumanOutput } from "../core/readiness/formatters/human.js";
import { formatAgentCheckOutput } from "../core/readiness/formatters/agent.js";
import type { ReadinessCategory } from "../core/readiness/taxonomy.js";
import { validateProjectDirectory } from "../core/safety/index.js";
import { VERSION } from "../version.js";

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

  if (format === "agent" || format === "json") {
    const agentOutput = formatAgentCheckOutput(result, VERSION);
    console.log(JSON.stringify(agentOutput, null, 2));
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
