import type { Finding } from "../finding/types.js";
import type { SuppressedFinding } from "../output/types.js";

export interface ConfigSuppression {
  rule_id: string;
  file?: string;
  fingerprint?: string;
  reason: string;
  expires?: string;
}

export interface SuppressionPolicyOptions {
  budget?: number; // Maximum allowed active suppressions (default: 5)
  currentDate?: Date; // Used for expiry verification
}

/**
 * Regex matching inline suppression comments:
 * // bilt-ignore <rule-id>: <mandatory-reason> [until YYYY-MM-DD]
 * /* bilt-ignore <rule-id>: <mandatory-reason> [until YYYY-MM-DD] *\/
 */
const INLINE_IGNORE_REGEX =
  /(?:\/\/|\/\*)\s*bilt-ignore\s+([A-Za-z0-9_-]+)(?:\s*:\s*([^;*\n\r]+?))?(?:\s+until\s+(\d{4}-\d{2}-\d{2}))?\s*(?:\*\/)?$/gm;

/**
 * Scan source content for inline suppression comments and validate requirements.
 * Rejects suppressions without a meaningful reason string.
 */
export function parseInlineSuppressions(
  filePath: string,
  content: string,
  currentDate: Date = new Date(),
): {
  validSuppressions: SuppressedFinding[];
  invalidComments: Array<{ line: number; message: string }>;
} {
  const validSuppressions: SuppressedFinding[] = [];
  const invalidComments: Array<{ line: number; message: string }> = [];

  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i]!;
    const lineNum = i + 1;

    INLINE_IGNORE_REGEX.lastIndex = 0;
    const match = INLINE_IGNORE_REGEX.exec(lineText);

    if (match) {
      const ruleId = match[1]!.trim().toUpperCase();
      const rawReason = match[2]?.trim();
      const expiryStr = match[3]?.trim();

      // Rule: Reason is mandatory and cannot be empty or generic filler
      if (
        !rawReason ||
        rawReason.length < 5 ||
        /^TODO|^FIXME|^IGNORE$/i.test(rawReason)
      ) {
        invalidComments.push({
          line: lineNum,
          message: `Inline suppression for '${ruleId}' at line ${lineNum} was rejected: a non-trivial reason string is mandatory.`,
        });
        continue;
      }

      // Check expiry date if provided
      if (expiryStr) {
        const expiryDate = new Date(expiryStr);
        if (!isNaN(expiryDate.getTime()) && currentDate > expiryDate) {
          invalidComments.push({
            line: lineNum,
            message: `Inline suppression for '${ruleId}' at line ${lineNum} expired on ${expiryStr}.`,
          });
          continue;
        }
      }

      validSuppressions.push({
        rule_id: ruleId,
        fingerprint: `inline:${filePath}:${lineNum}:${ruleId}`,
        reason: rawReason,
        file: filePath.replace(/\\/g, "/"),
        line: lineNum,
        expires: expiryStr,
      });
    }
  }

  return { validSuppressions, invalidComments };
}

/**
 * Apply valid suppressions to a list of findings, enforcing the suppression budget.
 */
export function applySuppressions(
  findings: Finding[],
  suppressions: SuppressedFinding[],
  options: SuppressionPolicyOptions = {},
): {
  activeFindings: Finding[];
  suppressedFindings: SuppressedFinding[];
  budgetExceeded: boolean;
  budget: number;
} {
  const budget = options.budget ?? 5;
  const suppressedFindings: SuppressedFinding[] = [];
  const activeFindings: Finding[] = [];

  const suppressionMap = new Map<string, SuppressedFinding>();
  for (const s of suppressions) {
    const key = `${s.rule_id}|${s.file.replace(/\\/g, "/")}`;
    suppressionMap.set(key, s);
    // Also map by fingerprint if applicable
    if (s.fingerprint) {
      suppressionMap.set(s.fingerprint, s);
    }
  }

  const budgetExceeded = suppressions.length > budget;

  for (const f of findings) {
    const fileKey = `${f.rule_id}|${f.file.replace(/\\/g, "/")}`;
    const suppression =
      suppressionMap.get(f.fingerprint) || suppressionMap.get(fileKey);

    // If suppressed and budget is not exceeded
    if (suppression && !budgetExceeded) {
      suppressedFindings.push(suppression);
    } else {
      activeFindings.push(f);
    }
  }

  return {
    activeFindings,
    suppressedFindings,
    budgetExceeded,
    budget,
  };
}
