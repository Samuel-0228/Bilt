// ─── Env Fix Utilities ───────────────────────────────────────────────────────
//
// Automated fixes for common .env-related findings:
//   • Generate a safe .env.example with secrets stripped
//   • Add missing entries to .gitignore
//   • Append stub entries for missing env vars
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import { isHighEntropy } from "../rules/entropy.js";
import type { ParsedEnvFile, SecretRule } from "../../types/index.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Check if a value matches any secret rule pattern.
 */
function matchesSecretRule(value: string, rules: SecretRule[]): boolean {
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(value)) return true;
  }
  return false;
}

/**
 * Determine if a value should be treated as a secret and therefore
 * stripped from the example file.
 */
function isSecretValue(
  value: string,
  rules: SecretRule[],
  entropyThreshold: number,
): boolean {
  if (!value || value.length === 0) return false;
  if (matchesSecretRule(value, rules)) return true;
  if (isHighEntropy(value, entropyThreshold)) return true;
  return false;
}

/**
 * Generate an appropriate placeholder based on the variable name.
 */
function placeholderFor(key: string): string {
  const lower = key.toLowerCase();

  if (lower.includes("url") || lower.includes("uri"))
    return "https://example.com";
  if (lower.includes("host")) return "localhost";
  if (lower.includes("port")) return "3000";
  if (lower.includes("email") || lower.includes("mail"))
    return "user@example.com";
  if (lower.includes("password") || lower.includes("passwd"))
    return "your-password-here";
  if (
    lower.includes("key") ||
    lower.includes("token") ||
    lower.includes("secret")
  )
    return "your-secret-here";
  if (lower.includes("database") || lower.includes("db"))
    return "your-database-here";
  if (lower.includes("region")) return "us-east-1";
  if (lower.includes("bucket")) return "your-bucket-name";
  if (lower.includes("name")) return "your-name-here";

  return "your-value-here";
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate an `.env.example` file from a parsed env file.
 *
 * Secret values are replaced with descriptive placeholders while
 * preserving the overall structure — comments, blank lines, ordering,
 * and non-secret values are kept intact.
 *
 * @param envFile           Parsed env file to use as the template.
 * @param rules             Secret rules for value classification.
 * @param entropyThreshold  Entropy threshold for detecting secrets.
 * @returns The generated `.env.example` content as a string.
 */
export function generateEnvExample(
  envFile: ParsedEnvFile,
  rules: SecretRule[],
  entropyThreshold: number,
): string {
  const outputLines: string[] = [];

  // Process each raw line to preserve structure
  for (const rawLine of envFile.rawLines) {
    const trimmed = rawLine.trim();

    // Preserve empty lines and comments as-is
    if (trimmed === "" || trimmed.startsWith("#")) {
      outputLines.push(rawLine);
      continue;
    }

    // Strip optional `export ` prefix for parsing
    const line = trimmed.startsWith("export ")
      ? trimmed.slice(7).trim()
      : trimmed;

    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) {
      // Not a key=value line — preserve as-is
      outputLines.push(rawLine);
      continue;
    }

    const key = line.slice(0, eqIdx).trim();
    const entry = envFile.entries.get(key);

    if (!entry) {
      // Key not in entries map (shouldn't happen) — preserve line
      outputLines.push(rawLine);
      continue;
    }

    // Determine leading whitespace / export prefix for reconstruction
    const prefix = trimmed.startsWith("export ") ? "export " : "";

    if (isSecretValue(entry.value, rules, entropyThreshold)) {
      // Replace the value with a placeholder
      const placeholder = placeholderFor(key);
      const comment = entry.comment ? ` # ${entry.comment}` : "";
      outputLines.push(`${prefix}${key}=${placeholder}${comment}`);
    } else {
      // Keep the original line
      outputLines.push(rawLine);
    }
  }

  return outputLines.join("\n");
}

/**
 * Add entries to a `.gitignore` file, skipping any that already exist.
 *
 * Reads the current content from disk, appends missing entries with a
 * header comment, and returns the new content string.
 *
 * **Does NOT write to disk** — the caller is responsible for writing
 * (this enables dry-run mode).
 *
 * @param entries       Patterns to add (e.g. `.env`, `.env.local`).
 * @param gitignorePath Absolute path to the `.gitignore` file.
 * @returns The updated `.gitignore` content.
 */
export async function addToGitignore(
  entries: string[],
  gitignorePath: string,
): Promise<string> {
  let currentContent = "";

  try {
    currentContent = await fs.readFile(gitignorePath, "utf-8");
  } catch {
    // File doesn't exist yet — start fresh
  }

  const existingLines = new Set(
    currentContent
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#")),
  );

  const toAdd = entries.filter((entry) => !existingLines.has(entry));

  if (toAdd.length === 0) return currentContent;

  // Build the addition block
  const lines: string[] = [];

  // Add a newline separator if the file doesn't end with one
  if (currentContent.length > 0 && !currentContent.endsWith("\n")) {
    lines.push("");
  }

  lines.push("# Added by bilt — environment files");
  for (const entry of toAdd) {
    lines.push(entry);
  }
  lines.push(""); // trailing newline

  return currentContent + lines.join("\n");
}

/**
 * Append stub entries for missing env vars to existing env file content.
 *
 * Adds a comment header and empty variable declarations for each
 * missing variable.
 *
 * @param targetContent Existing env file content.
 * @param missingVars   Variable names to add.
 * @returns Updated env file content with missing vars appended.
 */
export function addMissingEnvVars(
  targetContent: string,
  missingVars: string[],
): string {
  if (missingVars.length === 0) return targetContent;

  const lines: string[] = [];

  // Ensure we start on a new line
  if (targetContent.length > 0 && !targetContent.endsWith("\n")) {
    lines.push("");
  }

  lines.push("");
  lines.push("# Added by bilt — missing variables");

  for (const varName of missingVars) {
    lines.push(`${varName}=`);
  }

  lines.push(""); // trailing newline

  return targetContent + lines.join("\n");
}
