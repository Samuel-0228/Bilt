// ─── Human Formatter for Production Readiness ─────────────────────────────────
// Plain-language, actionable output tailored for developers and vibecoders.
// Includes mandatory non-suppressible disclaimer.
// ─────────────────────────────────────────────────────────────────────────────

import type { CheckResult } from "../check-runner.js";
import { DISCLAIMER } from "../disclaimer.js";
import { colors, glyphs, sectionHeader, divider } from "../../../ui/theme.js";

export function formatHumanOutput(result: CheckResult): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(colors.vitalTeal.bold("BILT PRODUCTION READINESS"));
  lines.push("");

  const statusLabel =
    result.gate.status === "production-ready"
      ? colors.mintClear.bold("PRODUCTION READY")
      : result.gate.status === "not-ready-needs-review"
        ? colors.amberFlag.bold("NOT READY (NEEDS REVIEW)")
        : colors.pulseCoral.bold("NOT READY");

  lines.push(`Status: ${statusLabel}`);
  lines.push("");

  const { critical, high, needsReview, acceptedRisk } = result.gate.summary;
  const blockingCount = critical + high;

  if (result.gate.status === "production-ready") {
    lines.push(
      colors.mintClear.apply(
        "✓ All automated security checks passed and no unreviewed mandatory categories remain.",
      ),
    );
  } else {
    lines.push(
      `Your application has ${colors.pulseCoral.bold(String(blockingCount))} blocking issue${
        blockingCount === 1 ? "" : "s"
      } and ${colors.amberFlag.bold(String(needsReview))} area${
        needsReview === 1 ? "" : "s"
      } that still require professional review.`,
    );
  }

  lines.push("");

  // Group findings by severity / status
  const criticals = result.findings.filter(
    (f) => f.severity === "critical" && f.status === "fail",
  );
  const highs = result.findings.filter(
    (f) => f.severity === "high" && f.status === "fail",
  );
  const reviews = result.findings.filter((f) => f.status === "needs-review");

  if (criticals.length > 0) {
    lines.push(colors.pulseCoral.bold(`CRITICAL (${criticals.length})`));
    for (const f of criticals) {
      lines.push(colors.pulseCoral.bold(`  ${glyphs.critical} ${f.title}`));
      if (f.file) {
        lines.push(colors.slateDim.dim(`    Location: ${f.file}${f.line ? `:${f.line}` : ""}`));
      }
      lines.push("    Why it matters:");
      lines.push(`      ${f.whyItMatters}`);
      lines.push("    How to fix:");
      lines.push(`      ${f.agentAction}`);
      lines.push("");
    }
  }

  if (highs.length > 0) {
    lines.push(colors.amberFlag.bold(`HIGH (${highs.length})`));
    for (const f of highs) {
      lines.push(colors.amberFlag.bold(`  ${glyphs.warning} ${f.title}`));
      if (f.file) {
        lines.push(colors.slateDim.dim(`    Location: ${f.file}${f.line ? `:${f.line}` : ""}`));
      }
      lines.push("    Why it matters:");
      lines.push(`      ${f.whyItMatters}`);
      lines.push("    How to fix:");
      lines.push(`      ${f.agentAction}`);
      lines.push("");
    }
  }

  if (reviews.length > 0) {
    lines.push(colors.vitalTeal.bold(`NEEDS REVIEW (${reviews.length})`));
    for (const f of reviews) {
      lines.push(colors.vitalTeal.bold(`  ${glyphs.info} [${f.category}] ${f.title}`));
      if (f.file) {
        lines.push(colors.slateDim.dim(`    Location: ${f.file}${f.line ? `:${f.line}` : ""}`));
      }
      lines.push("    Why it matters:");
      lines.push(`      ${f.whyItMatters}`);
      lines.push("    Action required:");
      lines.push(`      ${f.agentAction}`);
      lines.push("");
    }
  }

  if (acceptedRisk > 0) {
    lines.push(colors.slateDim.bold(`ACCEPTED RISK (${acceptedRisk})`));
    lines.push(
      colors.slateDim.dim(
        "    These findings have been formally risk-accepted and do not block non-mandatory categories.",
      ),
    );
    lines.push("");
  }

  lines.push("────────────────────────────────────────────────────────────────");
  const gateDecision =
    result.gate.status === "production-ready"
      ? colors.mintClear.bold("Production gate: PASSED")
      : result.gate.status === "not-ready-needs-review"
        ? colors.amberFlag.bold("Production gate: NEEDS REVIEW")
        : colors.pulseCoral.bold("Production gate: FAILED");

  lines.push(gateDecision);
  lines.push("");

  if (result.gate.status !== "production-ready") {
    lines.push(colors.vitalTeal.bold("════════════════════════════════════════════════════════════════"));
    lines.push(colors.vitalTeal.bold("  ACTION PLAN FOR DEVELOPERS & AI CODING AGENTS"));
    lines.push(colors.slateDim.dim("  Do not stop at a passive report. Execute remediation to reach ready state:"));
    lines.push(colors.vitalTeal.bold("════════════════════════════════════════════════════════════════"));
    lines.push("");

    const fixableCount = result.findings.filter((f) => f.fixable).length;
    if (fixableCount > 0) {
      lines.push(colors.mintClear.bold(`  ⚡ 1. AUTO-FIX AVAILABLE (${fixableCount} issue${fixableCount > 1 ? "s" : ""})`));
      lines.push(colors.mintClear.apply("     Run: npx bilt design-check --fix"));
      lines.push(colors.mintClear.apply("     Run: npx bilt fix --safe"));
      lines.push(colors.slateDim.dim("     Automatically repairs accessibility outlines, missing aria labels, and env mismatches."));
      lines.push("");
    }

    lines.push(colors.amberFlag.bold("  📋 2. ONBOARDING AN EXISTING CODEBASE? (BASELINE LEGACY DEBT)"));
    lines.push(colors.amberFlag.apply("     Run: npx bilt baseline create"));
    lines.push(colors.slateDim.dim("     Snapshots pre-existing issues into .bilt/baseline.json so you and your"));
    lines.push(colors.slateDim.dim("     AI agents focus strictly on new changes introduced by current tasks."));
    lines.push("");

    const hasDesign = result.findings.some(
      (f) =>
        (f.category as string) === "design-quality" ||
        f.ruleId.startsWith("DESIGN-") ||
        f.ruleId.startsWith("A11Y-") ||
        f.ruleId.startsWith("GENERIC-") ||
        f.ruleId.startsWith("VIBECODED-") ||
        f.title.toLowerCase().includes("design") ||
        f.title.toLowerCase().includes("accessibility"),
    );
    if (hasDesign) {
      lines.push(colors.vitalTeal.bold("  🎨 3. DESIGN INTENT & ANTI-VIBECODING"));
      lines.push(colors.vitalTeal.apply("     Run: npx bilt design-brief --format agent"));
      lines.push(colors.slateDim.dim("     Before refactoring formulaic AI patterns, check the design brief."));
      lines.push(colors.slateDim.dim("     If not configured, ask the human maintainer the 4 Design Intent questions."));
      lines.push("");
    }

    if (reviews.length > 0) {
      lines.push(colors.vitalTeal.bold("  💡 4. GUIDED IMPLEMENTATION & DEEP CONTEXT"));
      lines.push("     Run: npx bilt explain <category-or-rule> (e.g. npx bilt explain database)");
      lines.push(colors.slateDim.dim("     Prints architecture guides, threat models, and code implementation snippets."));
      lines.push("     Accept operational risk: npx bilt accept-risk <ruleId> --reason \"...\" --owner \"...\"");
      lines.push("");
    }

    lines.push(colors.slateDim.bold("  🔁 5. VERIFY RESOLUTION"));
    lines.push(colors.slateDim.apply("     Run: npx bilt check --format agent"));
    lines.push(colors.slateDim.dim("     Re-run check until gate status is PRODUCTION READY."));
    lines.push("");
    lines.push("────────────────────────────────────────────────────────────────");
    lines.push("");
  }

  // Non-suppressible disclaimer (Section 15B)
  lines.push(colors.slateDim.dim(DISCLAIMER));
  lines.push("");

  return lines.join("\n");
}
