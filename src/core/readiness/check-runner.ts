// ─── Check Runner Orchestrator ───────────────────────────────────────────────
// Executes automated and guided checks across the 14 production readiness categories.
// Integrates git scoping, ecosystem detection, route mapping, and risk acceptance.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import type {
  ReadinessCategory,
  CategoryMeta,
  CheckMode,
  EnforcementLevel,
  CategoryStatus,
} from "./taxonomy.js";
import {
  getCategoryMeta,
  MANDATORY_CATEGORIES,
  getAllCategories,
} from "./taxonomy.js";
import type { BiltCheckFinding } from "./finding.js";
import type { GateResult } from "./readiness-gate.js";
import { evaluateGate } from "./readiness-gate.js";
import { detectEcosystem } from "../ecosystem/detector.js";
import { extractRouteMap, hasRouteExtractor } from "./route-map.js";
import { loadAcceptedRisks } from "./risk-acceptance.js";
import { getGitScope, isFindingIntroducedByChange } from "../scoping/git-scope.js";
import { MAX_FILE_SIZE } from "./cache.js";

// Checkers
import { secretsAndEnvChecker } from "./checks/secrets-and-env.js";
import { authChecker } from "./checks/auth.js";
import { authorizationChecker } from "./checks/authorization.js";
import { inputValidationChecker } from "./checks/input-validation.js";
import { apiAbuseAndCostChecker } from "./checks/api-abuse-and-cost.js";
import { databaseChecker } from "./checks/database.js";
import { dependenciesChecker } from "./checks/dependencies.js";
import { errorHandlingLogsChecker } from "./checks/error-handling-logs.js";
import { transportAndHeadersChecker } from "./checks/transport-and-headers.js";
import { deployConfigChecker } from "./checks/deploy-config.js";
import { fileUploadsChecker } from "./checks/file-uploads.js";
import { paymentsChecker } from "./checks/payments.js";
import { privacyAndPiiChecker } from "./checks/privacy-and-pii.js";
import { monitoringRollbackChecker } from "./checks/monitoring-rollback.js";

export interface CheckRunnerOptions {
  dir: string;
  changed?: boolean;
  base?: string;
  format?: "human" | "agent";
  categories?: ReadinessCategory[];
}

export interface CheckResult {
  gate: GateResult;
  findings: BiltCheckFinding[];
  categoryResults: Map<ReadinessCategory, CategoryCheckResult>;
  routeMap: RouteMapEntry[];
  unsupportedStackCategories: ReadinessCategory[];
  duration: number;
}

export interface CategoryCheckResult {
  category: ReadinessCategory;
  status: CategoryStatus;
  findings: BiltCheckFinding[];
  mode: CheckMode;
  enforcement: EnforcementLevel;
  unsupportedStack?: boolean;
}

export interface RouteMapEntry {
  method: string;
  path: string;
  file: string;
  line: number;
  resourceIdParam?: string;
}

export interface CategoryChecker {
  category: ReadinessCategory;
  mode: CheckMode;
  run(context: CheckContext): Promise<BiltCheckFinding[]>;
}

export interface CheckContext {
  rootDir: string;
  files: Array<{ path: string; content: string }>;
  routeMap: RouteMapEntry[];
  ecosystem: any;
  changedFiles?: string[];
}

// Registry containing all 14 checkers
const CHECKERS: CategoryChecker[] = [
  secretsAndEnvChecker,
  authChecker,
  authorizationChecker,
  inputValidationChecker,
  apiAbuseAndCostChecker,
  databaseChecker,
  dependenciesChecker,
  errorHandlingLogsChecker,
  transportAndHeadersChecker,
  deployConfigChecker,
  fileUploadsChecker,
  paymentsChecker,
  privacyAndPiiChecker,
  monitoringRollbackChecker,
];

