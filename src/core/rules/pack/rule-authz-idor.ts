import type { Finding } from "../../finding/types.js";
import { toAgentFinding } from "../../finding/mapper.js";
import type { ScanFinding } from "../../../types/index.js";

const CLIENT_ROLE_PATTERNS = [
  /req\.body\.isAdmin\b/i,
  /req\.body\.role\b/i,
  /req\.query\.role\b/i,
  /localStorage\.getItem\s*\(\s*["'](?:role|isAdmin|permissions)["']\s*\)/i,
];

export function evaluateAuthzIdor(
  filePath: string,
  content: string,
): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    for (const pattern of CLIENT_ROLE_PATTERNS) {
      if (pattern.test(line)) {
        const raw: ScanFinding = {
          id: `authz-idor-${Date.now()}-${i}`,
          ruleId: "RULE-IDOR-001",
          severity: "warning",
          category: "framework-warning",
          message:
            "Authorization status or role is derived directly from client-controlled input.",
          file: filePath,
          line: i + 1,
          preview: line.trim(),
          suggestion:
            "Derive user role and permissions from authenticated server session / JWT claims, never client payload.",
        };
        const finding = toAgentFinding(raw, {
          surroundingSnippet: line.trim(),
        });
        // Enforce non-negotiable rule: IDOR emits NEEDS_REVIEW, never FAIL
        finding.precision = "medium";
        finding.maturity = "experimental";
        findings.push(finding);
        break;
      }
    }
  }

  return findings;
}
