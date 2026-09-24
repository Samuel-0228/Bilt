import crypto from "node:crypto";

export interface FingerprintInput {
  ruleId: string;
  file: string;
  symbol?: string;
  snippet?: string;
  lineContent?: string;
}

/**
 * Normalizes surrounding code snippet or anchor to survive indentation changes,
 * line shifts, and minor formatting edits.
 */
export function normalizeCodeAnchor(raw?: string): string {
  if (!raw) return "";

  return raw
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "") // strip comments
    .replace(/\s+/g, " ") // collapse multiple whitespaces
    .trim();
}

/**
 * Compute a stable fingerprint for a finding.
 * Hash components:
 * 1. rule_id
 * 2. normalized relative file path (forward slashes, lowercase on Windows)
 * 3. normalized symbol or surrounding code anchor
 */
export function computeFingerprint(input: FingerprintInput): string {
  const normRule = input.ruleId.trim().toUpperCase();
  const normFile = input.file.replace(/\\/g, "/").replace(/^\.\//, "").trim();

  let normAnchor = "";
  if (input.symbol && input.symbol.trim().length > 0) {
    normAnchor = `symbol:${input.symbol.trim()}`;
  } else if (input.snippet && input.snippet.trim().length > 0) {
    normAnchor = `snippet:${normalizeCodeAnchor(input.snippet)}`;
  } else if (input.lineContent && input.lineContent.trim().length > 0) {
    normAnchor = `line:${normalizeCodeAnchor(input.lineContent)}`;
  }

  const payload = `${normRule}|${normFile}|${normAnchor}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}
