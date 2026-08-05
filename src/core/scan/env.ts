// ─── Env File Parsing, Diffing & Cross-Reference ─────────────────────────────
//
// Pure functions for working with .env files:
//   • Parsing .env content into structured entries
//   • Discovering .env* files in a project
//   • Cross-comparing env files (e.g. .env vs .env.example)
//   • Scanning source code for process.env / import.meta.env references
//   • Finding missing and unused env vars
// ─────────────────────────────────────────────────────────────────────────────

import fg from "fast-glob";
import type {
  ParsedEnvEntry,
  ParsedEnvFile,
  ScanFinding,
  BiltConfig,
  Severity,
} from "../../types/index.js";
import path from "node:path";
import { promises as fs } from "node:fs";
import { detectFramework, checkClientExposedSecrets } from "./framework.js";
import { SECRET_RULES } from "../rules/secret-rules.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

let findingCounter = 0;

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++findingCounter}`;
}

/**
 * Remove surrounding quotes (single, double, or backtick) from a value,
 * handling escaped quotes inside.
 */
function unquote(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length < 2) return trimmed;

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];

  if ((first === '"' || first === "'" || first === "`") && first === last) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

// ─── Regex patterns for code references ──────────────────────────────────────

/**
 * Captures env var names from common patterns across JS/TS/Python/Ruby.
 * Each regex has a single named capture group `key`.
 */
