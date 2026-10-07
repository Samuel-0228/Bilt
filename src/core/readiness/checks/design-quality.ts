// ─── Design Quality & UX Readiness Check ────────────────────────────────────
// Advisory category checking for generic template patterns and production UX completeness.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReadinessCategory } from "../taxonomy.js";
import type { BiltCheckFinding, CheckMode } from "../finding.js";
import type { CategoryChecker, CheckContext } from "../check-runner.js";
import { runDesignCheck } from "../../design/engine.js";

const CATEGORY: ReadinessCategory = "design-quality";

export const designQualityChecker: CategoryChecker = {
  category: CATEGORY,
  mode: "automated" as CheckMode,

  async run(context: CheckContext): Promise<BiltCheckFinding[]> {
    const findings: BiltCheckFinding[] = [];

    const designResult = await runDesignCheck(context.rootDir, {
      changed: !!context.changedFiles,
    });

    for (const df of designResult.findings) {
      findings.push({
        ruleId: df.ruleId,
        category: CATEGORY,
        mode: "automated",
        severity: df.severity === "high" ? "high" : df.severity === "medium" ? "medium" : "low",
        precision: "high",
        maturity: "stable",
        status: "needs-review", // Advisory: does not hard-block production security gate
        title: df.title,
        whyItMatters: df.whyItMatters,
        technicalDetail: df.evidence.join("; "),
        agentAction: df.agentAction,
        evidence: df.evidence,
        fixable: !!df.fixable,
        file: df.file,
        line: df.line,
        endLine: df.endLine,
        locations:
          df.locations && df.locations.length > 0
            ? df.locations.map((l) => ({ file: l.file, startLine: l.line, endLine: l.endLine }))
            : df.file
              ? [{ file: df.file, startLine: df.line, endLine: df.endLine }]
              : [],
        fingerprint: df.fingerprint,
      });
    }

    return findings;
  },
};
