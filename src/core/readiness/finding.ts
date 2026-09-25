import crypto from 'node:crypto';
import type { Finding } from '../finding/types.js';
import type { ReadinessCategory, CheckMode } from './taxonomy.js';
export type { CheckMode };

export type CheckSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type CheckStatus = 'pass' | 'fail' | 'needs-review';

export interface BiltCheckFinding {
  ruleId: string;
  category: ReadinessCategory;
  mode: CheckMode;
  severity: CheckSeverity;
  precision: 'high' | 'medium' | 'low';
  maturity: 'stable' | 'experimental';
  status: CheckStatus;
  title: string;
  whyItMatters: string;
  technicalDetail: string;
  agentAction: string;
  evidence?: unknown;
  evidenceRequired?: boolean;
  fixable: boolean;
  file?: string;
  line?: number;
  endLine?: number;
  fingerprint: string;
  introduced_by_change?: boolean;
}

export function generateCheckFingerprint(ruleId: string, file?: string, line?: number): string {
  const hash = crypto.createHash('sha256');
  hash.update(ruleId);
  if (file) {
    hash.update(file);
  }
  if (line !== undefined) {
    hash.update(line.toString());
  }
  return hash.digest('hex');
}

export function findingToCheckFinding(finding: Finding, category: ReadinessCategory): BiltCheckFinding {
  let severity: CheckSeverity = 'info';
  if (finding.severity === 'critical') severity = 'critical';
  else if (finding.severity === 'warning') severity = 'medium';
  else if (finding.severity === 'info') severity = 'info';

  const mode: CheckMode = 'automated';

  return {
    ruleId: finding.rule_id,
    category,
    mode,
    severity,
    precision: finding.precision,
    maturity: finding.maturity,
    status: 'fail',
    title: finding.title,
    whyItMatters: finding.explanation,
    technicalDetail: finding.explanation, // Default mapping
    agentAction: finding.agent_action,
    fixable: finding.fixable,
    file: finding.file,
    line: finding.line,
    endLine: finding.end_line,
    fingerprint: finding.fingerprint || generateCheckFingerprint(finding.rule_id, finding.file, finding.line),
    introduced_by_change: finding.introduced_by_change
  };
}
