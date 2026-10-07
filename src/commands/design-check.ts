// ─── Command: bilt design-check ─────────────────────────────────────────────
// Detect and remediate generic AI/template-driven website design patterns.
// ─────────────────────────────────────────────────────────────────────────────

import { runDesignCheck } from "../core/design/engine.js";
import { formatHumanDesignOutput } from "../core/design/formatters/human.js";
import { formatAgentDesignOutput } from "../core/design/formatters/agent.js";
import { validateProjectDirectory } from "../core/safety/index.js";
import type { DesignCheckOptions } from "../core/design/types.js";

export async function executeDesignCheck(
  dir: string = ".",
  options: DesignCheckOptions = {},
): Promise<number> {
  const targetDir = await validateProjectDirectory(dir);
  const format = options.format || "human";

  const result = await runDesignCheck(targetDir, options);

  if (options.debug) {
    console.error("[design-check debug] Rule timings (ms):", JSON.stringify(result.timingMs, null, 2));
    console.error("[design-check debug] Redacted Snapshot:", JSON.stringify(result.rawSnapshot, null, 2));
  }

  if (format === "agent" || format === "json") {
    const jsonOutput = formatAgentDesignOutput(result, { projectRoot: targetDir });
    console.log(JSON.stringify(jsonOutput, null, 2));
  } else {
    const humanOutput = formatHumanDesignOutput(result);
    console.log(humanOutput);
  }

  if (result.status === "escalate") {
    return 4;
  }
  if (result.status === "pass") {
    return 0;
  }
  return 1;
}
