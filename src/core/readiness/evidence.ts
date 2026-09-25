// ─── Evidence ───
export interface GuidedEvidence {
  ruleId: string;
  route?: string;
  method?: string;
  authorization_required?: boolean;
  owner_check_present?: boolean;
  evidence_location?: string; // file:line format
  notes?: string;
  verified_by?: string; // 'agent' | 'human' | agent name
  timestamp?: string; // ISO 8601
}

export interface AuthzEvidence extends GuidedEvidence {
  route: string;
  method: string;
  authorization_required: boolean;
  owner_check_present: boolean;
  evidence_location: string;
}

export interface ApiAbuseEvidence extends GuidedEvidence {
  route: string;
  method: string;
  authentication_required: boolean;
  rate_limited: boolean;
  size_limited: boolean;
  cost_controlled: boolean;
  evidence_location: string;
}

export interface PaymentEvidence extends GuidedEvidence {
  processor: string;
  webhook_verified: boolean;
  server_side_verification: boolean;
  raw_card_data: boolean;
  evidence_location: string;
}

export interface FileUploadEvidence extends GuidedEvidence {
  upload_endpoint: string;
  type_validation: boolean;
  size_limit: boolean;
  path_traversal_safe: boolean;
  storage_isolated: boolean;
  evidence_location: string;
}

export interface PrivacyEvidence extends GuidedEvidence {
  data_collected: string[];
  necessary: boolean;
  storage_location: string;
  retention_policy: boolean;
  deletion_mechanism: boolean;
  evidence_location: string;
}

export interface MonitoringEvidence extends GuidedEvidence {
  error_monitoring: boolean;
  deployment_observability: boolean;
  rollback_capability: boolean;
  recovery_procedure: boolean;
  evidence_location: string;
}

export function validateEvidence(evidence: unknown, ruleId: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!evidence || typeof evidence !== 'object') {
    return { valid: false, errors: ['Evidence must be an object'] };
  }
  const e = evidence as Record<string, unknown>;
  
  if (e.ruleId !== ruleId) {
    errors.push('ruleId does not match');
  }
  
  if (e.evidence_location && (typeof e.evidence_location !== 'string' || !e.evidence_location.includes(':'))) {
    errors.push('evidence_location must be a valid file:line format');
  }

  return { valid: errors.length === 0, errors };
}
