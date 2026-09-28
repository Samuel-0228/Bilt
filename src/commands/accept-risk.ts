// ─── Command: bilt accept-risk (Section 8B) ───────────────────────────────────
// Formally records an accepted risk in .bilt/accepted-risk.json.
// Prohibits risk acceptance for the 6 mandatory production gate categories.
// ─────────────────────────────────────────────────────────────────────────────

import path from "node:path";
import { saveAcceptedRisk, loadAcceptedRisks } from "../core/readiness/risk-acceptance.js";
import { TAXONOMY, isMandatoryCategory } from "../core/readiness/taxonomy.js";
import type { ReadinessCategory } from "../core/readiness/taxonomy.js";
import { colors, glyphs } from "../ui/theme.js";

export interface AcceptRiskOptions {
  id?: string;
  finding?: string;
  reason?: string;
  owner?: string;
  category?: string;
  expires?: string;
  dir?: string;
}

const KNOWN_RULES: string[] = [
  // Readiness automated & guided rules
  "CHECK-SEC-ENV-001", "CHECK-SEC-ENV-002", "CHECK-SEC-ENV-003", "CHECK-SEC-ENV-004",
  "CHECK-AUTH-001", "CHECK-AUTH-002", "CHECK-AUTH-003", "CHECK-AUTH-004", "CHECK-AUTH-005", "CHECK-AUTH-006", "CHECK-AUTH-007", "CHECK-AUTH-008",
  "CHECK-AUTHZ-001", "CHECK-AUTHZ-002", "CHECK-AUTHZ-003", "CHECK-AUTHZ-004",
  "CHECK-INPUT-001", "CHECK-INPUT-002", "CHECK-INPUT-003", "CHECK-INPUT-004", "CHECK-INPUT-005",
  "CHECK-API-001", "CHECK-API-002", "CHECK-API-003", "CHECK-API-004",
  "CHECK-DB-001", "CHECK-DB-002", "CHECK-DB-GUIDED-003",
  "CHECK-DEP-001",
  "CHECK-ERR-001", "CHECK-LOG-002",
  "CHECK-CORS-001", "CHECK-HDR-002",
  "CHECK-DEP-CFG-001", "CHECK-DEP-CFG-002",
  "CHECK-UPLOAD-GUIDED-001",
  "CHECK-PAY-001", "CHECK-PAY-002",
  "CHECK-PII-GUIDED-001",
  "CHECK-OBS-GUIDED-001",
  // Common finding categories & prefixes
  "SEC-SEC-001", "dep-vulnerable", "dep-unused", "config-package", "env-missing",
];

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }

  return dp[m]![n]!;
}

export function matchFindingOrRuleId(
  input: string,
  extraCandidates: string[] = [],
): { matchedId?: string; isExact?: boolean; isNormalized?: boolean; suggestion?: string } {
  const candidates = Array.from(new Set([...KNOWN_RULES, ...extraCandidates]));
  const trimmed = input.trim();

  // 1. Exact match
  const exact = candidates.find((c) => c === trimmed);
  if (exact) {
    return { matchedId: exact, isExact: true, isNormalized: false };
  }

  // 2. Case-insensitive match
  const caseMatch = candidates.find((c) => c.toLowerCase() === trimmed.toLowerCase());
  if (caseMatch) {
    return { matchedId: caseMatch, isExact: false, isNormalized: true };
  }

  // 3. Normalization (e.g. check_dep_001 -> CHECK-DEP-001, check-dep-1 -> CHECK-DEP-001)
  const normalizedInput = trimmed
    .toUpperCase()
    .replace(/_/g, "-")
    .replace(/-(\d)$/, "-00$1")
    .replace(/-(\d{2})$/, "-0$1");

  const normalizedMatch = candidates.find((c) => c.toUpperCase() === normalizedInput);
  if (normalizedMatch) {
    return { matchedId: normalizedMatch, isExact: false, isNormalized: true };
  }

  // 4. Substring / suffix match (e.g. "dep-001" or "cors-001")
  const subMatch = candidates.find(
    (c) =>
      c.toUpperCase().endsWith(`-${normalizedInput}`) ||
      c.toUpperCase().endsWith(normalizedInput) ||
      normalizedInput.endsWith(c.toUpperCase()),
  );
  if (subMatch) {
    return { matchedId: subMatch, isExact: false, isNormalized: true };
  }

  // 5. Fuzzy match using Levenshtein distance for typos
  let bestCandidate: string | undefined;
  let minDistance = Infinity;

  for (const candidate of candidates) {
    const dist = levenshteinDistance(normalizedInput, candidate.toUpperCase());
    if (dist < minDistance) {
      minDistance = dist;
      bestCandidate = candidate;
    }
  }

  if (bestCandidate && minDistance <= 4) {
    return { suggestion: bestCandidate };
  }

  return {};
}

