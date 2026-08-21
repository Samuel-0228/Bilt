import type { ScanFinding } from "../../types/index.js";
import { ALL_SECURITY_RULES } from "../security-engine/rules/index.js";

const FIXABLE_CATEGORIES = new Set([
  "secret-detected",
  "git-history-secret",
  "git-committed-env",
  "gitignore-missing",
  "env-missing",
  "env-unused",
  "env-mismatch",
  "env-exposed",
  "config-tsconfig",
  "config-docker",
  "config-ci",
  "config-package",
  "dep-vulnerable",
  "dep-duplicate",
  "dep-unused",
  "dep-outdated",
  "api-exposed-docs",
  "api-wildcard-method",
]);

const FIXABLE_PLUGIN_IDS = [
  "docker-no-dockerignore",
  "docker-dockerignore-env",
  "docker-env-secret",
  "terraform-gitignore-tfvars",
  "terraform-gitignore-dir",
  "terraform-hardcoded",
  "prisma-hardcoded",
  "prisma-missing-env",
];

const FIXABLE_RULE_IDS = new Set([
  "SEC-ENV-001",
  "SEC-ENV-002",
  "SEC-ENV-003",
  "SEC-ENV-004",
  "SEC-AUTH-001",
  "SEC-CRY-001",
  "SEC-INP-004",
  "SEC-STO-002",
  "SEC-NET-001",
  "SEC-CFG-001",
  "SEC-CFG-002",
]);

/**
 * Single source of truth determining whether Bilt has an automated fix for a finding.
 */
export function canFixFinding(finding: ScanFinding): boolean {
  if (FIXABLE_CATEGORIES.has(finding.category)) {
    return true;
  }

  if (finding.category === "plugin-finding") {
    return FIXABLE_PLUGIN_IDS.some((prefix) => finding.id.startsWith(prefix));
  }

  if (finding.ruleId) {
    if (FIXABLE_RULE_IDS.has(finding.ruleId)) {
      return true;
    }
    const secRule = ALL_SECURITY_RULES.find((r) => r.id === finding.ruleId);
    if (secRule && typeof secRule.safeAutoFix === "function") {
      return true;
    }
  }

  const ruleMatch = ALL_SECURITY_RULES.find(
    (r) =>
      typeof r.safeAutoFix === "function" &&
      (finding.message.includes(`[${r.id}]`) || (finding.ruleId && finding.ruleId === r.id))
  );
  if (ruleMatch) {
    return true;
  }

  return false;
}
