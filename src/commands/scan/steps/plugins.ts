// ─── Scan Step: Third-Party Plugins ──────────────────────────────────────────

import type { ScanFinding, Severity } from "../../../types/index.js";
import { loadPlugins } from "../../../plugins/loader.js";
import { createPluginContext } from "../../../plugins/interface.js";
import { applyOverridesAndFilter } from "../filter.js";
import { logger } from "../../../core/logging/logger.js";
import { validatePluginResult } from "../../../core/security/validation.js";
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
          const validated = validatePluginResult(result);
          stepFindings.push(...validated.findings);
        } catch (pluginErr) {
          logger.warn("Plugin check execution failed", {
            plugin: plugin.name,
            error: pluginErr instanceof Error ? pluginErr.message : String(pluginErr),
          });
        }
      }
    }
  } catch (loaderErr) {
    logger.warn("Plugin step loader failed", {
      error: loaderErr instanceof Error ? loaderErr.message : String(loaderErr),
      projectRoot: ctx.rootDir,
    });
  }
  return applyOverridesAndFilter(
    stepFindings,
    ctx.config,
    ctx.options.severity as Severity,
  );
}
