// ─── Gitignore Analysis ──────────────────────────────────────────────────────
//
// Checks whether sensitive .env files are properly covered by .gitignore.
// Uses simple-git for accurate `git check-ignore` verification when
// running inside a git repository.
// ─────────────────────────────────────────────────────────────────────────────

import { simpleGit } from "simple-git";
import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import type { ScanFinding } from "../../types/index.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

let findingCounter = 0;

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++findingCounter}`;
}

/**
 * Basename extraction that handles both `/` and `\` separators.
 */
function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

/**
 * File names that are intentionally tracked (they contain no real secrets).
 */
const TEMPLATE_NAMES = new Set([
  ".env.example",
  ".env.template",
  ".env.sample",
]);

/**
 * Determine if a file is a template / example that SHOULD be tracked.
 */
function isTemplateFile(filePath: string): boolean {
  return TEMPLATE_NAMES.has(basename(filePath).toLowerCase());
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Parse a `.gitignore` file's content into a list of non-empty,
 * non-comment patterns.
 */
export function parseGitignore(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/**
 * Check whether the given env files are properly ignored by git.
 *
 * Strategy:
 * 1. For each env file, skip if it's a template (should be tracked).
 * 2. Fall back to simple pattern matching against gitignore content.
 */
export function checkEnvFilesIgnored(
  projectDir: string,
  envFiles: string[],
): ScanFinding[] {
  let gitignoreContent = "";
  try {
    gitignoreContent = fsSync.readFileSync(
      path.join(projectDir, ".gitignore"),
      "utf-8",
    );
  } catch {
    // Missing gitignore
  }

  const findings: ScanFinding[] = [];
  const patterns = parseGitignore(gitignoreContent);

  for (const envFile of envFiles) {
    // Skip template files — they should be tracked
    if (isTemplateFile(envFile)) continue;

    const name = basename(envFile);
    const relativePath = path.relative(projectDir, envFile).replace(/\\/g, "/");

    // Check if any gitignore pattern covers this file
    const isCovered = patternCoversFile(patterns, name, relativePath);

    if (!isCovered) {
      findings.push({
        id: nextId("gitignore-missing"),
        severity: "critical",
        category: "gitignore-missing",
        message: `${name} is not ignored by git — secrets may be committed`,
        file: envFile,
        suggestion: `Add "${name}" or ".env*" to your .gitignore file`,
      });
    }
  }

  return findings;
}

/**
 * Enhanced check using `git check-ignore` for accurate results.
 * Falls back to pattern matching if git is not available.
 */
export async function checkEnvFilesIgnoredWithGit(
  projectDir: string,
  envFiles: string[],
): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = [];

  // Try to use git check-ignore for accuracy
  let useGit = false;
  const git = simpleGit(projectDir);
  git.env({
    ...process.env,
    GIT_DIR: undefined,
    GIT_WORK_TREE: undefined,
  });

  try {
    const isRepo = await git.checkIsRepo();
    if (isRepo) useGit = true;
  } catch {
    // Git not available or not a repo — fall back to pattern matching
  }

  let gitignoreContent = "";
  try {
    gitignoreContent = await fs.readFile(
      path.join(projectDir, ".gitignore"),
      "utf-8",
    );
  } catch {
    // Missing gitignore
  }

  for (const envFile of envFiles) {
    if (isTemplateFile(envFile)) continue;

    const name = basename(envFile);
    let isIgnored = false;

    if (useGit) {
      try {
        await git.raw(["check-ignore", "-q", envFile]);
        // Exit code 0 means the file IS ignored
        isIgnored = true;
      } catch {
        // Exit code 1 means the file is NOT ignored
        // (simple-git throws on non-zero exit)
        isIgnored = false;
      }
    } else {
      // Fall back to pattern analysis
      const patterns = parseGitignore(gitignoreContent);
      const relativePath = path
        .relative(projectDir, envFile)
        .replace(/\\/g, "/");
      isIgnored = patternCoversFile(patterns, name, relativePath);
    }

    if (!isIgnored) {
      findings.push({
        id: nextId("gitignore-missing"),
        severity: "critical",
        category: "gitignore-missing",
        message: `${name} is not ignored by git — secrets may be committed`,
        file: envFile,
        suggestion: `Add "${name}" or ".env*" to your .gitignore file`,
      });
    }
  }

  return findings;
}

// ─── Pattern Matching (fallback) ─────────────────────────────────────────────

/**
 * Check whether a given file is covered by any of the parsed gitignore
 * patterns.  This is a simplified matcher — for accurate results use
 * `git check-ignore` via `checkEnvFilesIgnoredWithGit`.
 *
 * Supports:
 *   • Exact name match (`.env`)
 *   • Glob star patterns (`.env.*`, `.env*`)
 *   • Path-relative patterns (`config/.env`)
 *   • Negation patterns (`!.env.example`) — will un-ignore a file
 */
function patternCoversFile(
  patterns: string[],
  fileName: string,
  relativePath: string,
): boolean {
  let covered = false;

  for (const raw of patterns) {
    const negated = raw.startsWith("!");
    const pattern = negated ? raw.slice(1) : raw;

    const matches = patternMatchesSingle(pattern, fileName, relativePath);

    if (matches) {
      covered = !negated;
    }
  }

  return covered;
}

/**
 * Simple glob-like matching for a single gitignore pattern.
 */
function patternMatchesSingle(
  pattern: string,
  fileName: string,
  relativePath: string,
): boolean {
  // Trim trailing slashes (directory markers) for file matching
  const p = pattern.replace(/\/$/, "");

  // Exact filename match
  if (p === fileName) return true;

  // Path match
  if (p === relativePath) return true;

  // Pattern ends with `*` — prefix match
  if (p.endsWith("*")) {
    const prefix = p.slice(0, -1);
    if (fileName.startsWith(prefix)) return true;
    if (relativePath.startsWith(prefix)) return true;
  }

  // Pattern contains `.*` — e.g. `.env.*` matches `.env.local`
  if (p.includes(".*")) {
    const re = new RegExp(
      "^" +
        p.replace(/\./g, "\\.").replace(/\*/g, "[^/]*").replace(/\?/g, ".") +
        "$",
    );
    if (re.test(fileName) || re.test(relativePath)) return true;
  }

  // Pattern with `**` — recursive match
  if (p.includes("**")) {
    const re = new RegExp(
      "^" +
        p
          .replace(/\./g, "\\.")
          .replace(/\*\*/g, ".*")
          .replace(/(?<!\.)(\*)/g, "[^/]*") +
        "$",
    );
    if (re.test(relativePath)) return true;
  }

  return false;
}
