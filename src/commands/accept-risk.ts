// ─── Command: bilt accept-risk (Section 8B) ───────────────────────────────────
// Formally records an accepted risk in .bilt/accepted-risk.json.
// Prohibits risk acceptance for the 6 mandatory production gate categories.
// ─────────────────────────────────────────────────────────────────────────────

import path from "node:path";
import { saveAcceptedRisk } from "../core/readiness/risk-acceptance.js";
import { TAXONOMY, isMandatoryCategory } from "../core/readiness/taxonomy.js";
import type { ReadinessCategory } from "../core/readiness/taxonomy.js";
import { colors, glyphs } from "../ui/theme.js";

export interface AcceptRiskOptions {
  reason?: string;
  owner?: string;
  category?: string;
  expires?: string;
  dir?: string;
}

export async function executeAcceptRisk(
  findingId: string,
  options: AcceptRiskOptions,
): Promise<number> {
  const rootDir = path.resolve(options.dir || ".");

  if (!findingId) {
    console.error(colors.pulseCoral.bold(`  ${glyphs.critical} Error: Finding ID is required.`));
    return 1;
  }

  if (!options.reason || options.reason.trim().length < 5) {
    console.error(
      colors.pulseCoral.bold(
        `  ${glyphs.critical} Error: --reason is required and must explain why this risk is accepted.`,
      ),
    );
    return 1;
  }

  if (!options.owner) {
    console.error(
      colors.pulseCoral.bold(
        `  ${glyphs.critical} Error: --owner is required (name or team accepting the risk).`,
      ),
    );
    return 1;
  }

  // Infer or validate category
  let category: ReadinessCategory = (options.category as ReadinessCategory) || "dependencies";
  if (options.category) {
    const meta = TAXONOMY.find((t) => t.id === options.category);
    if (!meta) {
      console.error(colors.pulseCoral.bold(`  ${glyphs.critical} Error: Unknown category '${options.category}'.`));
      return 1;
    }
  }

  if (isMandatoryCategory(category)) {
    console.error("");
    console.error(
      colors.pulseCoral.bold(
        `  ${glyphs.critical} Risk Acceptance Prohibited for Mandatory Category: '${category}'`,
      ),
    );
    console.error("");
    console.error(
      "  The 6 core readiness categories (secrets-and-env, auth, authorization, input-validation,",
    );
    console.error(
      "  api-abuse-and-cost, database) cannot bypass the production gate via risk acceptance.",
    );
    console.error(
      "  These issues must be resolved directly or suppressed with a specific false-positive reason.",
    );
    console.error("");
    return 1;
  }

  const result = await saveAcceptedRisk(rootDir, {
    findingId,
    category,
    reason: options.reason,
    owner: options.owner,
    expires: options.expires,
  });

  if (!result.success) {
    console.error(colors.pulseCoral.bold(`  ${glyphs.critical} Error: ${result.error}`));
    return 1;
  }

  console.log("");
  console.log(colors.mintClear.bold(`  ${glyphs.passed} Risk successfully accepted for '${findingId}'`));
  console.log(colors.slateDim.dim(`  Owner: ${options.owner}`));
  console.log(colors.slateDim.dim(`  Reason: ${options.reason}`));
  if (options.expires) {
    console.log(colors.slateDim.dim(`  Expires: ${options.expires}`));
  }
  console.log(colors.slateDim.dim("  Recorded in .bilt/accepted-risk.json"));
  console.log("");

  return 0;
}