export async function runChecks(options: CheckRunnerOptions): Promise<CheckResult> {
  const startTime = Date.now();
  const rootDir = path.resolve(options.dir);

  // 1. Detect Ecosystem
  const ecosystem = await detectEcosystem(rootDir);
  const primaryFw = ecosystem.primaryFramework?.id || "unknown";
  const routeExtractionSupported = hasRouteExtractor(primaryFw);

  // 2. Load Git Scope if requested
  const gitScope = await getGitScope(rootDir, {
    changed: options.changed,
    base: options.base,
  });

  // 3. Load Project Files (matching ignore rules and size limit)
  const filePaths = await fg(
    [
      "**/*.ts",
      "**/*.js",
      "**/*.tsx",
      "**/*.jsx",
      "**/*.mjs",
      "**/*.cjs",
      "**/*.json",
      "**/*.yml",
      "**/*.yaml",
      "**/.env*",
      "**/Dockerfile*",
      "**/docker-compose*",
    ],
    {
      cwd: rootDir,
      ignore: [
        "node_modules/**",
        "dist/**",
        "build/**",
        ".git/**",
        "coverage/**",
        ".next/**",
        ".nuxt/**",
        ".cache/**",
        "tests/**",
        "test/**",
        "**/fixtures/**",
      ],
      absolute: true,
      dot: true,
    },
  );

  const files: Array<{ path: string; content: string }> = [];
  for (const fPath of filePaths) {
    try {
      const stat = await fs.stat(fPath);
      if (stat.size > MAX_FILE_SIZE) {
        continue;
      }
      const relPath = path.relative(rootDir, fPath).replace(/\\/g, "/");
      const content = await fs.readFile(fPath, "utf-8");
      files.push({ path: relPath, content });
    } catch {
      // Skip unreadable files
    }
  }

  // 4. Extract Route Map
  const routeMap = await extractRouteMap(rootDir, files);

  const context: CheckContext = {
    rootDir,
    files,
    routeMap,
    ecosystem,
    changedFiles: gitScope ? Array.from(gitScope.changedFiles) : undefined,
  };

  // 5. Load Accepted Risks
  const acceptedRisks = await loadAcceptedRisks(rootDir);
  const acceptedRiskIds = acceptedRisks.map((r) => r.findingId);

  const allFindings: BiltCheckFinding[] = [];
  const categoryResults = new Map<ReadinessCategory, CategoryCheckResult>();
  const unsupportedStackCategories: ReadinessCategory[] = [];

  const targetCategories = options.categories || getAllCategories();

  // 6. Run Checkers across categories
  for (const category of targetCategories) {
    const meta = getCategoryMeta(category);
    if (!meta) continue;

    const checker = CHECKERS.find((c) => c.category === category);
    let categoryFindings: BiltCheckFinding[] = [];

    // Stack Scoping (Section 4B):
    // If authorization check requires route extraction and framework is unsupported:
    const isStackUnsupportedForRouteExtraction =
      (category === "authorization" || category === "api-abuse-and-cost") &&
      ecosystem.allDetected.length > 0 &&
      !routeExtractionSupported &&
      routeMap.length === 0;

    if (isStackUnsupportedForRouteExtraction) {
      unsupportedStackCategories.push(category);
      categoryFindings.push({
        ruleId: `UNSUPPORTED-STACK-${category.toUpperCase()}`,
        category,
        mode: "guided",
        severity: "medium",
        precision: "low",
        maturity: "stable",
        status: "needs-review",
        title: `${meta.name}: Unsupported Stack (Route Completeness Unverifiable)`,
        whyItMatters:
          `Automated route mapping is not currently available for ${primaryFw}. ` +
          "Completeness of authorization and abuse protection cannot be verified automatically.",
        technicalDetail:
          `Detected framework: ${primaryFw}. Manual guided review is required for all routes.`,
        agentAction:
          "Manually enumerate all API endpoints and verify server-side authorization and rate limiting.",
        fixable: false,
        fingerprint: `unsupported-stack-${category}`,
      });
    } else if (checker) {
      try {
        categoryFindings = await checker.run(context);
      } catch (err: any) {
        // Safe check error boundary
      }
    }

    // Git Scoping filter
    if (gitScope) {
      categoryFindings = categoryFindings.filter((f) => {
        // Keep global or repository-wide findings
        if (!f.file) return true;
        const introduced = isFindingIntroducedByChange(
          f.file,
          f.line || 1,
          gitScope,
        );
        f.introduced_by_change = introduced;
        return introduced;
      });
    }

    allFindings.push(...categoryFindings);

    // Determine category status
    let status: CategoryStatus = "pass";
    if (isStackUnsupportedForRouteExtraction) {
      status = "unsupported-stack";
    } else if (
      categoryFindings.some(
        (f) =>
          f.status === "fail" &&
          (f.severity === "critical" || f.severity === "high"),
      )
    ) {
      status = "fail";
    } else if (categoryFindings.some((f) => f.status === "needs-review")) {
      status = "needs-review";
    }

    categoryResults.set(category, {
      category,
      status,
      findings: categoryFindings,
      mode: meta.mode,
      enforcement: meta.enforcement,
      unsupportedStack: isStackUnsupportedForRouteExtraction,
    });
  }

  // 7. Evaluate Production Readiness Gate
  const gate = evaluateGate(allFindings, acceptedRiskIds, MANDATORY_CATEGORIES);

  const duration = Date.now() - startTime;

  return {
    gate,
    findings: allFindings,
    categoryResults,
    routeMap,
    unsupportedStackCategories,
    duration,
  };
}
