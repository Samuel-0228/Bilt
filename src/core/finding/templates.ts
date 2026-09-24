import type {
  RuleTemplate,
  FindingSeverity,
  PrecisionTier,
  Maturity,
} from "./types.js";

export const RULE_TEMPLATES: Record<string, RuleTemplate> = {
  // Secret rules
  "RULE-SEC-001": {
    rule_id: "RULE-SEC-001",
    title: "Hardcoded Secret or Credential Detected",
    explanation:
      "Hardcoded secrets in source files or git history can be extracted by anyone with repository read access. Committed credentials frequently lead to unauthorized API access and data breaches.",
    agent_action:
      "Remove the hardcoded secret immediately. Replace it with a secure environment variable reference and rotate the compromised credential at the provider.",
    severity: "critical",
    precision: "high",
    maturity: "stable",
    category: "secrets",
  },
  // Env exposure rules
  "RULE-ENV-001": {
    rule_id: "RULE-ENV-001",
    title: "Committed Environment File or Client-Exposed Secret",
    explanation:
      "Environment files (.env) or client-prefixed variables (e.g., NEXT_PUBLIC_, VITE_) containing sensitive secrets risk leakage to public version control or client browser bundles.",
    agent_action:
      "Add .env to .gitignore. Ensure secrets are kept on the server side and only non-sensitive public configuration is prefixed for frontend bundles.",
    severity: "critical",
    precision: "high",
    maturity: "stable",
    category: "environment",
  },
  // Auth middleware rules
  "RULE-AUTH-001": {
    rule_id: "RULE-AUTH-001",
    title: "Missing Authentication Middleware on Route Handler",
    explanation:
      "API route handlers that manipulate or return sensitive data without authentication middleware can be invoked by unauthenticated callers.",
    agent_action:
      "Attach the appropriate authentication middleware (e.g., requireAuth, verifyToken) to the route before processing request parameters.",
    severity: "critical",
    precision: "high",
    maturity: "stable",
    category: "authentication",
  },
  // Input validation rules
  "RULE-INPUT-001": {
    rule_id: "RULE-INPUT-001",
    title: "Missing Input Validation on Request Body",
    explanation:
      "Accepting unsanitized client payloads directly into database queries or business logic enables injection, mass assignment, and type confusion vulnerabilities.",
    agent_action:
      "Validate the request body using a strict schema library (such as Zod, Joi, or Yup) before accessing payload fields.",
    severity: "warning",
    precision: "high",
    maturity: "stable",
    category: "input-validation",
  },
  // Method restriction rules
  "RULE-HTTP-001": {
    rule_id: "RULE-HTTP-001",
    title: "Wildcard HTTP Method Matcher",
    explanation:
      "Using wildcard route handlers (such as app.all() or catch-all handlers) exposes endpoints to unexpected HTTP methods (TRACE, OPTIONS, etc.) that can bypass method-specific filters.",
    agent_action:
      "Replace catch-all or wildcard HTTP handlers with explicit method bindings (e.g. app.get(), app.post()).",
    severity: "warning",
    precision: "high",
    maturity: "stable",
    category: "api-design",
  },
  // IDOR / authz rules
  "RULE-IDOR-001": {
    rule_id: "RULE-IDOR-001",
    title: "Client-Controlled Privilege or Object Reference",
    explanation:
      "User role, permissions, or object identifiers appear to be accepted directly from client body or parameters without server-side verification.",
    agent_action:
      "Review access control logic. Verify that permissions and ownership are derived exclusively from the authenticated session context, not client parameters.",
    severity: "warning",
    precision: "medium",
    maturity: "experimental",
    category: "authorization",
  },
};

/**
 * Look up a rule template or generate a sanitized fallback template.
 * Guarantees that explanation and agent_action NEVER come from repo content.
 */
export function getRuleTemplate(
  ruleId: string,
  categoryHint?: string,
  severityHint?: FindingSeverity,
): RuleTemplate {
  const normId = ruleId.trim().toUpperCase();
  if (RULE_TEMPLATES[normId]) {
    return RULE_TEMPLATES[normId];
  }

  // Safe fallback template for existing security engine rules or ad-hoc IDs
  return {
    rule_id: normId,
    title: `Security Policy Violation (${normId})`,
    explanation: `The rule '${normId}' identified a code pattern that violates security guidelines for ${categoryHint || "general safety"}.`,
    agent_action: `Inspect the identified location and apply the recommended fix pattern according to repository standards.`,
    severity: severityHint || "warning",
    precision: "medium",
    maturity: "experimental",
    category: categoryHint || "security",
  };
}
