// ─── Privacy & PII Readiness Check ───────────────────────────────────────────
// Guided inspection for personal data collection, storage, retention, and deletion.
// Status: GUIDED — review required when personal identity data is handled.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReadinessCategory } from "../taxonomy.js";
import type { BiltCheckFinding, CheckMode } from "../finding.js";
import type { CategoryChecker, CheckContext } from "../check-runner.js";
import { generateCheckFingerprint } from "../finding.js";

const CATEGORY: ReadinessCategory = "privacy-and-pii";

export const privacyAndPiiChecker: CategoryChecker = {
  category: CATEGORY,
  mode: "guided" as CheckMode,

  async run(context: CheckContext): Promise<BiltCheckFinding[]> {
    const findings: BiltCheckFinding[] = [];

    const handlesPii = context.files.some((f) =>
      /ssn|social_security|passport|date_of_birth|dob|national_id|drivers_license/i.test(
        f.content,
      ),
    );

    if (handlesPii) {
      findings.push({
        ruleId: "CHECK-PII-GUIDED-001",
        category: CATEGORY,
        mode: "guided",
        severity: "high",
        precision: "medium",
        maturity: "stable",
        status: "needs-review",
        title: "Sensitive PII attributes detected in schema or models",
        whyItMatters:
          "Storing government identifiers, birthdates, or national IDs requires rigorous encryption at rest, " +
          "access audits, and GDPR/CCPA compliance procedures.",
        technicalDetail:
          "Sensitive PII fields identified in application data models. " +
          "Verify field-level encryption, access logs, and data retention/deletion mechanisms.",
        agentAction:
          "Verify that sensitive PII is encrypted at rest, access is restricted to authorized roles, " +
          "and an automated account deletion / data export flow is implemented.",
        evidenceRequired: true,
        fixable: false,
        fingerprint: generateCheckFingerprint("CHECK-PII-GUIDED-001", "pii-data"),
      });
    }

    return findings;
  },
};