function inferCategoryFromRuleId(ruleId: string): ReadinessCategory | undefined {
  const upper = ruleId.toUpperCase();
  if (upper.startsWith("CHECK-DEP-CFG")) return "deploy-config";
  if (upper.startsWith("CHECK-DEP") || upper.startsWith("DEP-")) return "dependencies";
  if (upper.startsWith("CHECK-ERR") || upper.startsWith("CHECK-LOG")) return "error-handling-logs";
  if (upper.startsWith("CHECK-CORS") || upper.startsWith("CHECK-HDR")) return "transport-and-headers";
  if (upper.startsWith("CHECK-UPLOAD")) return "file-uploads";
  if (upper.startsWith("CHECK-PAY")) return "payments";
  if (upper.startsWith("CHECK-PII")) return "privacy-and-pii";
  if (upper.startsWith("CHECK-OBS")) return "monitoring-rollback";
  if (upper.startsWith("CHECK-AUTHZ")) return "authorization";
  if (upper.startsWith("CHECK-AUTH")) return "auth";
  if (upper.startsWith("CHECK-INPUT")) return "input-validation";
  if (upper.startsWith("CHECK-API")) return "api-abuse-and-cost";
  if (upper.startsWith("CHECK-DB")) return "database";
  if (upper.startsWith("CHECK-SEC") || upper.startsWith("SEC-")) return "secrets-and-env";
  return undefined;
}

