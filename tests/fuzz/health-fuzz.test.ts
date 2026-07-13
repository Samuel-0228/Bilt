import { describe, it, expect } from "vitest";
import { calculateHealthScore } from "../../src/core/score/health.js";
import type { ScanFinding, Severity } from "../../src/types/index.js";

describe("Health Scoring Fuzz Tests", () => {
  const severities: Severity[] = ["critical", "warning", "info"];
  const categories = [
    "secret-detected",
    "env-missing",
    "env-unused",
    "env-mismatch",
    "env-exposed",
    "gitignore-missing",
  ];

  function generateRandomFindings(count: number): ScanFinding[] {
    const findings: ScanFinding[] = [];
    for (let i = 0; i < count; i++) {
      findings.push({
        id: `fuzz-${i}`,
        severity: severities[Math.floor(Math.random() * severities.length)]!,
        category: categories[
          Math.floor(Math.random() * categories.length)
        ] as any,
        message: "Random finding message",
        file: "test.js",
      });
    }
    return findings;
  }

  it("should calculate valid score and grade for any finding array combinations", () => {
    const validGrades = new Set([
      "A+",
      "A",
      "A-",
      "B+",
      "B",
      "B-",
      "C+",
      "C",
      "C-",
      "D",
      "F",
    ]);

    for (let i = 0; i < 500; i++) {
      const count = Math.floor(Math.random() * 20); // 0 to 20 findings
      const findings = generateRandomFindings(count);
      const report = calculateHealthScore(findings);

      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
      expect(validGrades.has(report.grade)).toBe(true);
    }
  });
});
