// ─── AI Redaction Engine ──────────────────────────────────────────────────────
// Strictly redacts code findings before sending to external AI providers.
// Ensures secret values, full file contents, and PII are never transmitted.

import type { ScanFinding } from "../../types/index.js";
import type { RedactedContext, RedactedFindingContext } from "./types.js";
import { saveLastRequestPayload } from "./config.js";

const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  authorComment: /@author\s+[^\r\n()]+|\b(Author|Developer|Owner|Maintainer):\s*[^\r\n()]+/gi,
  ipAddress: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
  phoneNumber: /\b\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g,
};

/**
 * Extract variable name if present in message or code line (e.g., CONST_NAME = "...")
 */
function extractVarName(text?: string): string | undefined {
  if (!text) return undefined;
  const match = text.match(/\b([A-Z0-9_]{3,})\b\s*[:=]/);
  return match ? match[1] : undefined;
}

/**
 * Sanitize snippet: slice to line ± 1, replace secret values and PII
 */
function sanitizeSnippet(
  snippet?: string,
  rawSecret?: string,
  previewSecret?: string,
): string | undefined {
  if (!snippet) return undefined;

  // Split lines and restrict window to max 3 lines (line ± 1)
  const lines = snippet.split(/\r?\n/).filter((l) => l.trim() !== "");
  const windowed = lines.slice(0, 3).join("\n");

  let sanitized = windowed;

  // Replace exact secret strings
  if (rawSecret && rawSecret.trim().length > 0) {
    sanitized = sanitized.split(rawSecret).join("[SECRET_VALUE_REDACTED]");
  }
  if (previewSecret && previewSecret.trim().length > 0 && !previewSecret.includes("...")) {
    sanitized = sanitized.split(previewSecret).join("[SECRET_VALUE_REDACTED]");
  }

  // Strip PII (email first, then author, IP, phone)
  sanitized = sanitized
    .replace(PII_PATTERNS.email, "[EMAIL_REDACTED]")
    .replace(PII_PATTERNS.authorComment, "[NAME_REDACTED]")
    .replace(PII_PATTERNS.ipAddress, "[IP_REDACTED]")
    .replace(PII_PATTERNS.phoneNumber, "[PHONE_REDACTED]");

  return sanitized;
}

export interface RedactOptions {
  findings: ScanFinding[];
  framework?: string;
  projectName?: string;
}

/**
 * Redact scan findings context for AI prompt submission.
 * GUARANTEE: Never outputs raw secret values, full file contents, or un-redacted PII.
 */
export function redactForAI(options: RedactOptions): RedactedContext {
  const redactedFindings: RedactedFindingContext[] = options.findings.map((f) => {
    const varName = extractVarName(f.message) || extractVarName(f.suggestion);

    // Classification metadata only — no raw secret value
    const classification = {
      type: f.ruleId || f.provider?.name || f.category,
      context: f.category.includes("secret")
        ? "hardcoded literal"
        : f.category.includes("env")
          ? "environment configuration"
          : "configuration issue",
      surroundingVarName: varName,
    };

    // Sanitize snippet if present
    const snippet = sanitizeSnippet(f.suggestion || f.message, f.secret, f.preview);

    return {
      id: f.id,
      category: f.category,
      severity: f.severity,
      file: f.file,
      line: f.line,
      providerType: f.provider?.name,
      ruleId: f.ruleId,
      classification,
      snippet,
    };
  });

  const redactedContext: RedactedContext = {
    projectName: options.projectName || "local-project",
    framework: options.framework,
    findings: redactedFindings,
  };

  // Log payload locally for user auditing (`bilt ai last-request --debug`)
  saveLastRequestPayload(redactedContext);

  return redactedContext;
}
