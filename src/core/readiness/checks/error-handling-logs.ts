// ─── Error Handling & Logging Readiness Check ────────────────────────────────
// Automated inspection for exposed stack traces and sensitive credentials in logs.
// Status: PARTIAL — static checks for error leaks and credential logging.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReadinessCategory } from "../taxonomy.js";
import type { BiltCheckFinding, CheckMode } from "../finding.js";
import type { CategoryChecker, CheckContext } from "../check-runner.js";
import { generateCheckFingerprint } from "../finding.js";

const CATEGORY: ReadinessCategory = "error-handling-logs";

export const errorHandlingLogsChecker: CategoryChecker = {
  category: CATEGORY,
  mode: "automated" as CheckMode,

  async run(context: CheckContext): Promise<BiltCheckFinding[]> {
    const findings: BiltCheckFinding[] = [];

    for (const file of context.files) {
      const normalizedPath = file.path.replace(/\\/g, "/");
      if (
        normalizedPath.includes("/node_modules/") ||
        normalizedPath.includes("/dist/") ||
        normalizedPath.includes("/build/") ||
        normalizedPath.includes("/test") ||
        normalizedPath.includes("/security-engine/") ||
        normalizedPath.includes("/core/rules/") ||
        normalizedPath.includes("/readiness/")
      ) {
        continue;
      }

      if (!/\.(ts|js|tsx|jsx|mjs|cjs)$/.test(normalizedPath)) continue;

      const lines = file.content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;

        // 1. Stack trace leakage to client responses
        if (
          /\bres\.(status\(\d+\)\.)?(json|send)\s*\([^)]*(err\.stack|error\.stack)/i.test(
            line,
          ) ||
          /NextResponse\.json\s*\([^)]*(err\.stack|error\.stack)/i.test(line)
        ) {
          findings.push({
            ruleId: "CHECK-ERR-001",
            category: CATEGORY,
            mode: "automated",
            severity: "high",
            precision: "high",
            maturity: "stable",
            status: "fail",
            title: "Internal error stack trace leaked in HTTP response",
            whyItMatters:
              "Sending raw error stack traces to clients reveals internal server paths, database schemas, " +
              "library versions, and infrastructure details that assist attackers in crafting exploits.",
            technicalDetail:
              `${file.path}:${i + 1} sends error.stack in the API response. Production responses should only return generic error messages.`,
            agentAction:
              "Log the stack trace server-side with an error monitoring service and return a sanitized error message (e.g., 'Internal Server Error').",
            fixable: false,
            file: file.path,
            line: i + 1,
            fingerprint: generateCheckFingerprint("CHECK-ERR-001", file.path, i + 1),
          });
        }

        // 2. Sensitive credential logging
        if (
          /\bconsole\.(log|info|warn|error)\s*\([^)]*(password|passwd|apiKey|api_key|secret|token|authorization)/i.test(
            line,
          ) &&
          !line.includes("password:") &&
          !line.includes("error")
        ) {
          findings.push({
            ruleId: "CHECK-LOG-002",
            category: CATEGORY,
            mode: "automated",
            severity: "medium",
            precision: "medium",
            maturity: "stable",
            status: "fail",
            title: "Potential sensitive credential or token logged to console",
            whyItMatters:
              "Logging credentials or auth tokens stores secrets in plaintext log management systems, " +
              "exposing them to third-party log providers and team members without credential access.",
            technicalDetail:
              `${file.path}:${i + 1} appears to log sensitive variable names (password, token, or secret) to standard output.`,
            agentAction:
              "Sanitize or redact sensitive attributes before passing objects to console.log.",
            fixable: false,
            file: file.path,
            line: i + 1,
            fingerprint: generateCheckFingerprint("CHECK-LOG-002", file.path, i + 1),
          });
        }
      }
    }

    return findings;
  },
};
