// ─── Input Validation Readiness Check ─────────────────────────────────────────
// Automated inspection for SQL injection, command injection, path traversal,
// and missing request body schema validation.
// Status: ENFORCED — deterministic static analysis.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReadinessCategory } from "../taxonomy.js";
import type { BiltCheckFinding, CheckMode } from "../finding.js";
import type { CategoryChecker, CheckContext } from "../check-runner.js";
import { generateCheckFingerprint } from "../finding.js";

const CATEGORY: ReadinessCategory = "input-validation";

export const inputValidationChecker: CategoryChecker = {
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
        normalizedPath.includes("/.git/") ||
        normalizedPath.includes("/test") ||
        normalizedPath.includes("/security-engine/") ||
        normalizedPath.includes("/readiness/") ||
        normalizedPath.includes("/core/rules/")
      ) {
        continue;
      }

      if (!/\.(ts|js|tsx|jsx|mjs|cjs)$/.test(normalizedPath)) continue;

      const lines = file.content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;

        // 1. Unsafe raw SQL string interpolation
        if (
          (/\b(query|execute|\$queryRawUnsafe)\s*\(\s*`[^`]*\$\{/i.test(line) &&
           /SELECT|INSERT|UPDATE|DELETE|DROP|FROM|WHERE/i.test(line)) ||
          (/\b(query|execute)\s*\(\s*["'][^"']*\s*\+/i.test(line) &&
           /SELECT|INSERT|UPDATE|DELETE|DROP|FROM|WHERE/i.test(line))
        ) {
          findings.push({
            ruleId: "CHECK-INPUT-001",
            category: CATEGORY,
            mode: "automated",
            severity: "critical",
            precision: "high",
            maturity: "stable",
            status: "fail",
            title: "Unsafe SQL query string concatenation or interpolation",
            whyItMatters:
              "Directly concatenating or interpolating user variables into SQL queries allows attackers " +
              "to break out of query syntax and execute arbitrary database commands (SQL Injection).",
            technicalDetail:
              `${file.path}:${i + 1} appears to construct a dynamic SQL query using template literals or string concatenation. ` +
              "Parameterized queries must be used instead.",
            agentAction:
              "Use parameterized queries or ORM query builders (e.g. prisma.$queryRaw, knex, pg parameterized $1). " +
              "Never concatenate variables directly into SQL strings.",
            fixable: false,
            file: file.path,
            line: i + 1,
            fingerprint: generateCheckFingerprint("CHECK-INPUT-001", file.path, i + 1),
          });
        }

        // 2. Command injection
        if (
          /\b(child_process|exec|execSync|spawn|spawnSync)\s*\(\s*`[^`]*\$\{/i.test(line) ||
          /\bexec\s*\([^,)]*\+\s*(req\.|params|query|body)/i.test(line)
        ) {
          findings.push({
            ruleId: "CHECK-INPUT-002",
            category: CATEGORY,
            mode: "automated",
            severity: "critical",
            precision: "high",
            maturity: "stable",
            status: "fail",
            title: "Potential command injection via unsanitized system execution",
            whyItMatters:
              "Executing system commands with user-supplied arguments allows remote attackers " +
              "to execute arbitrary shell commands on your server (Remote Code Execution / RCE).",
            technicalDetail:
              `${file.path}:${i + 1} calls a shell execution function with dynamic string interpolation.`,
            agentAction:
              "Avoid shell execution where possible. If required, use execFile or spawn with argument arrays " +
              "and avoid passing through shell interpreters.",
            fixable: false,
            file: file.path,
            line: i + 1,
            fingerprint: generateCheckFingerprint("CHECK-INPUT-002", file.path, i + 1),
          });
        }

        // 3. Path traversal
        if (
          /\b(readFile|readFileSync|writeFile|writeFileSync|createReadStream)\s*\([^,)]*(req\.query|req\.params|req\.body)/i.test(line) ||
          /path\.join\s*\([^,)]*(req\.query|req\.params|req\.body)/i.test(line)
        ) {
          findings.push({
            ruleId: "CHECK-INPUT-003",
            category: CATEGORY,
            mode: "automated",
            severity: "critical",
            precision: "high",
            maturity: "stable",
            status: "fail",
            title: "Potential path traversal via unsanitized file access",
            whyItMatters:
              "Reading or writing files using user-supplied path components allows attackers " +
              "to access arbitrary files (such as /etc/passwd or .env) using '../' sequences.",
            technicalDetail:
              `${file.path}:${i + 1} passes request parameters directly into filesystem access routines.`,
            agentAction:
              "Sanitize filenames with path.basename() and verify the resolved path remains within an allowed directory.",
            fixable: false,
            file: file.path,
            line: i + 1,
            fingerprint: generateCheckFingerprint("CHECK-INPUT-003", file.path, i + 1),
          });
        }

        // 4. Dangerous HTML injection
        if (/dangerouslySetInnerHTML\s*=\s*\{\s*__html:\s*(?!['"`]<)[^}]+\}/i.test(line)) {
          findings.push({
            ruleId: "CHECK-INPUT-004",
            category: CATEGORY,
            mode: "automated",
            severity: "high",
            precision: "medium",
            maturity: "stable",
            status: "fail",
            title: "Unsafe HTML rendering via dangerouslySetInnerHTML",
            whyItMatters:
              "Rendering unsanitized HTML on the client allows Cross-Site Scripting (XSS), " +
              "enabling attackers to hijack sessions and perform actions on behalf of users.",
            technicalDetail:
              `${file.path}:${i + 1} sets innerHTML using a dynamic expression. Ensure DOMPurify or equivalent sanitization is applied.`,
            agentAction:
              "Sanitize HTML strings with DOMPurify before rendering, or use safe React JSX elements.",
            fixable: false,
            file: file.path,
            line: i + 1,
            fingerprint: generateCheckFingerprint("CHECK-INPUT-004", file.path, i + 1),
          });
        }
      }

      // 5. Check route handlers for schema validation (Zod, Yup, Joi, Valibot)
      const isRouteHandler =
        normalizedPath.includes("/api/") ||
        normalizedPath.endsWith("route.ts") ||
        normalizedPath.endsWith("route.js") ||
        normalizedPath.includes("/routes/");

      if (isRouteHandler && /POST|PUT|PATCH/i.test(file.content)) {
        const hasValidator =
          /zod|\.parse\(|\.safeParse\(|joi|yup|valibot|class-validator|validateBody/i.test(file.content);

        if (!hasValidator) {
          findings.push({
            ruleId: "CHECK-INPUT-005",
            category: CATEGORY,
            mode: "automated",
            severity: "high",
            precision: "medium",
            maturity: "stable",
            status: "fail",
            title: `Missing request body validation in mutating API handler ${file.path}`,
            whyItMatters:
              "Accepting unvalidated request payloads allows attackers to inject unexpected data types, " +
              "exceed size boundaries, or trigger unhandled server exceptions.",
            technicalDetail:
              `${file.path} handles mutating requests (POST/PUT/PATCH) without standard schema validation (e.g. Zod, Joi).`,
            agentAction:
              "Define a strict request schema using Zod or a similar schema library and validate req.body before processing.",
            fixable: false,
            file: file.path,
            line: 1,
            fingerprint: generateCheckFingerprint("CHECK-INPUT-005", file.path, 1),
          });
        }
      }
    }

    return findings;
  },
};
