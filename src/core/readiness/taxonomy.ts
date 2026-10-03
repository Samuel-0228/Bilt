// ─── Taxonomy ───

export type ReadinessCategory = 
  | 'secrets-and-env'
  | 'auth'
  | 'authorization'
  | 'input-validation'
  | 'api-abuse-and-cost'
  | 'database'
  | 'dependencies'
  | 'error-handling-logs'
  | 'transport-and-headers'
  | 'deploy-config'
  | 'file-uploads'
  | 'payments'
  | 'privacy-and-pii'
  | 'monitoring-rollback'
  | 'design-quality';

export type CheckMode = 'automated' | 'guided';

export type EnforcementLevel = 'enforced' | 'guided' | 'partial' | 'coming-soon';

export type CategoryStatus = 'pass' | 'fail' | 'needs-review' | 'unsupported-stack';

export interface CategoryMeta {
  id: ReadinessCategory;
  name: string; // human-friendly name
  mode: CheckMode;
  enforcement: EnforcementLevel;
  mandatory: boolean; // true for the 6 mandatory categories
  description: string;
}

// The 6 mandatory categories that cannot use risk-acceptance to bypass gate
export const MANDATORY_CATEGORIES: ReadinessCategory[] = [
  'secrets-and-env', 'auth', 'authorization',
  'input-validation', 'api-abuse-and-cost', 'database'
];

export const TAXONOMY: CategoryMeta[] = [
  {
    id: 'secrets-and-env',
    name: 'Secrets & Environment',
    mode: 'automated',
    enforcement: 'enforced',
    mandatory: true,
    description: 'Verify hardcoded secrets and environment variable safety'
  },
  {
    id: 'auth',
    name: 'Authentication',
    mode: 'guided',
    enforcement: 'guided',
    mandatory: true,
    description: 'Ensure proper authentication controls'
  },
  {
    id: 'authorization',
    name: 'Authorization',
    mode: 'guided',
    enforcement: 'guided',
    mandatory: true,
    description: 'Ensure proper authorization controls'
  },
  {
    id: 'input-validation',
    name: 'Input Validation',
    mode: 'automated',
    enforcement: 'enforced',
    mandatory: true,
    description: 'Validate all inputs to prevent injection and other attacks'
  },
  {
    id: 'api-abuse-and-cost',
    name: 'API Abuse & Cost',
    mode: 'automated',
    enforcement: 'enforced',
    mandatory: true,
    description: 'Rate limiting and abuse prevention'
  },
  {
    id: 'database',
    name: 'Database',
    mode: 'automated',
    enforcement: 'enforced',
    mandatory: true,
    description: 'Secure database access and injection prevention'
  },
  {
    id: 'dependencies',
    name: 'Dependencies',
    mode: 'automated',
    enforcement: 'enforced',
    mandatory: false,
    description: 'Check for known vulnerable dependencies'
  },
  {
    id: 'error-handling-logs',
    name: 'Error Handling & Logs',
    mode: 'automated',
    enforcement: 'enforced',
    mandatory: false,
    description: 'Prevent sensitive data leakage in logs and errors'
  },
  {
    id: 'transport-and-headers',
    name: 'Transport & Headers',
    mode: 'automated',
    enforcement: 'enforced',
    mandatory: false,
    description: 'Secure transport layers and HTTP headers'
  },
  {
    id: 'deploy-config',
    name: 'Deploy Config',
    mode: 'automated',
    enforcement: 'enforced',
    mandatory: false,
    description: 'Secure deployment and infrastructure configuration'
  },
  {
    id: 'file-uploads',
    name: 'File Uploads',
    mode: 'automated',
    enforcement: 'enforced',
    mandatory: false,
    description: 'Secure handling of file uploads'
  },
  {
    id: 'payments',
    name: 'Payments',
    mode: 'guided',
    enforcement: 'guided',
    mandatory: false,
    description: 'Secure processing of payments'
  },
  {
    id: 'privacy-and-pii',
    name: 'Privacy & PII',
    mode: 'guided',
    enforcement: 'guided',
    mandatory: false,
    description: 'Handling of privacy and PII data'
  },
  {
    id: 'monitoring-rollback',
    name: 'Monitoring & Rollback',
    mode: 'guided',
    enforcement: 'guided',
    mandatory: false,
    description: 'Ensure adequate monitoring and rollback capability'
  }
];

export const DESIGN_QUALITY_META: CategoryMeta = {
  id: 'design-quality',
  name: 'Design Quality & UX',
  mode: 'automated',
  enforcement: 'guided',
  mandatory: false,
  description: 'Detect generic AI-generated templates and verify production UX completeness'
};

export function getCategoryMeta(id: ReadinessCategory): CategoryMeta | undefined {
  if (id === 'design-quality') return DESIGN_QUALITY_META;
  return TAXONOMY.find(cat => cat.id === id);
}

export function getAllCategories(): ReadinessCategory[] {
  return TAXONOMY.map(cat => cat.id);
}

export function isMandatoryCategory(id: ReadinessCategory): boolean {
  return MANDATORY_CATEGORIES.includes(id);
}
