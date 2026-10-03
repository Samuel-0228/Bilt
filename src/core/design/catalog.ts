// ─── Design Quality & Anti-Vibecoding Rule Catalog ──────────────────────────
// Re-exports versioned rule catalog (v1) and provides registry access.
// Deterministic static analysis; no external LLM execution.
// ─────────────────────────────────────────────────────────────────────────────

import { DESIGN_RULES_V1, RULE_CATALOG_VERSION } from "./rules/v1/index.js";
import type { DesignRule } from "./types.js";

export { RULE_CATALOG_VERSION, DESIGN_RULES_V1 };
export const DESIGN_RULES: DesignRule[] = DESIGN_RULES_V1;

/**
 * Returns rules for a specific version catalog. Defaults to latest (v1).
 */
export function getDesignRules(version: string = "v1"): DesignRule[] {
  if (version === "v1") {
    return DESIGN_RULES_V1;
  }
  return DESIGN_RULES_V1;
}
