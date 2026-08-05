// ─── Health Score Calculator ─────────────────────────────────────────────────
// Computes overall and domain-specific 0-100 health scores from scan findings.
// Pure function — no side effects.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ScanFinding,
  FindingCategory,
  Severity,
  DomainHealthScore,
  HealthDomain,
} from "../../types/index.js";

const SEVERITY_COST: Record<Severity, number> = {
  critical: 15,
  warning: 5,
  info: 1,
  passed: 0,
};

const GRADE_THRESHOLDS: Array<{ min: number; grade: string }> = [
  { min: 97, grade: "A+" },
  { min: 93, grade: "A" },
  { min: 90, grade: "A-" },
  { min: 87, grade: "B+" },
  { min: 83, grade: "B" },
  { min: 80, grade: "B-" },
  { min: 77, grade: "C+" },
  { min: 73, grade: "C" },
  { min: 70, grade: "C-" },
  { min: 60, grade: "D" },
  { min: 0, grade: "F" },
];

export interface CategoryBreakdown {
  category: string;
  points: number;
  count: number;
}

export interface HealthReport {
  score: number;
  domainScores: DomainHealthScore;
  grade: string;
  breakdown: CategoryBreakdown[];
}

export function getCategoryDomain(category: FindingCategory): HealthDomain {
  switch (category) {
    case "secret-detected":
    case "env-exposed":
    case "git-history-secret":
    case "dep-vulnerable":
      return "security";

    case "env-missing":
    case "env-unused":
    case "env-mismatch":
    case "framework-warning":
      return "environment";

    case "gitignore-missing":
    case "git-large-file":
    case "git-committed-env":
    case "git-hygiene":
      return "git";

    case "dep-duplicate":
    case "dep-unused":
    case "dep-outdated":
    case "dep-abandoned":
      return "dependencies";

    case "config-tsconfig":
    case "config-docker":
    case "config-ci":
    case "config-package":
      return "configuration";

    case "perf-image":
    case "perf-bundle":
    case "perf-import":
      return "performance";

    default:
      return "security";
  }
}

export function calculateHealthScore(findings: ScanFinding[]): HealthReport {
  const categoryMap = new Map<FindingCategory, { points: number; count: number }>();
  const domainDeductions: Record<HealthDomain, number> = {
    security: 0,
    environment: 0,
    git: 0,
    dependencies: 0,
    configuration: 0,
    performance: 0,
  };

  let totalDeduction = 0;

  for (const finding of findings) {
    const cost = SEVERITY_COST[finding.severity] || 0;
    totalDeduction += cost;

    const existing = categoryMap.get(finding.category);
    if (existing) {
      existing.points += cost;
      existing.count += 1;
    } else {
      categoryMap.set(finding.category, { points: cost, count: 1 });
    }

    const domain = getCategoryDomain(finding.category);
    domainDeductions[domain] += cost;
  }

  const domainScores: DomainHealthScore = {
    security: Math.max(0, 100 - domainDeductions.security),
    environment: Math.max(0, 100 - domainDeductions.environment),
    git: Math.max(0, 100 - domainDeductions.git),
    dependencies: Math.max(0, 100 - domainDeductions.dependencies),
    configuration: Math.max(0, 100 - domainDeductions.configuration),
    performance: Math.max(0, 100 - domainDeductions.performance),
  };

  const score = Math.max(0, 100 - totalDeduction);
  const grade = GRADE_THRESHOLDS.find((t) => score >= t.min)?.grade ?? "F";

  const breakdown: CategoryBreakdown[] = [...categoryMap.entries()]
    .map(([category, data]) => ({
      category,
      points: data.points,
      count: data.count,
    }))
    .sort((a, b) => b.points - a.points);

  return { score, domainScores, grade, breakdown };
}
