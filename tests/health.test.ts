import { describe, it, expect } from 'vitest';
import { calculateHealthScore } from '../src/core/score/health.js';
import type { ScanFinding } from '../src/types/index.js';

describe('calculateHealthScore', () => {
  it('should return a score of 100 and A+ for no findings', () => {
    const { score, grade } = calculateHealthScore([]);
    expect(score).toBe(100);
    expect(grade).toBe('A+');
  });

  it('should subtract 15 points for critical findings', () => {
    const findings: ScanFinding[] = [
      {
        id: '1',
        severity: 'critical',
        category: 'secret-detected',
        message: 'Leak found',
        file: 'config.js',
      },
    ];
    const { score, grade } = calculateHealthScore(findings);
    expect(score).toBe(85);
    expect(grade).toBe('B');
  });

  it('should subtract 5 points for warning findings', () => {
    const findings: ScanFinding[] = [
      {
        id: '1',
        severity: 'warning',
        category: 'env-missing',
        message: 'Var missing',
        file: 'config.js',
      },
    ];
    const { score, grade } = calculateHealthScore(findings);
    expect(score).toBe(95);
    expect(grade).toBe('A');
  });

  it('should subtract 1 point for info findings', () => {
    const findings: ScanFinding[] = [
      {
        id: '1',
        severity: 'info',
        category: 'env-unused',
        message: 'Var unused',
        file: 'config.js',
      },
    ];
    const { score, grade } = calculateHealthScore(findings);
    expect(score).toBe(99);
    expect(grade).toBe('A+');
  });

  it('should floor the score at 0', () => {
    const findings: ScanFinding[] = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      severity: 'critical',
      category: 'secret-detected',
      message: `Leak ${i}`,
      file: 'config.js',
    }));
    const { score, grade } = calculateHealthScore(findings);
    expect(score).toBe(0);
    expect(grade).toBe('F');
  });

  it('should map scores to correct letter grades', () => {
    const checkGrade = (score: number) => {
      // Mock findings to get the exact target score
      // Score = 100 - (criticals * 15) - (warnings * 5) - (infos * 1)
      const findings: ScanFinding[] = [];
      let current = 100;
      while (current > score) {
        const diff = current - score;
        if (diff >= 15) {
          findings.push({ id: '', severity: 'critical', category: 'secret-detected', message: '', file: '' });
          current -= 15;
        } else if (diff >= 5) {
          findings.push({ id: '', severity: 'warning', category: 'env-missing', message: '', file: '' });
          current -= 5;
        } else {
          findings.push({ id: '', severity: 'info', category: 'env-unused', message: '', file: '' });
          current -= 1;
        }
      }
      return calculateHealthScore(findings).grade;
    };

    expect(checkGrade(100)).toBe('A+');
    expect(checkGrade(95)).toBe('A');
    expect(checkGrade(91)).toBe('A-');
    expect(checkGrade(88)).toBe('B+');
    expect(checkGrade(85)).toBe('B');
    expect(checkGrade(81)).toBe('B-');
    expect(checkGrade(78)).toBe('C+');
    expect(checkGrade(75)).toBe('C');
    expect(checkGrade(71)).toBe('C-');
    expect(checkGrade(65)).toBe('D');
    expect(checkGrade(50)).toBe('F');
  });
});
