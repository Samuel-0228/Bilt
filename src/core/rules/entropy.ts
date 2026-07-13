// ─── Shannon Entropy Utilities ───────────────────────────────────────────────
//
// Pure functions for calculating Shannon entropy of string values.
// Used by secret-detection rules to flag high-entropy values that are
// likely API keys, tokens, or passwords even when no regex rule matches.
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum value length considered for entropy analysis. */
const MIN_LENGTH = 8;

/**
 * UUID v4 pattern — values that match are skipped because UUIDs are
 * high-entropy by design but are almost never secrets.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Common English / config words that happen to be long-ish but are
 * obviously not secrets.  All comparisons are lower-cased.
 */
const COMMON_WORDS = new Set([
  'development',
  'production',
  'staging',
  'localhost',
  'undefined',
  'password',
  'username',
  'database',
  'hostname',
  'application',
  'configuration',
  'environment',
  'true',
  'false',
  'null',
  'enabled',
  'disabled',
  'default',
  'example',
  'changeme',
  'change_me',
  'your-api-key',
  'your-api-key-here',
  'your_api_key',
  'your_api_key_here',
  'replace_me',
  'replaceme',
  'placeholder',
  'test1234',
  'testtest',
  'abcdefgh',
  'xxxxxxxx',
  'todo',
  'fixme',
]);

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Calculate the Shannon entropy (in bits-per-character) of a string.
 *
 * Shannon entropy is defined as:
 *   H = -Σ p(x) · log₂(p(x))
 *
 * where p(x) is the frequency of character x in the string.
 *
 * Higher values indicate more randomness — typical English prose scores
 * around 3.5–4.0 while random hex/base64 strings score 4.5–6.0+.
 */
export function calculateShannonEntropy(value: string): number {
  if (value.length === 0) return 0;

  // Build frequency map
  const freq = new Map<string, number>();
  for (const ch of value) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }

  const len = value.length;
  let entropy = 0;

  for (const count of freq.values()) {
    const p = count / len;
    // p is always > 0 here, so log₂ is safe
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/**
 * Determine whether a value is "high entropy" — i.e. random enough to
 * plausibly be a secret key / token.
 *
 * Before running the entropy check the function applies several
 * heuristics to avoid false positives:
 *
 * 1. Values shorter than 8 characters are skipped (too short to be a key).
 * 2. Pure UUID strings are skipped (high-entropy but not secret).
 * 3. Values that match common configuration words are skipped.
 *
 * @param value     The raw string value to analyse.
 * @param threshold Minimum entropy (bits-per-char) to be considered
 *                  "high". Defaults to **4.5**.
 */
export function isHighEntropy(value: string, threshold = 4.5): boolean {
  // ── fast-exit filters ──────────────────────────────────────────────
  if (value.length < MIN_LENGTH) return false;
  if (UUID_RE.test(value)) return false;
  if (COMMON_WORDS.has(value.toLowerCase())) return false;

  // Skip values that are all the same character (e.g. "xxxxxxxx")
  if (new Set(value).size === 1) return false;

  // Skip values that look like repeated short patterns (e.g. "abababab")
  if (value.length >= 8) {
    const half = value.slice(0, Math.floor(value.length / 2));
    if (value === half + half) return false;
  }

  return calculateShannonEntropy(value) >= threshold;
}
