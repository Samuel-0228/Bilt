import type { Finding } from "../../finding/types.js";
import { toAgentFinding } from "../../finding/mapper.js";
import type { ScanFinding } from "../../../types/index.js";

const WILDCARD_METHOD_REGEX =
  /(?:app|router|server)\.all\s*\(\s*["'`]([^"'`]+)["'`]/i;
const NEXT_ALL_HANDLER_REGEX = /export\s+(?:async\s+)?function\s+ALL\b/i;

export function evaluateMethodRestrictions(
  filePath: string,
  content: string,
): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (WILDCARD_METHOD_REGEX.test(line)) {
      const match = line.match(WILDCARD_METHOD_REGEX);
      const routePath = match ? match[1] : "route";

      const raw: ScanFinding = {
        id: `method-wildcard-${Date.now()}-${i}`,
        ruleId: "RULE-HTTP-001",
        severity: "warning",
        category: "api-wildcard-method",
        message: `Wildcard HTTP method handler 'app.all()' registered on '${routePath}'`,
        file: filePath,
        line: i + 1,
        preview: line.trim(),
        suggestion:
          "Bind specific HTTP verbs (app.get, app.post) instead of using wildcard app.all().",
      };
      findings.push(toAgentFinding(raw, { surroundingSnippet: line.trim() }));
    }

    if (NEXT_ALL_HANDLER_REGEX.test(line)) {
      const raw: ScanFinding = {
        id: `method-next-all-${Date.now()}-${i}`,
        ruleId: "RULE-HTTP-001",
        severity: "warning",
        category: "api-wildcard-method",
        message: "Next.js Route Handler exports wildcard 'ALL' handler",
        file: filePath,
        line: i + 1,
        preview: line.trim(),
        suggestion:
          "Export specific HTTP method functions (e.g. GET, POST) instead of catch-all ALL handler.",
      };
      findings.push(toAgentFinding(raw, { surroundingSnippet: line.trim() }));
    }
  }

  return findings;
}
