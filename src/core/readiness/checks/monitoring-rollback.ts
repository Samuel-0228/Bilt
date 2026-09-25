// ─── Monitoring & Rollback Readiness Check ───────────────────────────────────
// Guided inspection for error tracking, production observability, and rollback plans.
// Status: GUIDED — verification of deployment safety nets.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReadinessCategory } from "../taxonomy.js";
import type { BiltCheckFinding, CheckMode } from "../finding.js";
import type { CategoryChecker, CheckContext } from "../check-runner.js";
import { generateCheckFingerprint } from "../finding.js";

const CATEGORY: ReadinessCategory = "monitoring-rollback";

export const monitoringRollbackChecker: CategoryChecker = {
  category: CATEGORY,
  mode: "guided" as CheckMode,

  async run(context: CheckContext): Promise<BiltCheckFinding[]> {
    const findings: BiltCheckFinding[] = [];

    const hasMonitoring = context.files.some((f) =>
      /@sentry|datadog|bugsnag|newrelic|highlight\.io|logrocket|posthog/i.test(
        f.content,
      ),
    );

    if (!hasMonitoring) {
      findings.push({
        ruleId: "CHECK-OBS-GUIDED-001",
        category: CATEGORY,
        mode: "guided",
        severity: "medium",
        precision: "low",
        maturity: "stable",
        status: "needs-review",
        title: "No application error monitoring or crash reporting SDK detected",
        whyItMatters:
          "Without automated error reporting, runtime crashes in production will only be noticed " +
          "when users complain or abandon the app.",
        technicalDetail:
          "Did not find Sentry, Datadog, Bugsnag, or similar error monitoring library in project dependencies.",
        agentAction:
          "Integrate an error reporting service such as Sentry ('npm install @sentry/nextjs' or '@sentry/node') " +
          "to receive instant alerts on unhandled production exceptions.",
        evidenceRequired: true,
        fixable: false,
        fingerprint: generateCheckFingerprint("CHECK-OBS-GUIDED-001", "monitoring"),
      });
    }

    return findings;
  },
};
