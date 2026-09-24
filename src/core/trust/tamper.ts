import { simpleGit } from "simple-git";
import path from "node:path";
import type { TamperFinding } from "../output/types.js";

const CONFIG_FILE_PATTERNS = [
  ".biltrc",
  ".biltrc.json",
  ".biltrc.yaml",
  ".biltrc.yml",
  ".biltrc.js",
  "bilt.config.js",
  "bilt.config.ts",
];

const BROAD_IGNORE_PATTERNS = [
  /^\*+$/,
  /^\*\*\/\*$/,
  /^\*\*\/\*\.\*$/,
  /^src\/\*\*$/,
  /^\.\/\*\*$/,
  /^app\/\*\*$/,
  /^lib\/\*\*$/,
];

export interface DiffConfigChange {
  addedIgnores: string[];
  severityDowngrades: Array<{ ruleId: string; from: string; to: string }>;
  disabledRules: string[];
}

/**
 * Parse a configuration file diff to detect weakening patterns.
 */
export function analyzeConfigDiff(diffContent: string): DiffConfigChange {
  const addedIgnores: string[] = [];
  const severityDowngrades: Array<{
    ruleId: string;
    from: string;
    to: string;
  }> = [];
  const disabledRules: string[] = [];

  const lines = diffContent.split("\n");

  for (const line of lines) {
    // Check for newly added broad ignores: + "src/**" or + "ignore": ["*"]
    if (line.startsWith("+") && !line.startsWith("+++")) {
      const matchIgnore = line.match(/["']([^"']+)["']/);
      if (matchIgnore) {
        const pattern = matchIgnore[1]!.trim();
        if (BROAD_IGNORE_PATTERNS.some((re) => re.test(pattern))) {
          addedIgnores.push(pattern);
        }
      }

      // Check for severity downgrades: e.g. + "RULE-SEC-001": "info"
      const downgradeMatch = line.match(
        /["']([A-Za-z0-9_-]+)["']\s*:\s*["'](info|warning|passed|off)["']/i,
      );
      if (downgradeMatch) {
        severityDowngrades.push({
          ruleId: downgradeMatch[1]!,
          from: "critical",
          to: downgradeMatch[2]!,
        });
      }
    }

    // Check for deleted rules: - "RULE-SEC-001"
    if (line.startsWith("-") && !line.startsWith("---")) {
      const removedRuleMatch = line.match(
        /["'](RULE-[A-Za-z0-9_-]+|SEC-[A-Za-z0-9_-]+)["']/,
      );
      if (removedRuleMatch) {
        disabledRules.push(removedRuleMatch[1]!);
      }
    }
  }

  return { addedIgnores, severityDowngrades, disabledRules };
}

/**
 * Compare configuration, rule definitions, and suppressions against base git ref.
 * Returns tamper findings if any weakening is detected.
 */
export async function detectTampering(
  rootDir: string,
  baseRef: string = "HEAD~1",
): Promise<TamperFinding[]> {
  const tamperFindings: TamperFinding[] = [];

  try {
    const git = simpleGit(rootDir);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) return [];

    // Diff against baseRef
    for (const configFile of CONFIG_FILE_PATTERNS) {
      try {
        const diff = await git.diff([baseRef, "--", configFile]);
        if (!diff || !diff.trim()) continue;

        const analysis = analyzeConfigDiff(diff);

        for (const broadIgnore of analysis.addedIgnores) {
          tamperFindings.push({
            rule_id: "TAMPER-BROAD-IGNORE",
            severity: "critical",
            message: `Broad ignore pattern '${broadIgnore}' was added to ${configFile}, bypassing security checks.`,
            file: configFile,
            details:
              "Broad file ignores weaken security gating and prevent detection of newly introduced vulnerabilities.",
          });
        }

        for (const downgrade of analysis.severityDowngrades) {
          tamperFindings.push({
            rule_id: "TAMPER-SEVERITY-DOWNGRADE",
            severity: "critical",
            message: `Rule '${downgrade.ruleId}' severity was downgraded to '${downgrade.to}' in ${configFile}.`,
            file: configFile,
            details:
              "Downgrading rule severities circumvents hard failure gates in automated CI environments.",
          });
        }

        for (const disabledRule of analysis.disabledRules) {
          tamperFindings.push({
            rule_id: "TAMPER-RULE-REMOVED",
            severity: "critical",
            message: `Security rule '${disabledRule}' was deleted or deactivated in ${configFile}.`,
            file: configFile,
            details:
              "Disabling security rules eliminates safeguards without addressing the underlying risks.",
          });
        }
      } catch {
        // Skip files that don't exist in base ref
      }
    }

    // Check if .bilt/baseline.json was modified vs baseRef
    try {
      const baselineDiff = await git.diff([
        baseRef,
        "--",
        ".bilt/baseline.json",
      ]);
      if (baselineDiff && baselineDiff.trim().length > 0) {
        tamperFindings.push({
          rule_id: "TAMPER-BASELINE-MUTATED",
          severity: "warning",
          message: ".bilt/baseline.json was modified in this change.",
          file: ".bilt/baseline.json",
          details:
            "Baselines should be updated only via approved maintenance workflows to prevent hiding new findings.",
        });
      }
    } catch {
      // Skip if baseline is untracked
    }
  } catch (err) {
    // If git operations fail (e.g. invalid baseRef), report warning or return empty
  }

  return tamperFindings;
}
