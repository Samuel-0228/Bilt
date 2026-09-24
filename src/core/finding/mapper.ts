import type { ScanFinding } from "../../types/index.js";
import type { Finding, FindingSeverity } from "./types.js";
import { computeFingerprint } from "./fingerprint.js";
import { getRuleTemplate } from "./templates.js";

export function toAgentFinding(
  finding: ScanFinding,
  options: {
    surroundingSnippet?: string;
    symbol?: string;
    lineContent?: string;
    introducedByChange?: boolean;
    untrustedSnippet?: string;
  } = {},
): Finding {
  const rawRuleId = finding.ruleId || finding.category || "UNKNOWN-RULE";
  const ruleId = rawRuleId.toUpperCase();
  const template = getRuleTemplate(
    ruleId,
    finding.category,
    (finding.severity as FindingSeverity) || "warning",
  );

  const line = finding.line && finding.line > 0 ? finding.line : 1;
  const end_line = line;

  const fingerprint = computeFingerprint({
    ruleId: template.rule_id,
    file: finding.file,
    symbol: options.symbol,
    snippet: options.surroundingSnippet || finding.preview,
    lineContent: options.lineContent,
  });

  return {
    rule_id: template.rule_id,
    fingerprint,
    severity: template.severity,
    precision: template.precision,
    maturity: template.maturity,
    category: template.category,
    file: finding.file.replace(/\\/g, "/"),
    line,
    end_line,
    title: template.title,
    explanation: template.explanation,
    agent_action: template.agent_action,
    fixable: Boolean(finding.suggestion || finding.aiExplanation?.canBiltFix),
    introduced_by_change: options.introducedByChange,
    untrusted_snippet: options.untrustedSnippet,
  };
}
