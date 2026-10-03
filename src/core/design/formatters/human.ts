// ─── Human Formatter for Design Check ───────────────────────────────────────
// Clear, constructive terminal reporting emphasizing actionable design alternatives.
// ─────────────────────────────────────────────────────────────────────────────

import type { DesignCheckResult } from "../types.js";
import { colors, glyphs, divider } from "../../../ui/theme.js";

export function formatHumanDesignOutput(result: DesignCheckResult): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(colors.vitalTeal.bold("  BILT DESIGN & ANTI-VIBECODING CHECK"));
  lines.push(
    colors.slateDim.dim("  Evaluating design authenticity, template patterns, and production UX\n"),
  );

  if (result.status === "escalate") {
    lines.push(colors.pulseCoral.bold("  STATUS: ESCALATE (EXIT CODE 4)"));
    lines.push(divider(65));
    lines.push("");
    lines.push(
      colors.pulseCoral.apply(
        `  ${glyphs.critical} STOP: Loop escalation detected.\n  ${result.escalationMessage || "No progress across repeated iterations."}`,
      ),
    );
    lines.push("");
    return lines.join("\n");
  }

  if (result.status === "pass") {
    lines.push(`  ${colors.mintClear.apply(glyphs.passed)} ${colors.mintClear.bold("All clear.")} No generic template patterns or production UX blockers detected.`);
    if (result.fixedCount && result.fixedCount > 0) {
      lines.push(colors.mintClear.apply(`  ✓ Automatically applied ${result.fixedCount} safe fix(es).`));
    }
    if (result.suppressed && result.suppressed.length > 0) {
      lines.push("");
      lines.push(colors.slateDim.dim(`  Suppressed findings (${result.suppressed.length} intentional exception(s)):`));
      for (const s of result.suppressed) {
        lines.push(colors.slateDim.dim(`    • [${s.ruleId}] ${s.title}: "${s.reason}"`));
      }
    }
    lines.push("");
    return lines.join("\n");
  }

  const { high, medium, low } = result.summary;
  lines.push(
    `  Status: ${colors.amberFlag.bold("Needs Improvement")} (${high} high, ${medium} medium, ${low} low)`,
  );
  if (result.fixedCount && result.fixedCount > 0) {
    lines.push(colors.mintClear.apply(`  ✓ Automatically applied ${result.fixedCount} safe fix(es).`));
  }
  lines.push(divider(65));
  lines.push("");

  for (const finding of result.findings) {
    const sevBadge =
      finding.severity === "high"
        ? colors.pulseCoral.bold("[HIGH]")
        : finding.severity === "medium"
          ? colors.amberFlag.bold("[MEDIUM]")
          : colors.vitalTeal.bold("[LOW]");

    lines.push(`  ${sevBadge} ${colors.mintClear.bold(finding.title)} (${finding.ruleId})`);
    if (finding.file) {
      lines.push(colors.slateDim.dim(`    File: ${finding.file}${finding.line ? `:${finding.line}` : ""}`));
    }
    lines.push(colors.slateDim.apply(`    Category: ${finding.category}`));

    if (finding.evidence.length > 0) {
      lines.push(colors.slateDim.dim("    Evidence:"));
      for (const ev of finding.evidence) {
        lines.push(colors.slateDim.dim(`      - ${ev}`));
      }
    }

    lines.push(`    Why it matters:`);
    lines.push(colors.slateDim.apply(`      ${finding.whyItMatters}`));

    lines.push(colors.mintClear.apply(`    Actionable recommendation:`));
    lines.push(colors.mintClear.apply(`      ${finding.recommendation}`));

    lines.push(colors.vitalTeal.apply(`    Agent action:`));
    lines.push(colors.vitalTeal.apply(`      ${finding.agentAction}`));
    lines.push("");
  }

  if (result.suppressed && result.suppressed.length > 0) {
    lines.push(divider(65));
    lines.push(colors.slateDim.dim(`  Intentional Exceptions (${result.suppressed.length}):`));
    for (const s of result.suppressed) {
      lines.push(colors.slateDim.dim(`    • [${s.ruleId}] ${s.title} — Reason: "${s.reason}"`));
    }
    lines.push("");
  }

  return lines.join("\n");
}
