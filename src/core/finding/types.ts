export type PrecisionTier = "high" | "medium" | "low";
export type Maturity = "stable" | "experimental";
export type FindingSeverity = "critical" | "warning" | "info";

export interface Finding {
  rule_id: string;
  fingerprint: string;
  severity: FindingSeverity;
  precision: PrecisionTier;
  maturity: Maturity;
  category: string;
  file: string;
  line: number;
  end_line: number;
  title: string;
  explanation: string;
  agent_action: string;
  fixable: boolean;
  introduced_by_change?: boolean;
  untrusted_snippet?: string;
}

export interface RuleTemplate {
  rule_id: string;
  title: string;
  explanation: string;
  agent_action: string;
  severity: FindingSeverity;
  precision: PrecisionTier;
  maturity: Maturity;
  category: string;
}
