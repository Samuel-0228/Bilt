// ─── Dependencies Readiness Check ─────────────────────────────────────────────
// Automated inspection for lockfiles, package consistency, and supply chain flags.
// Status: PARTIAL — automated checks for lockfile & dependency consistency.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReadinessCategory } from "../taxonomy.js";
import type { BiltCheckFinding, CheckMode } from "../finding.js";
import type { CategoryChecker, CheckContext } from "../check-runner.js";
import { generateCheckFingerprint } from "../finding.js";

const CATEGORY: ReadinessCategory = "dependencies";

export const dependenciesChecker: CategoryChecker = {
  category: CATEGORY,
  mode: "automated" as CheckMode,

  async run(context: CheckContext): Promise<BiltCheckFinding[]> {
    const findings: BiltCheckFinding[] = [];

    const hasPkgJson = context.files.some((f) =>
      f.path.replace(/\\/g, "/").endsWith("package.json"),
    );

    if (hasPkgJson) {
      const hasLockfile = context.files.some((f) => {
        const p = f.path.replace(/\\/g, "/");
        return (
          p.endsWith("package-lock.json") ||
          p.endsWith("yarn.lock") ||
          p.endsWith("pnpm-lock.yaml") ||
          p.endsWith("bun.lockb") ||
          p.endsWith("bun.lock")
        );
      });

      if (!hasLockfile) {
        findings.push({
          ruleId: "CHECK-DEP-001",
          category: CATEGORY,
          mode: "automated",
          severity: "high",
          precision: "high",
          maturity: "stable",
          status: "fail",
          title: "Missing package lockfile in repository",
          whyItMatters:
            "Deploying without a lockfile means dependencies are resolved anew on every build. " +
            "A malicious or broken upstream update can break production or compromise servers.",
          technicalDetail:
            "package.json found without package-lock.json, pnpm-lock.yaml, yarn.lock, or bun.lock.",
          agentAction:
            "Run npm install, pnpm install, or yarn install to generate a lockfile, and commit it to git.",
          fixable: false,
          fingerprint: generateCheckFingerprint("CHECK-DEP-001", "lockfile"),
        });
      }
    }

    return findings;
  },
};
