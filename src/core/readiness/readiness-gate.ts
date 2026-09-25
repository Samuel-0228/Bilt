import type { ReadinessCategory, CategoryStatus } from './taxonomy.js';
import type { BiltCheckFinding } from './finding.js';

export type GateStatus = 'production-ready' | 'not-ready' | 'not-ready-needs-review';

export interface GateResult {
  status: GateStatus;
  summary: {
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    needsReview: number;
    acceptedRisk: number;
  };
  categorySummary: Record<ReadinessCategory, CategoryStatus>;
  blockingFindings: BiltCheckFinding[];
  reviewFindings: BiltCheckFinding[];
  passedCategories: ReadinessCategory[];
  mandatoryCategoriesMet: boolean;
}

export function evaluateGate(
  findings: BiltCheckFinding[],
  acceptedRiskIds: string[],
  mandatoryCategories: ReadinessCategory[]
): GateResult {
  const summary = {
    totalFindings: findings.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    needsReview: 0,
    acceptedRisk: 0,
  };

  const blockingFindings: BiltCheckFinding[] = [];
  const reviewFindings: BiltCheckFinding[] = [];
  const categoryStatusMap: Record<ReadinessCategory, CategoryStatus> = {} as any;
  for (const cat of mandatoryCategories) {
    categoryStatusMap[cat] = 'pass';
  }
  
  // Track findings per category to determine category status
  const findingsByCategory = new Map<ReadinessCategory, BiltCheckFinding[]>();

  for (const finding of findings) {
    if (!findingsByCategory.has(finding.category)) {
      findingsByCategory.set(finding.category, []);
    }
    findingsByCategory.get(finding.category)!.push(finding);

    const isAccepted = acceptedRiskIds.includes(finding.fingerprint) || acceptedRiskIds.includes(finding.ruleId);
    const isMandatory = mandatoryCategories.includes(finding.category);

    // Accepted risk bypassing gate applies only if it's not a mandatory category
    if (isAccepted && !isMandatory) {
      summary.acceptedRisk++;
      continue;
    }

    if (finding.status === 'needs-review') {
      summary.needsReview++;
      reviewFindings.push(finding);
    } else {
      if (finding.severity === 'critical') summary.critical++;
      else if (finding.severity === 'high') summary.high++;
      else if (finding.severity === 'medium') summary.medium++;
      else if (finding.severity === 'low') summary.low++;
      else if (finding.severity === 'info') summary.info++;

      if (finding.status === 'fail' && (finding.severity === 'critical' || finding.severity === 'high')) {
        blockingFindings.push(finding);
      }
    }
  }

  // Determine category status
  for (const [category, catFindings] of findingsByCategory.entries()) {
    const isMandatory = mandatoryCategories.includes(category);
    let catStatus: CategoryStatus = 'pass';

    for (const f of catFindings) {
      const isAccepted = acceptedRiskIds.includes(f.fingerprint) || acceptedRiskIds.includes(f.ruleId);
      if (isAccepted && !isMandatory) continue;
      
      if (f.status === 'needs-review') {
        catStatus = 'needs-review';
      } else if (f.status === 'fail') {
        catStatus = 'fail';
        break; // Fail overrides needs-review
      }
    }
    categoryStatusMap[category] = catStatus;
  }

  const passedCategories: ReadinessCategory[] = [];
  for (const cat in categoryStatusMap) {
    if (categoryStatusMap[cat as ReadinessCategory] === 'pass') {
      passedCategories.push(cat as ReadinessCategory);
    }
  }

  // Check mandatory categories
  let mandatoryCategoriesMet = true;
  for (const cat of mandatoryCategories) {
    if (!categoryStatusMap[cat] || categoryStatusMap[cat] !== 'pass') {
      mandatoryCategoriesMet = false;
      break;
    }
  }

  let status: GateStatus = 'production-ready';

  if (blockingFindings.length > 0 || (summary.critical > 0 || summary.high > 0)) {
    status = 'not-ready';
  } else if (!mandatoryCategoriesMet || reviewFindings.length > 0) {
    status = 'not-ready-needs-review';
  }

  return {
    status,
    summary,
    categorySummary: categoryStatusMap as Record<ReadinessCategory, CategoryStatus>,
    blockingFindings,
    reviewFindings,
    passedCategories,
    mandatoryCategoriesMet,
  };
}
