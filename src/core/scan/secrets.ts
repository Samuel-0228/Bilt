// ─── Secret Scanner ──────────────────────────────────────────────────────────
//
// Scans file content (and optionally git history) for leaked secrets by
// running every SecretRule regex and then cross-checking with entropy
// analysis.  Produces ScanFinding objects with masked previews, line
// numbers, and provider information.
// ─────────────────────────────────────────────────────────────────────────────

import { simpleGit } from "simple-git";
import { isHighEntropy } from "../rules/entropy.js";
import { detectProvider } from "../rules/providers.js";
import { SECRET_RULES } from "../rules/secret-rules.js";
import type { SecretRule, ScanFinding, BiltConfig } from "../../types/index.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

let findingCounter = 0;

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++findingCounter}`;
}

/**
 * Common placeholder / dummy values that should never be flagged as
 * actual secrets.
 */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^<.*>$/, // <YOUR_KEY>, <api-key>
  /^your[_-]?/i, // your-api-key-here, your_key
  /^xxx+$/i, // xxx, xxxx, etc.
  /^change[_-]?me$/i, // CHANGE_ME, changeme
  /^replace[_-]?me$/i, // REPLACE_ME, replaceme
  /^todo$/i, // TODO
  /^fixme$/i, // FIXME
  /^placeholder$/i, // placeholder
  /^example$/i, // example
  /^test$/i, // test
  /^none$/i, // none
  /^null$/i, // null
  /^undefined$/i, // undefined
  /^insert[_-]?/i, // insert-your-key, insert_key_here
  /^dummy/i, // dummy, dummy-key
  /^\*+$/, // ***, ******, etc.
  /^\.{3,}$/, // ..., ......
  /^_+$/, // ___, ______
  /^0+$/, // 000, 0000000
];

/**
 * Returns true if the value looks like a placeholder rather than a
 * real secret.
 */
function isPlaceholder(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;

  return PLACEHOLDER_PATTERNS.some((re) => re.test(trimmed));
}

/**
 * Mask a secret value for safe display: show first 4 and last 4 chars
 * with stars in between.  Very short values are fully masked.
 */
function maskValue(value: string): string {
  if (value.length <= 8) return "*".repeat(value.length);
  const start = value.slice(0, 4);
  const end = value.slice(-4);
  return `${start}${"*".repeat(Math.min(value.length - 8, 20))}${end}`;
}

/**
 * Get the 1-indexed line number within `content` for a given character
 * offset.
 */
function lineNumberAt(content: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Scan file content for secrets using the specified rules.
 *
 * Before reporting a match, the function filters out:
 *   1. Placeholder / dummy-value heuristics
 *   2. Entropy threshold (for the `generic-high-entropy` rule the
 *      captured group is used; for others the full match is checked)
 *
 * Each surviving match is turned into a `ScanFinding` with:
 *   • Line number within the file
 *   • Masked preview of the matched value
 *   • Provider info (if determinable)
 */
export function scanFileForSecrets(
  content: string,
  filePath: string,
  rulesOrConfig: SecretRule[] | BiltConfig = SECRET_RULES,
  entropyThreshold: number = 4.5,
): ScanFinding[] {
  let rules: SecretRule[];
  let threshold = entropyThreshold;

  if (Array.isArray(rulesOrConfig)) {
    rules = rulesOrConfig;
  } else if (rulesOrConfig && typeof rulesOrConfig === "object") {
    // It's a BiltConfig
    const config = rulesOrConfig;
    rules = [...SECRET_RULES, ...(config.customRules || [])];
    threshold = config.entropyThreshold ?? entropyThreshold;
  } else {
    rules = SECRET_RULES;
  }

  const findings: ScanFinding[] = [];

  // Split content into lines for ignore-comment checks
  const fileLines = content.split("\n");

  // Track matches we've already reported to avoid duplicates when
  // multiple rules match the same span.
  const seen = new Set<string>();

  for (const rule of rules) {
    // Reset the regex's lastIndex (rules use /g flag)
    rule.pattern.lastIndex = 0;

    let match: RegExpExecArray | null;

    while ((match = rule.pattern.exec(content)) !== null) {
      // For the generic high-entropy rule, prefer the captured group
      const matchedValue = match[1] ?? match[0];

      // De-duplicate by position + rule
      const dedupeKey = `${rule.id}:${match.index}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      // Skip placeholders
      if (isPlaceholder(matchedValue)) continue;

      // For the generic high-entropy rule, require high entropy
      if (rule.id === "generic-high-entropy") {
        if (!isHighEntropy(matchedValue, threshold)) continue;
      }

      // For the AWS secret key rule, require high entropy to avoid
      // false positives from 40-char strings in code.
      if (rule.id === "aws-secret-key") {
        if (!isHighEntropy(matchedValue, threshold)) continue;
      }

      const line = lineNumberAt(content, match.index);

      // Check for known public assignments (e.g. ANON_KEY, PUBLISHABLE_KEY)
      const matchedLine = fileLines[line - 1];
      if (matchedLine) {
        const isPublicAssignment =
          /^[a-z0-9_]*(anon_key|publishable_key|public_key|app_id)[a-z0-9_]*\s*=/i.test(
            matchedLine.trim(),
          );
        if (isPublicAssignment) continue;
      }

      // Check for inline ignore comments (e.g. gitleaks:allow or bilt:allow)
      const previousLine = line > 1 ? fileLines[line - 2] : undefined;
      const isAllowed =
        (matchedLine &&
          (matchedLine.includes("gitleaks:allow") ||
            matchedLine.includes("bilt:allow"))) ||
        (previousLine &&
          (previousLine.includes("gitleaks:allow") ||
            previousLine.includes("bilt:allow")));

      if (isAllowed) continue;
      const provider = detectProvider(matchedValue, rule.id) ?? undefined;

      findings.push({
        id: nextId("secret"),
        severity: rule.severity,
        category: "secret-detected",
        message:
          `${rule.name} detected` +
          (provider ? ` (${provider.displayName})` : ""),
        file: filePath,
        line,
        suggestion: provider
          ? `Rotate this key at ${provider.rotationUrl} and move the value to a .env file`
          : "Move this value to a .env file and add the file to .gitignore",
        provider,
        ruleId: rule.id,
        preview: maskValue(matchedValue),
      });
    }
  }

  return findings;
}

