// ─── Transport & Security Headers Readiness Check ─────────────────────────────
// Automated inspection for HTTPS, CORS misconfigurations, and security headers.
// Status: PARTIAL — static checks for wildcard CORS credentials and security headers.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReadinessCategory } from "../taxonomy.js";
import type { BiltCheckFinding, CheckMode } from "../finding.js";
import type { CategoryChecker, CheckContext } from "../check-runner.js";
import { generateCheckFingerprint } from "../finding.js";

const CATEGORY: ReadinessCategory = "transport-and-headers";

export const transportAndHeadersChecker: CategoryChecker = {
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
        normalizedPath.includes("/readiness/") ||
        normalizedPath.includes("/core/rules/")
      ) {
        continue;
      }

      if (!/\.(ts|js|tsx|jsx|mjs|cjs)$/.test(normalizedPath)) continue;

      const content = file.content;

      // 1. Insecure CORS: wildcard origin + credentials: true
      if (
        /cors\s*\(\s*\{[^}]*origin\s*:\s*(\*|true|['"]\*['"])[^}]*credentials\s*:\s*true/i.test(
          content,
        ) ||
        (content.includes("Access-Control-Allow-Origin', '*'") &&
          content.includes("Access-Control-Allow-Credentials', 'true'"))
      ) {
        findings.push({
          ruleId: "CHECK-CORS-001",
          category: CATEGORY,
          mode: "automated",
          severity: "critical",
          precision: "high",
          maturity: "stable",
          status: "fail",
          title: "Wildcard CORS origin configured with credentials enabled",
          whyItMatters:
            "Combining wildcard origin with credentials allows any malicious site visited by your users " +
            "to make authenticated cross-origin requests to your API and steal private user data.",
          technicalDetail:
            `${file.path} configures CORS with a wildcard origin and credentials: true. Modern browsers forbid this or expose credentials.`,
          agentAction:
            "Specify explicit trusted origins in the CORS configuration instead of '*' or boolean true.",
          fixable: false,
          file: file.path,
          line: 1,
          fingerprint: generateCheckFingerprint("CHECK-CORS-001", file.path, 1),
        });
      }
    }

    // 2. Missing Helmet in Express/Fastify applications
    const isExpressOrFastify = context.files.some((f) =>
      /from\s+['"]express['"]|require\(['"]express['"]\)|from\s+['"]fastify['"]/i.test(
        f.content,
      ),
    );

    if (isExpressOrFastify) {
      const usesHelmet = context.files.some((f) =>
        /helmet|fastify-helmet/i.test(f.content),
      );

      if (!usesHelmet) {
        findings.push({
          ruleId: "CHECK-HDR-002",
          category: CATEGORY,
          mode: "automated",
          severity: "medium",
          precision: "medium",
          maturity: "stable",
          status: "fail",
          title: "Missing standard HTTP security headers (Helmet)",
          whyItMatters:
            "Without security headers (X-Frame-Options, Content-Security-Policy, HSTS), " +
            "applications are vulnerable to clickjacking, MIME-sniffing, and protocol downgrade attacks.",
          technicalDetail:
            "Express/Fastify backend detected without helmet or @fastify/helmet middleware.",
          agentAction:
            "Install helmet ('npm install helmet') and mount it as your first middleware ('app.use(helmet())').",
          fixable: false,
          fingerprint: generateCheckFingerprint("CHECK-HDR-002", "helmet-middleware"),
        });
      }
    }

    return findings;
  },
};
