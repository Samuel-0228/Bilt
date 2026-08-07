import type { Severity } from "../../types/index.js";

export type RuleCategory =
  | "authentication"
  | "authorization"
  | "secrets"
  | "configuration"
  | "business-logic"
  | "ai-integrations"
  | "networking"
  | "storage"
  | "filesystem"
  | "cryptography"
  | "dependencies"
  | "api-design"
  | "frontend-security"
  | "server-security"
  | "supply-chain";

export type RuleConfidence = "high" | "medium" | "low";

export interface EvidenceLocation {
  file: string;
  line: number;
  column?: number;
  snippet: string;
  symbol?: string;
}

export interface SecurityFindingDetails {
  ruleId: string;
  category: RuleCategory;
  severity: Severity;
  confidence: RuleConfidence;
  title: string;
  message: string;
  evidence: EvidenceLocation;
  affectedFiles: string[];
  affectedLines: number[];
  whyThisIsDangerous: string;
  howAttackersAbuseIt: string;
  suggestedFix: string;
  automaticFixAvailability: {
    available: boolean;
    fixId?: string;
    description?: string;
  };
  documentation: {
    docsUrl?: string;
    cwe?: string;
    owasp?: string;
    references?: string[];
  };
  owaspMapping: string;
  framework?: string;
  provider?: string;
}

export interface ASTContext {
  filePath: string;
  fileContent: string;
  isFrontend: boolean;
  isBackend: boolean;
  isConfigFile: boolean;
  isTestFile: boolean;
  isDocFile: boolean;
  frameworksDetected: string[];
  imports: Array<{
    source: string;
    specifiers: string[];
    isDefault: boolean;
    line: number;
  }>;
}

export interface SafeAutoFixResult {
  modifiedContent: string;
  description: string;
}

export type SafeAutoFixFn = (
  fileContent: string,
  finding: SecurityFindingDetails,
  astContext: ASTContext
) => SafeAutoFixResult | null;

export interface SecurityRuleTestCase {
  name: string;
  code: string;
  filePath?: string;
  shouldMatch: boolean;
  expectedLine?: number;
}

export interface SecurityRule {
  id: string;
  category: RuleCategory;
  severity: Severity;
  title: string;
  frameworks: string[]; // e.g. ["nextjs", "express", "react", "all"]
  provider: string; // e.g. "supabase", "firebase", "openai", "aws", "none", "all"
  description: string;
  whyThisIsDangerous: string;
  howAttackersAbuseIt: string;
  suggestedFix: string;
  owaspMapping: string;
  cwe?: string;
  docsUrl?: string;
  references?: string[];
  
  /** Matcher logic executed on AST / Context */
  match: (astContext: ASTContext) => SecurityFindingDetails[];
  
  /** Safe automatic fix if available */
  safeAutoFix?: SafeAutoFixFn;
  
  /** Test cases for independent rule verification */
  testCases: SecurityRuleTestCase[];
}

export interface FrameworkKnowledge {
  id: string;
  displayName: string;
  safePatterns: string[];
  unsafePatterns: string[];
  recommendedPatterns: string[];
  knownMistakes: string[];
  clientExposedEnvPrefixes: string[];
}

export interface ProviderKnowledgeItem {
  id: string;
  displayName: string;
  safeKeys: string[];
  unsafeKeys: string[];
  rotationUrl?: string;
  docsUrl?: string;
}