/**
 * Scan the recent git history for secrets that may have been committed.
 *
 * Uses `simple-git` to iterate over the last `depth` commits (default
 * 10), extract the diff for each, and run the same secret-scanning
 * logic used for file content.
 *
 * Findings include the commit SHA in their `file` field so the user
 * knows which commit to rewrite / clean.
 */
export async function scanGitHistory(
  repoPath: string,
  rules: SecretRule[],
  entropyThreshold: number,
  depth = 10,
): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = [];
  const git = simpleGit(repoPath);
  git.env({
    ...process.env,
    GIT_DIR: undefined,
    GIT_WORK_TREE: undefined,
  });

  // Verify we're in a git repo
  try {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) return findings;
  } catch {
    return findings;
  }

  // Get the last N commits
  let log;
  try {
    log = await git.log({ maxCount: depth });
  } catch {
    // Repository might have no commits yet
    return findings;
  }

  for (const commit of log.all) {
    let diff: string;
    try {
      // Get the full diff for this commit
      diff = await git.diff([`${commit.hash}~1`, commit.hash]);
    } catch {
      // First commit has no parent — diff against empty tree
      try {
        diff = await git.diff([
          "4b825dc642cb6eb9a060e54bf899d69f82ef7b21",
          commit.hash,
        ]);
      } catch {
        continue;
      }
    }

    // Extract only the added lines (lines starting with `+` in the diff,
    // excluding the `+++` file header).
    const addedLines = diff
      .split("\n")
      .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
      .map((line) => line.slice(1))
      .join("\n");

    if (addedLines.length === 0) continue;

    // Scan the added content
    const commitFindings = scanFileForSecrets(
      addedLines,
      `git:${commit.hash.slice(0, 8)}`,
      rules,
      entropyThreshold,
    );

    // Annotate findings with commit info
    for (const finding of commitFindings) {
      finding.message += ` (found in commit ${commit.hash.slice(0, 8)}: ${commit.message.slice(0, 60)})`;
      findings.push(finding);
    }
  }

  return findings;
}
