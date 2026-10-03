// ─── Design Quality Engine ──────────────────────────────────────────────────
// Evaluates design rules, manages baselines & documented exceptions,
// computes fingerprints, and integrates with loop escalation detection.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import path from "node:path";
import { buildDesignSnapshot } from "./snapshot.js";
import { DESIGN_RULES } from "./catalog.js";
import { applyDesignSafeFixes } from "./fix.js";
import { loadConfig } from "../../config/config.js";
import { checkLoopProgress, resetLoopState } from "../loop/state.js";
import { getGitScope } from "../scoping/git-scope.js";
import type {
  DesignCheckOptions,
  DesignCheckResult,
  DesignFinding,
  SuppressedDesignFinding,
  DesignCheckConfig,
} from "./types.js";

export function generateDesignFingerprint(
  ruleId: string,
  file?: string,
  line?: number,
  extra?: string,
): string {
  const hash = crypto.createHash("sha256");
  hash.update(ruleId);
  if (file) hash.update(`:${file}`);
  if (line !== undefined) hash.update(`:${line}`);
  if (extra) hash.update(`:${extra}`);
  return hash.digest("hex");
}

export async function runDesignCheck(
  rootDir: string = ".",
  options: DesignCheckOptions = {},
): Promise<DesignCheckResult> {
  const normalizedRoot = path.resolve(rootDir);

  // 1. If --fix requested, apply deterministic safe fixes first
  let fixedCount = 0;
  if (options.fix) {
    const fixes = await applyDesignSafeFixes(normalizedRoot);
    fixedCount = fixes.length;
  }

  // 2. Determine git-scoped files if --changed or --base requested
  let targetFiles: string[] | undefined;
  if (options.changed || options.base) {
    const gitScope = await getGitScope(normalizedRoot, {
      changed: options.changed,
      base: options.base,
    });
    if (gitScope && gitScope.changedFiles.size > 0) {
      targetFiles = Array.from(gitScope.changedFiles);
    }
  }

  // 3. Build snapshot
  const snapshot = await buildDesignSnapshot(normalizedRoot, targetFiles);

  // 4. Load configuration & suppressions
  const biltConfig = await loadConfig(normalizedRoot);
  const designConfig: DesignCheckConfig = (biltConfig as any).designCheck || {};

  const ignoreList = Array.isArray(designConfig.ignore) ? designConfig.ignore : [];
  const reasonMap = designConfig.reason || {};
  const isIgnoreAll = (designConfig as any).ignoreAll === true || ignoreList.includes("*");

  // 5. Evaluate rules
  const rawFindings: DesignFinding[] = [];
  const suppressedFindings: SuppressedDesignFinding[] = [];
  const timingMs: Record<string, number> = {};

  for (const rule of DESIGN_RULES) {
    const startRule = performance.now();
    const results = rule.check(snapshot);
    timingMs[rule.id] = Number((performance.now() - startRule).toFixed(2));
    for (const res of results) {
      if (res.matches) {
        const fp = generateDesignFingerprint(
          rule.id,
          res.file,
          res.line,
          res.evidence.join(";"),
        );

        // Check suppression
        const isIgnored = !isIgnoreAll && ignoreList.includes(rule.id);
        const reason = reasonMap[rule.id]?.trim();

        if (isIgnored && reason && reason.length > 0) {
          suppressedFindings.push({
            ruleId: rule.id,
            category: rule.category,
            severity: rule.severity,
            title: rule.title,
            reason,
            file: res.file,
          });
        } else {
          rawFindings.push({
            ruleId: rule.id,
            category: rule.category,
            severity: rule.severity,
            title: rule.title,
            whyItMatters: rule.whyItMatters,
            evidence: res.evidence,
            recommendation: rule.recommendation,
            agentAction: rule.agentAction,
            fingerprint: fp,
            file: res.file,
            line: res.line,
            endLine: res.endLine,
            fixable: res.fixable,
          });
        }
      }
    }
  }

  // 5.5 Check Brief Consistency
  const { readDesignBrief } = await import("./brief/storage.js");
  const { getBriefConsistencyFindings } = await import("./brief/rules.js");
  const brief = await readDesignBrief(normalizedRoot);
  if (brief && brief.creativeFreedom !== "creative") {
    const briefFindings = getBriefConsistencyFindings(brief, snapshot);
    for (const finding of briefFindings) {
      const isIgnored = !isIgnoreAll && ignoreList.includes(finding.ruleId);
      const reason = reasonMap[finding.ruleId]?.trim();
      if (isIgnored && reason && reason.length > 0) {
        suppressedFindings.push({
          ruleId: finding.ruleId,
          category: finding.category,
          severity: finding.severity,
          title: finding.title,
          reason,
          file: finding.file,
        });
      } else {
        rawFindings.push(finding);
      }
    }
  }

  // 6. Loop escalation check
  const activeFingerprints = rawFindings.map((f) => f.fingerprint);
  const loopResult = await checkLoopProgress(normalizedRoot, activeFingerprints, {
    maxIterations: options.maxIterations ?? 5,
    taskId: "design-check",
  });

  if (activeFindingsCount(rawFindings) === 0) {
    await resetLoopState(normalizedRoot);
  }

  // Summary counts
  const high = rawFindings.filter((f) => f.severity === "high").length;
  const medium = rawFindings.filter((f) => f.severity === "medium").length;
  const low = rawFindings.filter((f) => f.severity === "low").length;

  let status: "pass" | "needs-improvement" | "escalate" = "pass";
  if (loopResult.shouldEscalate) {
    status = "escalate";
  } else if (rawFindings.length > 0) {
    status = "needs-improvement";
  }

  const escalationMessage = loopResult.shouldEscalate
    ? `STOP.\n\nBilt detected no progress across repeated iterations.\nDo not continue making random UI changes.\nReview the findings, explain the blocker, and request human direction if necessary.\n(${loopResult.escalationReason || "No progress"})`
    : undefined;

  return {
    schemaVersion: "1",
    status,
    summary: {
      patternsDetected: rawFindings.length,
      high,
      medium,
      low,
      suppressed: suppressedFindings.length,
    },
    findings: rawFindings,
    suppressed: suppressedFindings,
    escalationMessage,
    iteration: loopResult.iteration,
    fixedCount,
    rawSnapshot: options.debug ? snapshot : undefined,
    timingMs: options.debug ? timingMs : undefined,
  };
}

function activeFindingsCount(findings: DesignFinding[]): number {
  return findings.length;
}
