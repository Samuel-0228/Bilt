import { scanFileForSecrets } from "../../scan/secrets.js";
import { SECRET_RULES } from "../secret-rules.js";
import type { Finding } from "../../finding/types.js";
import { toAgentFinding } from "../../finding/mapper.js";

export function evaluateHardcodedSecrets(
  filePath: string,
  content: string,
): Finding[] {
  const rawFindings = scanFileForSecrets(content, filePath, SECRET_RULES, {
    entropyThreshold: 4.5,
    includeTests: true,
  });

  return rawFindings.map((f) => {
    const finding = toAgentFinding(f, {
      surroundingSnippet: f.preview,
      lineContent: f.message,
    });
    finding.rule_id = "RULE-SEC-001";
    finding.precision = "high";
    return finding;
  });
}
