// ─── Deployment Configuration Readiness Check ────────────────────────────────
// Automated inspection for production debug flags and dangerous environment defaults.
// Status: PARTIAL — static checks for debug flags and prod build configs.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReadinessCategory } from "../taxonomy.js";
import type { BiltCheckFinding, CheckMode } from "../finding.js";
import type { CategoryChecker, CheckContext } from "../check-runner.js";
import { generateCheckFingerprint } from "../finding.js";

const CATEGORY: ReadinessCategory = "deploy-config";

export const deployConfigChecker: CategoryChecker = {
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
        normalizedPath.includes("/test")
      ) {
        continue;
      }

      // 1. Next.js productionBrowserSourceMaps: true
      if (normalizedPath.includes("next.config") && file.content.includes("productionBrowserSourceMaps: true")) {
        findings.push({
          ruleId: "CHECK-DEP-CFG-001",
          category: CATEGORY,
          mode: "automated",
          severity: "medium",
          precision: "high",
          maturity: "stable",
          status: "fail",
          title: "Browser source maps enabled for production build",
          whyItMatters:
            "Enabling production browser source maps exposes your unminified original source code, " +
            "comments, and internal architectural structure directly to any visitor in DevTools.",
          technicalDetail:
            `${file.path} explicitly sets 'productionBrowserSourceMaps: true'.`,
          agentAction:
            "Remove 'productionBrowserSourceMaps: true' or set it to false before deploying to production.",
          fixable: true,
          file: file.path,
          line: 1,
          fingerprint: generateCheckFingerprint("CHECK-DEP-CFG-001", file.path, 1),
        });
      }

      // 2. Production Dockerfile with NODE_ENV=development
      if (
        (normalizedPath.endsWith("Dockerfile") || normalizedPath.includes("docker-compose")) &&
        /ENV\s+NODE_ENV(=|\s+)development/i.test(file.content)
      ) {
        findings.push({
          ruleId: "CHECK-DEP-CFG-002",
          category: CATEGORY,
          mode: "automated",
          severity: "high",
          precision: "high",
          maturity: "stable",
          status: "fail",
          title: "Deployment container configured with NODE_ENV=development",
          whyItMatters:
            "Running in development mode disables vital production optimizations, increases memory consumption, " +
            "and causes frameworks to output verbose debug error messages.",
          technicalDetail:
            `${file.path} sets NODE_ENV to development. Production containers must run with NODE_ENV=production.`,
          agentAction:
            "Set 'ENV NODE_ENV=production' in your production Dockerfile.",
          fixable: true,
          file: file.path,
          line: 1,
          fingerprint: generateCheckFingerprint("CHECK-DEP-CFG-002", file.path, 1),
        });
      }
    }

    return findings;
  },
};
