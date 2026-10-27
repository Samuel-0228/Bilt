// ─── Scan Step: Third-Party Plugins ──────────────────────────────────────────

import type { ScanFinding, Severity } from "../../../types/index.js";
import { loadPlugins } from "../../../plugins/loader.js";
import { createPluginContext } from "../../../plugins/interface.js";
import { applyOverridesAndFilter } from "../filter.js";
import type { ScanStepContext } from "./context.js";

export async function runPluginsStep(
  ctx: ScanStepContext,
): Promise<ScanFinding[]> {
  const stepFindings: ScanFinding[] = [];
  try {
    const plugins = await loadPlugins(ctx.config, ctx.rootDir);
    if (plugins.length > 0) {
      const pluginContext = await createPluginContext(ctx.rootDir, ctx.config);
      for (const plugin of plugins) {
        try {
          const result = await plugin.check(pluginContext);
          stepFindings.push(...result.findings);
        } catch {
          // Skip individual plugin check failures
        }
      }
    }
  } catch {
    // Skip plugin loader failure
  }
  return applyOverridesAndFilter(
    stepFindings,
    ctx.config,
    ctx.options.severity as Severity,
  );
}
