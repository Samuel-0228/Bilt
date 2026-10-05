// ─── Requirements Readiness Check ─────────────────────────────────────────────
// Verifies structured project requirements defined in `.bilt/requirements.json`.
// ─────────────────────────────────────────────────────────────────────────────

import type { BiltCheckFinding } from "../finding.js";
import { generateCheckFingerprint, normalizeAgentAction } from "../finding.js";
import type { CategoryChecker, CheckContext } from "../check-runner.js";
import { loadRequirementsContract } from "../../contract/requirements.js";

export const requirementsChecker: CategoryChecker = {
  category: "auth" as any, // Runs as part of project contracts
  mode: "automated",

  async run(context: CheckContext): Promise<BiltCheckFinding[]> {
    const findings: BiltCheckFinding[] = [];
    const contract = await loadRequirementsContract(context.rootDir);

    if (contract.requirements.length === 0) {
      return findings;
    }

    for (const req of contract.requirements) {
      // If target files specified, verify they exist
      if (req.targetFiles && req.targetFiles.length > 0) {
        for (const targetPattern of req.targetFiles) {
          const matched = context.files.some(
            (f) => f.path === targetPattern || f.path.includes(targetPattern),
          );

          if (!matched) {
            const ruleId = `REQ-MISSING-${req.id}`;
            const fp = generateCheckFingerprint(ruleId, targetPattern);

            findings.push({
              id: fp.slice(0, 12),
              ruleId,
              category: (req.type === "authentication" ? "auth" : req.type === "authorization" ? "authorization" : "auth") as any,
              mode: "automated",
              severity: req.priority === "critical" ? "critical" : req.priority === "high" ? "high" : "medium",
              precision: "high",
              maturity: "stable",
              status: "fail",
              lifecycleStatus: "open",
              title: `Unfulfilled Project Requirement: ${req.id}`,
              whyItMatters: `Project requirement "${req.description}" specifies target file "${targetPattern}" which is missing or not implemented.`,
              technicalDetail: `Requirement ID: ${req.id}\nDescription: ${req.description}\nExpected implementation file: ${targetPattern}`,
              agentAction: normalizeAgentAction(
                `Implement requirement ${req.id} in target file ${targetPattern}: ${req.description}`,
                targetPattern,
              ),
              fixable: false,
              locations: [{ file: targetPattern }],
              fingerprint: fp,
              introduced_by_change: true,
              file: targetPattern,
            });
          }
        }
      }
    }

    return findings;
  },
};