export async function executeAcceptRisk(
  findingIdArg: string | string[] | undefined,
  options: AcceptRiskOptions = {},
): Promise<number> {
  const rootDir = path.resolve(options.dir || ".");

  // 1. Resolve findingId from positional argument or flags (--id, --finding)
  let rawFindingId = "";
  if (Array.isArray(findingIdArg) && findingIdArg.length > 0) {
    rawFindingId = findingIdArg.join(" ").trim();
  } else if (typeof findingIdArg === "string" && findingIdArg.trim().length > 0) {
    rawFindingId = findingIdArg.trim();
  } else if (options.id && options.id.trim().length > 0) {
    rawFindingId = options.id.trim();
  } else if (options.finding && options.finding.trim().length > 0) {
    rawFindingId = options.finding.trim();
  }

  if (!rawFindingId) {
    console.error("");
    console.error(colors.pulseCoral.bold(`  ${glyphs.critical} Error: Finding ID is required.`));
    console.error("");
    console.error(colors.slateDim.bold("  Usage:"));
    console.error("    bilt accept-risk <finding-id> --reason \"<explanation>\" --owner \"<team-or-name>\"");
    console.error("    bilt accept-risk --id <finding-id> --reason \"<explanation>\" --owner \"<team-or-name>\"");
    console.error("");
    console.error(colors.slateDim.bold("  Examples:"));
    console.error("    bilt accept-risk CHECK-DEP-001 --reason \"Legacy peer dependency required for production build\" --owner \"security-team\"");
    console.error("    bilt accept-risk --finding CHECK-CORS-001 --reason \"CORS restricted via upstream Cloudflare rules\" --owner \"@infra-team\"");
    console.error("");
    return 1;
  }

  if (!options.reason || options.reason.trim().length < 5) {
    console.error("");
    console.error(
      colors.pulseCoral.bold(
        `  ${glyphs.critical} Error: --reason is required and must explain why this risk is accepted (min 5 characters).`,
      ),
    );
    console.error("");
    console.error(colors.slateDim.bold("  Usage:"));
    console.error("    bilt accept-risk <finding-id> --reason \"<explanation>\" --owner \"<team-or-name>\"");
    console.error("");
    console.error(colors.slateDim.bold("  Example:"));
    console.error(`    bilt accept-risk ${rawFindingId} --reason "Legacy peer dependency required for build" --owner "${options.owner || "security-team"}"`);
    console.error("");
    return 1;
  }

  if (!options.owner || options.owner.trim().length === 0) {
    console.error("");
    console.error(
      colors.pulseCoral.bold(
        `  ${glyphs.critical} Error: --owner is required (name or team accepting the risk).`,
      ),
    );
    console.error("");
    console.error(colors.slateDim.bold("  Usage:"));
    console.error("    bilt accept-risk <finding-id> --reason \"<explanation>\" --owner \"<team-or-name>\"");
    console.error("");
    console.error(colors.slateDim.bold("  Example:"));
    console.error(`    bilt accept-risk ${rawFindingId} --reason "${options.reason}" --owner "security-team"`);
    console.error("");
    return 1;
  }

  // 2. Fuzzy match or normalize finding ID against known rules & existing accepted risks
  const existingRisks = await loadAcceptedRisks(rootDir);
  const existingIds = existingRisks.map((r) => r.findingId);
  const matchResult = matchFindingOrRuleId(rawFindingId, existingIds);

  let finalFindingId = rawFindingId;
  if (matchResult.matchedId) {
    if (matchResult.isNormalized) {
      console.log(
        colors.slateDim.dim(
          `  ℹ Normalized approximate finding ID '${rawFindingId}' -> '${matchResult.matchedId}'`,
        ),
      );
    }
    finalFindingId = matchResult.matchedId;
  } else if (matchResult.suggestion) {
    console.warn(
      colors.amberFlag.bold(
        `  ▲ Warning: Unrecognized finding ID '${rawFindingId}'. Did you mean '${matchResult.suggestion}'?`,
      ),
    );
  }

  // 3. Infer or validate category
  let category: ReadinessCategory =
    (options.category as ReadinessCategory) ||
    inferCategoryFromRuleId(finalFindingId) ||
    "dependencies";

  if (options.category) {
    const meta = TAXONOMY.find((t) => t.id === options.category);
    if (!meta) {
      console.error(colors.pulseCoral.bold(`  ${glyphs.critical} Error: Unknown category '${options.category}'.`));
      return 1;
    }
  }

  // 4. Invariant enforcement: Reject risk acceptance for mandatory categories
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

  // 5. Record risk
  const result = await saveAcceptedRisk(rootDir, {
    findingId: finalFindingId,
    category,
    reason: options.reason.trim(),
    owner: options.owner.trim(),
    expires: options.expires,
  });

  if (!result.success) {
    console.error(colors.pulseCoral.bold(`  ${glyphs.critical} Error: ${result.error}`));
    return 1;
  }

  console.log("");
  console.log(colors.mintClear.bold(`  ${glyphs.passed} Risk successfully accepted for '${finalFindingId}'`));
  console.log(colors.slateDim.dim(`  Category: ${category}`));
  console.log(colors.slateDim.dim(`  Owner:    ${options.owner.trim()}`));
  console.log(colors.slateDim.dim(`  Reason:   ${options.reason.trim()}`));
  if (options.expires) {
    console.log(colors.slateDim.dim(`  Expires:  ${options.expires}`));
  }
  console.log(colors.slateDim.dim("  Recorded in .bilt/accepted-risk.json"));
  console.log("");

  return 0;
}
