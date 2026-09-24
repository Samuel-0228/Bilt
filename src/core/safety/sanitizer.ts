// ─── Output Sanitizer & Anti-Prompt-Injection Engine ───────────────────────

// ANSI escape code matching pattern
const ANSI_REGEX =
  // eslint-disable-next-line no-control-regex
  /[\u001B\u009B][[()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g;

// Control characters (excluding \n and \t) + Unicode Bidi overrides
// eslint-disable-next-line no-control-regex
const DANGEROUS_CONTROL_REGEX =
  /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

/**
 * Remove all ANSI escape codes, terminal formatting, and malicious control characters.
 */
export function stripControlAndAnsiCharacters(input: string): string {
  if (!input) return "";

  return input
    .replace(ANSI_REGEX, "")
    .replace(DANGEROUS_CONTROL_REGEX, "")
    .replace(/\r\n/g, "\n");
}

/**
 * Sanitize a code snippet for inclusion in `untrusted_snippet`.
 * - Strips ANSI and control characters
 * - Normalizes whitespace
 * - Caps maximum length to prevent context flooding
 */
export function sanitizeSnippet(raw: string, maxLength: number = 300): string {
  if (!raw) return "";

  const cleaned = stripControlAndAnsiCharacters(raw).trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return cleaned.substring(0, maxLength) + " ... [truncated]";
}

/**
 * Redact a detected secret value into a safe prefix + length indicator.
 * Example: "ghp_1234567890abcdef" -> "ghp_*** [len 20]"
 */
export function redactSecret(
  secret: string,
  visiblePrefixLength: number = 4,
): string {
  if (!secret) return "";

  const trimmed = secret.trim();
  const len = trimmed.length;

  if (len <= visiblePrefixLength) {
    return `*** [len ${len}]`;
  }

  const prefix = trimmed.substring(0, visiblePrefixLength);
  return `${prefix}*** [len ${len}]`;
}

/**
 * Known secret patterns to universally redact in any user-facing or agent-facing string.
 */
const COMMON_SECRET_PATTERNS = [
  /ghp_[a-zA-Z0-9]{36}/g,
  /github_pat_[a-zA-Z0-9_]{82}/g,
  /AKIA[0-9A-Z]{16}/g,
  /AIza[0-9A-Za-z\\-_]{35}/g,
  /sk-(?:live|test|proj)-[a-zA-Z0-9]{20,}/g,
  /xox[baprs]-[0-9a-zA-Z]{10,}/g,
  /bearer\s+[a-zA-Z0-9_\-\.]{25,}/gi,
];

/**
 * Universally scrub any detected secret values from arbitrary strings (messages, previews).
 */
export function redactKnownSecrets(text: string): string {
  if (!text) return "";

  let result = text;
  for (const pattern of COMMON_SECRET_PATTERNS) {
    result = result.replace(pattern, (match) => redactSecret(match));
  }

  return result;
}
