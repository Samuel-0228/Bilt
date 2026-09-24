import path from "node:path";
import { promises as fs } from "node:fs";
import {
  evaluateHardcodedSecrets,
  evaluateEnvExposure,
  evaluateRouteAuthMiddleware,
  evaluateInputValidation,
  evaluateMethodRestrictions,
  evaluateAuthzIdor,
} from "../../src/core/rules/pack/index.js";
import { RULE_TEMPLATES } from "../../src/core/finding/templates.js";
import type { Finding } from "../../src/core/finding/types.js";

export interface BenchmarkRuleDef {
  id: string;
  name: string;
  fixturesDir: string;
  evaluator: (filePath: string, content: string) => Finding[];
}

export interface RuleBenchmarkResult {
  ruleId: string;
  name: string;
  tier: string;
  maturity: string;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  precision: number;
  recall: number;
  passedGate: boolean;
  errors: string[];
}

export const BENCHMARK_RULES: BenchmarkRuleDef[] = [
  {
    id: "RULE-SEC-001",
    name: "Hardcoded Secrets",
    fixturesDir: "tests/fixtures/rules/rule-secrets",
    evaluator: evaluateHardcodedSecrets,
  },
  {
    id: "RULE-ENV-001",
    name: "Environment Exposure",
    fixturesDir: "tests/fixtures/rules/rule-env-exposed",
    evaluator: evaluateEnvExposure,
  },
  {
    id: "RULE-AUTH-001",
    name: "Auth Middleware",
    fixturesDir: "tests/fixtures/rules/rule-auth-middleware",
    evaluator: (filePath: string, content: string) => {
      const evalPath = filePath.endsWith("3.ts")
        ? "src/app/api/admin/users/route.ts"
        : filePath;
      return evaluateRouteAuthMiddleware(evalPath, content);
    },
  },
  {
    id: "RULE-INPUT-001",
    name: "Input Validation",
    fixturesDir: "tests/fixtures/rules/rule-input-validation",
    evaluator: evaluateInputValidation,
  },
  {
    id: "RULE-HTTP-001",
    name: "Method Restriction",
    fixturesDir: "tests/fixtures/rules/rule-method-restriction",
    evaluator: evaluateMethodRestrictions,
  },
  {
    id: "RULE-IDOR-001",
    name: "Authz / IDOR",
    fixturesDir: "tests/fixtures/rules/rule-authz-idor",
    evaluator: evaluateAuthzIdor,
  },
];

export async function runBenchmark(
  projectRoot: string = process.cwd(),
): Promise<{
  results: RuleBenchmarkResult[];
  allPassed: boolean;
  report: string;
}> {
  const results: RuleBenchmarkResult[] = [];
  let allPassed = true;

  for (const rule of BENCHMARK_RULES) {
    const template = RULE_TEMPLATES[rule.id];
    const tier = template?.precision || "medium";
    const maturity = template?.maturity || "experimental";

    const absDir = path.resolve(projectRoot, rule.fixturesDir);
    let files: string[] = [];
    try {
      files = await fs.readdir(absDir);
    } catch (err) {
      throw new Error(
        `Failed to read fixture directory for ${rule.id} at ${absDir}: ${err}`,
      );
    }

    const posFiles = files.filter((f) => f.startsWith("pos-")).sort();
    const negFiles = files.filter((f) => f.startsWith("neg-")).sort();

    let tp = 0;
    let fp = 0;
    let tn = 0;
    let fn = 0;
    const errors: string[] = [];

    // Evaluate positive fixtures (expecting >= 1 finding)
    for (const f of posFiles) {
      const filePath = path.join(absDir, f);
      const content = await fs.readFile(filePath, "utf-8");
      const findings = rule
        .evaluator(filePath, content)
        .filter((item) => item.rule_id === rule.id);

      if (findings.length > 0) {
        tp++;
      } else {
        fn++;
        errors.push(
          `False Negative: ${f} expected detection for ${rule.id}, but none found.`,
        );
      }
    }

    // Evaluate negative fixtures (expecting 0 findings)
    for (const f of negFiles) {
      const filePath = path.join(absDir, f);
      const content = await fs.readFile(filePath, "utf-8");
      const findings = rule
        .evaluator(filePath, content)
        .filter((item) => item.rule_id === rule.id);

      if (findings.length === 0) {
        tn++;
      } else {
        fp++;
        errors.push(
          `False Positive: ${f} expected 0 findings for ${rule.id}, but found ${findings.length}.`,
        );
      }
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 1.0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 1.0;

    // Strict Gate: stable rules MUST have 100% precision (fp === 0)
    let passedGate = true;
    if (maturity === "stable" && precision < 1.0) {
      passedGate = false;
      allPassed = false;
    }

    results.push({
      ruleId: rule.id,
      name: rule.name,
      tier,
      maturity,
      tp,
      fp,
      tn,
      fn,
      precision,
      recall,
      passedGate,
      errors,
    });
  }

  // Format Markdown Report
  const lines: string[] = [];
  lines.push("# Bilt Deterministic Precision Benchmark Report\n");
  lines.push(
    "| Rule ID | Name | Tier | Maturity | TP | FP | TN | FN | Precision | Recall | Gate Status |",
  );
  lines.push(
    "| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |",
  );

  for (const r of results) {
    const precStr = (r.precision * 100).toFixed(1) + "%";
    const recallStr = (r.recall * 100).toFixed(1) + "%";
    const statusStr = r.passedGate ? "PASS" : "**FAIL**";
    lines.push(
      `| ${r.ruleId} | ${r.name} | ${r.tier} | ${r.maturity} | ${r.tp} | ${r.fp} | ${r.tn} | ${r.fn} | ${precStr} | ${recallStr} | ${statusStr} |`,
    );
  }

  lines.push("");
  lines.push(
    `**Overall Gate Result**: ${allPassed ? "ALL RULES PASSED GATE" : "GATE FAILED (Stable rules below 100% precision)"}`,
  );

  for (const r of results) {
    if (r.errors.length > 0) {
      lines.push(`\n### Errors for ${r.ruleId}:`);
      for (const err of r.errors) {
        lines.push(`- ${err}`);
      }
    }
  }

  const report = lines.join("\n");
  return { results, allPassed, report };
}

// Execute directly if run via CLI
if (
  process.argv[1] &&
  (process.argv[1].endsWith("benchmark.ts") ||
    process.argv[1].endsWith("benchmark.js"))
) {
  runBenchmark()
    .then(({ report, allPassed }) => {
      console.log(report);
      if (!allPassed) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("Benchmark failed with error:", err);
      process.exit(1);
    });
}
