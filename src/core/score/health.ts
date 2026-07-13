// ─── Health Score Calculator ─────────────────────────────────────────────────
//
// Computes a 0-100 health score from scan findings, with a letter-grade
// and per-category breakdown.  Pure function — no side effects.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ScanFinding,
  FindingCategory,
  Severity,
} from "../../types/index.js";

// ─── Point Deductions ────────────────────────────────────────────────────────

const SEVERITY_COST: Record<Severity, number> = {
  critical: 15,
  warning: 5,
  info: 1,
};

// ─── Grade Thresholds ────────────────────────────────────────────────────────
// Ordered from highest to lowest so the first match wins.

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

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CategoryBreakdown {
  category: string;
  points: number;
  count: number;
}

export interface HealthReport {
  /** Numeric score from 0 (worst) to 100 (perfect). */
  score: number;
  /** Letter grade (A+ through F). */
  grade: string;
  /** Per-category breakdown showing point deductions and finding counts. */
  breakdown: CategoryBreakdown[];
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Calculate a health score from an array of `ScanFinding`s.
 *
 * Scoring:
 *   • Start at **100**.
 *   • Each `critical` finding: **−15 points**.
 *   • Each `warning` finding: **−5 points**.
 *   • Each `info` finding: **−1 point**.
 *   • Floor at **0** (score never goes negative).
 *
 * The `breakdown` array lists every finding category that contributed
 * to the score loss, sorted by point deduction (largest first).
 */
export function calculateHealthScore(findings: ScanFinding[]): HealthReport {
  // Accumulate deductions per category
  const categoryMap = new Map<
    FindingCategory,
    { points: number; count: number }
  >();

  for (const finding of findings) {
    const cost = SEVERITY_COST[finding.severity];
    const existing = categoryMap.get(finding.category);

    if (existing) {
      existing.points += cost;
      existing.count += 1;
    } else {
      categoryMap.set(finding.category, { points: cost, count: 1 });
    }
  }

  // Total deduction
  let totalDeduction = 0;
  for (const { points } of categoryMap.values()) {
    totalDeduction += points;
  }

  const score = Math.max(0, 100 - totalDeduction);

  // Determine grade
  const grade = GRADE_THRESHOLDS.find((t) => score >= t.min)?.grade ?? "F";

  // Build sorted breakdown
  const breakdown: CategoryBreakdown[] = [...categoryMap.entries()]
    .map(([category, data]) => ({
      category,
      points: data.points,
      count: data.count,
    }))
    .sort((a, b) => b.points - a.points);

  return { score, grade, breakdown };
}