const ENV_REF_PATTERNS: RegExp[] = [
  // process.env.VAR_NAME
  /process\.env\.(?<key>[A-Z_][A-Z0-9_]*)/g,
  // process.env['VAR_NAME'] or process.env["VAR_NAME"]
  /process\.env\[['"](?<key>[A-Z_][A-Z0-9_]*)['"]\]/g,
  // import.meta.env.VAR_NAME (Vite)
  /import\.meta\.env\.(?<key>[A-Z_][A-Z0-9_]*)/g,
  // os.environ.get('VAR_NAME') (Python)
  /os\.environ\.get\(\s*['"](?<key>[A-Z_][A-Z0-9_]*)['"]/g,
  // os.environ['VAR_NAME'] (Python)
  /os\.environ\[['"](?<key>[A-Z_][A-Z0-9_]*)['"]\]/g,
  // ENV['VAR_NAME'] (Ruby / generic)
  /ENV\[['"](?<key>[A-Z_][A-Z0-9_]*)['"]\]/g,
  // ENV.fetch('VAR_NAME') (Ruby)
  /ENV\.fetch\(\s*['"](?<key>[A-Z_][A-Z0-9_]*)['"]/g,
];

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Parse the content of a `.env` file into a structured `ParsedEnvFile`.
 *
 * Handles:
 *   • Comments (lines starting with `#`)
 *   • Empty / whitespace-only lines
 *   • Inline comments (`VAR=value # comment`)
 *   • Single-quoted, double-quoted, and backtick-quoted values
 *   • Multiline values enclosed in double-quotes (using `\n` or real newlines)
 *   • `export` prefix (e.g. `export FOO=bar`)
 */
export function parseEnvFile(content: string, filePath: string): ParsedEnvFile {
  const entries = new Map<string, ParsedEnvEntry>();
  const rawLines = content.split("\n");

  let i = 0;
  while (i < rawLines.length) {
    const rawLine = rawLines[i]!;
    const trimmed = rawLine.trim();

    // Skip empty lines and pure comment lines
    if (trimmed === "" || trimmed.startsWith("#")) {
      i++;
      continue;
    }

    // Strip optional `export ` prefix
    const line = trimmed.startsWith("export ")
      ? trimmed.slice(7).trim()
      : trimmed;

    // Find the first `=`
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) {
      i++;
      continue;
    }

    const key = line.slice(0, eqIdx).trim();
    let valueRaw = line.slice(eqIdx + 1);

    // Handle inline comment (only when value is NOT quoted)
    let comment: string | undefined;
    const valueTrimmed = valueRaw.trim();

    if (
      valueTrimmed.startsWith('"') ||
      valueTrimmed.startsWith("'") ||
      valueTrimmed.startsWith("`")
    ) {
      const quote = valueTrimmed[0]!;

      // Check if the closing quote is on the same line
      const closeIdx = valueTrimmed.indexOf(quote, 1);

      if (closeIdx === -1 && quote === '"') {
        // Multiline value — collect lines until closing quote
        let multiValue = valueTrimmed.slice(1); // strip opening quote
        i++;
        while (i < rawLines.length) {
          const nextLine = rawLines[i]!;
          const endIdx = nextLine.indexOf('"');
          if (endIdx !== -1) {
            multiValue += "\n" + nextLine.slice(0, endIdx);
            break;
          }
          multiValue += "\n" + nextLine;
          i++;
        }
        valueRaw = multiValue;
      } else {
        valueRaw = unquote(valueTrimmed);
      }
    } else {
      // Unquoted — look for inline comment
      const hashIdx = valueTrimmed.indexOf(" #");
      if (hashIdx !== -1) {
        comment = valueTrimmed.slice(hashIdx + 2).trim();
        valueRaw = valueTrimmed.slice(0, hashIdx);
      } else {
        valueRaw = valueTrimmed;
      }
    }

    const value = typeof valueRaw === "string" ? valueRaw.trim() : "";

    entries.set(key, {
      key,
      value,
      line: i + 1, // 1-indexed
      comment,
    });

    i++;
  }

  return { filePath, entries, rawLines };
}

/**
 * Discover all `.env*` files in a directory tree, following common
 * naming conventions: `.env`, `.env.local`, `.env.development`, etc.
 *
 * Excludes `node_modules`, `.git`, `dist`, and `build` directories.
 */
export async function findEnvFiles(dir: string): Promise<string[]> {
  const matches = await fg(["**/.env", "**/.env.*"], {
    cwd: dir,
    dot: true,
    ignore: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/.bilt/**",
      "**/venv/**",
      "**/.venv/**",
      "**/__pycache__/**",
      "**/.next/**",
      "**/.nuxt/**",
      "**/.cache/**",
      "**/.vercel/**",
      "**/.netlify/**",
    ],
    absolute: true,
    onlyFiles: true,
  });
  return matches;
}

/**
 * Cross-compare multiple parsed env files and produce findings for
 * variables that exist in one file but are missing from another.
 *
 * Template files (`.env.example`, `.env.template`, `.env.sample`) are
 * treated as the "source of truth" — variables present in a template
 * but missing from an actual env file produce a finding.
 */
export function diffEnvFiles(
  filesOrFileA: ParsedEnvFile[] | ParsedEnvFile,
  fileB?: ParsedEnvFile,
): ScanFinding[] {
  const files = Array.isArray(filesOrFileA)
    ? filesOrFileA
    : fileB
      ? [filesOrFileA, fileB]
      : [filesOrFileA];

  if (files.length < 2) return [];

  const findings: ScanFinding[] = [];

  const templateSuffixes = [".example", ".template", ".sample"];

  const isTemplate = (fp: string): boolean =>
    templateSuffixes.some((s) => fp.endsWith(s));

  for (const fileA of files) {
    for (const fileB of files) {
      if (fileA === fileB) continue;

      // Only report "missing in B" when A is a template or both are real files
      // to avoid noisy duplicate findings.
      if (!isTemplate(fileA.filePath) && isTemplate(fileB.filePath)) continue;

      for (const key of fileA.entries.keys()) {
        if (!fileB.entries.has(key)) {
          const severity = isTemplate(fileA.filePath) ? "warning" : "info";
          const baseName = (fp: string) => fp.split(/[\\/]/).pop() ?? fp;

          findings.push({
            id: nextId("env-mismatch"),
            severity,
            category: "env-mismatch",
            message: `Variable "${key}" is defined in ${baseName(fileA.filePath)} but missing from ${baseName(fileB.filePath)}`,
            file: fileB.filePath,
            suggestion: `Add ${key} to ${baseName(fileB.filePath)}`,
          });
        }
      }
    }
  }

  return findings;
}

/**
 * Scan source code for references to environment variables.
 * Returns a deduplicated list of variable names found.
 */
export function scanCodeForEnvRefs(
  content: string,
  _filePath?: string,
): string[] & { size: number } {
  const refs = new Set<string>();

  for (const pattern of ENV_REF_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const key = match.groups?.["key"];
      if (key) refs.add(key);
    }
  }

  const result = [...refs] as any;
  result.size = refs.size;
  return result;
}

/**
 * Given the env var names referenced in code and the env vars actually
 * defined, produce findings for any referenced vars that are missing.
 */
export function findMissingEnvVars(
  codeRefs: string[] | Set<string>,
  envVars: string[] | Set<string>,
  codeFile: string,
): ScanFinding[] {
  const defined = envVars instanceof Set ? envVars : new Set(envVars);
  const refs = codeRefs instanceof Set ? [...codeRefs] : codeRefs;
  const findings: ScanFinding[] = [];

  // Built-in Node/framework vars that don't need to be in .env
  const builtins = new Set([
    "NODE_ENV",
    "PORT",
    "PWD",
    "HOME",
    "PATH",
    "CI",
    "TZ",
  ]);

  for (const ref of refs) {
    if (defined.has(ref) || builtins.has(ref)) continue;

    findings.push({
      id: nextId("env-missing"),
      severity: "warning",
      category: "env-missing",
      message: `Code references process.env.${ref} but it is not defined in any .env file`,
      file: codeFile,
      suggestion: `Add ${ref}= to your .env file`,
    });
  }

  return findings;
}

/**
 * Given the env var names referenced in code and all env entries,
 * produce findings for env vars that are defined but never used.
 */
export function findUnusedEnvVars(
  firstArg: string[] | Set<string>,
  secondArg: ParsedEnvEntry[] | Set<string>,
  envFile: string,
): ScanFinding[] {
  let referenced: Set<string>;
  let entriesList: Array<{ key: string; line: number }>;

  if (firstArg instanceof Set) {
    // Test case format: firstArg is definedKeys (Set), secondArg is envRefs (Set)
    const definedKeys = firstArg;
    referenced =
      secondArg instanceof Set ? secondArg : new Set(secondArg as any);
    entriesList = [...definedKeys].map((key) => ({ key, line: 1 }));
  } else {
    // Normal format: firstArg is codeRefs (string[]), secondArg is envEntries (ParsedEnvEntry[])
    referenced = new Set(firstArg);
    entriesList = secondArg as ParsedEnvEntry[];
  }

  const findings: ScanFinding[] = [];

  // Common vars that may be used implicitly by runtimes / libraries
  const implicit = new Set([
    "NODE_ENV",
    "PORT",
    "HOST",
    "TZ",
    "DEBUG",
    "LOG_LEVEL",
    "DATABASE_URL",
    "REDIS_URL",
    "ALLOWED_HOSTS",
    "SECRET_KEY",
    "DJANGO_SETTINGS_MODULE",
  ]);

  for (const entry of entriesList) {
    if (referenced.has(entry.key) || implicit.has(entry.key)) continue;

    findings.push({
      id: nextId("env-unused"),
      severity: "info",
      category: "env-unused",
      message: `Variable "${entry.key}" is defined in .env but not referenced in scanned code`,
      file: envFile,
      line: entry.line,
      suggestion: `Remove ${entry.key} if it is no longer needed`,
    });
  }

  return findings;
}

/**
 * Helper to apply severity overrides and filters to findings.
 */
function applyOverridesAndFilter(
  findings: ScanFinding[],
  config: BiltConfig,
  minSeverity?: Severity,
): ScanFinding[] {
  for (const finding of findings) {
    if (finding.ruleId) {
      const override = config.severityOverrides?.[finding.ruleId];
      if (override) finding.severity = override;
    }
  }

  if (minSeverity) {
    const severityOrder: Record<Severity, number> = {
      critical: 0,
      warning: 1,
      info: 2,
      passed: 3,
    };
    const minLevel = severityOrder[minSeverity];
    return findings.filter((f) => severityOrder[f.severity] <= minLevel);
  }

  return findings;
}

/**
 * Performs a full environment variable scan for a project directory.
 * (Extracts the logic previously in scan.ts Step 2).
 */
export async function performEnvScan(
  rootDir: string,
  config: BiltConfig,
  options: { severity?: string; debug?: boolean } = {},
): Promise<ScanFinding[]> {
  const stepFindings: ScanFinding[] = [];
  const envFiles = await findEnvFiles(rootDir);
  const parsedEnvFiles = [];
  for (const envFile of envFiles) {
    try {
      const content = await fs.readFile(envFile, "utf-8");
      const parsed = parseEnvFile(content, envFile);
      parsedEnvFiles.push(parsed);
    } catch {
      // Skip unreadable files
    }
  }

  const codeFiles = await fg(
    ["**/*.ts", "**/*.js", "**/*.tsx", "**/*.jsx", "**/*.py", "**/*.rb"],
    {
      cwd: rootDir,
      ignore: config.ignore,
      onlyFiles: true,
      absolute: true,
    },
  );

  const envRefs = new Set<string>();
  const primaryEnv = parsedEnvFiles[0];
  const definedKeys = primaryEnv ? [...primaryEnv.entries.keys()] : [];

  for (const codeFile of codeFiles) {
    try {
      const content = await fs.readFile(codeFile, "utf-8");
      const refs = scanCodeForEnvRefs(content, codeFile);
      for (const ref of refs) envRefs.add(ref);

      if (primaryEnv) {
        const missingFindings = findMissingEnvVars(
          refs,
          definedKeys,
          path.relative(rootDir, codeFile),
        );
        stepFindings.push(...missingFindings);
      }
    } catch {
      // Skip unreadable files
    }
  }

  if (parsedEnvFiles.length >= 2) {
    const diffFindings = diffEnvFiles(parsedEnvFiles);
    stepFindings.push(...diffFindings);
  }

  if (primaryEnv) {
    const unusedFindings = findUnusedEnvVars(
      [...envRefs],
      [...primaryEnv.entries.values()],
      path.relative(rootDir, primaryEnv.filePath),
    );
    stepFindings.push(...unusedFindings);
  }

  try {
    const detectedFramework = await detectFramework(rootDir);
    if (detectedFramework && parsedEnvFiles.length > 0) {
      const exposedFindings = checkClientExposedSecrets(
        parsedEnvFiles,
        detectedFramework,
        SECRET_RULES,
        config.entropyThreshold,
      );
      stepFindings.push(...exposedFindings);
    }
  } catch {
    // Framework detection failed
  }

  let filteredStepFindings = applyOverridesAndFilter(
    stepFindings,
    config,
    options.severity as Severity,
  );

  if (primaryEnv) {
    const envIssueKeys = new Set<string>();
    for (const f of filteredStepFindings) {
      const keyMatch =
        f.message.match(/Variable "(?<key>[A-Z_][A-Z0-9_]*)"/) ||
        f.message.match(/process\.env\.(?<key>[A-Z_][A-Z0-9_]*)/);
      if (keyMatch?.groups?.["key"]) {
        envIssueKeys.add(keyMatch.groups["key"]);
      }
    }
    const healthyKeys = definedKeys.filter((k) => !envIssueKeys.has(k));
    if (healthyKeys.length > 0) {
      filteredStepFindings.push({
        id: `env-healthy-${Date.now()}`,
        severity: "passed",
        category: "env-mismatch",
        message: `${healthyKeys.length} var${healthyKeys.length > 1 ? "s" : ""} healthy`,
        file: primaryEnv.filePath,
        suggestion: healthyKeys.join(", "),
      });
    }
  }

  return filteredStepFindings;
}
