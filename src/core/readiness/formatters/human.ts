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
    lines.push(
      "Fix the blocking findings and complete the required reviews before exposing this application to real users.",
    );
    lines.push("");
  }

  // Non-suppressible disclaimer (Section 15B)
  lines.push(colors.slateDim.dim(DISCLAIMER));
  lines.push("");

  return lines.join("\n");
}
