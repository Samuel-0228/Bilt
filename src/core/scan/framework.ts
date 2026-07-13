// ─── Framework Detection & Client-Exposure Checks ───────────────────────────
//
// Identifies the web framework used by a project by inspecting
// package.json dependencies and common config files, then checks
// whether any env vars exposed to the client bundle contain secrets.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'node:fs/promises';
import path from 'node:path';
import { isHighEntropy } from '../rules/entropy.js';
import { SECRET_RULES } from '../rules/secret-rules.js';
import type {
  FrameworkInfo,
  ParsedEnvFile,
  SecretRule,
  ScanFinding,
} from '../../types/index.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let findingCounter = 0;

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++findingCounter}`;
}

/**
 * Try to read and parse a JSON file.  Returns `null` on any error.
 */
async function tryReadJson(filePath: string): Promise<unknown> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * Check whether a file exists on disk.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// ─── Framework Definitions ───────────────────────────────────────────────────

interface FrameworkCandidate {
  /** npm package that identifies this framework */
  npmPackage?: string;
  /** File whose presence identifies this framework (relative to root) */
  configFile?: string;
  /** The FrameworkInfo to return when detected */
  info: FrameworkInfo;
}

const FRAMEWORK_CANDIDATES: FrameworkCandidate[] = [
  {
    npmPackage: 'next',
    info: {
      name: 'nextjs',
      displayName: 'Next.js',
      clientExposedPrefixes: ['NEXT_PUBLIC_'],
      configFiles: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
    },
  },
  {
    npmPackage: 'vite',
    info: {
      name: 'vite',
      displayName: 'Vite',
      clientExposedPrefixes: ['VITE_'],
      configFiles: ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'],
    },
  },
  {
    npmPackage: 'react-scripts',
    info: {
      name: 'cra',
      displayName: 'Create React App',
      clientExposedPrefixes: ['REACT_APP_'],
      configFiles: [],
    },
  },
  {
    npmPackage: '@angular/core',
    info: {
      name: 'angular',
      displayName: 'Angular',
      clientExposedPrefixes: ['NG_'],
      configFiles: ['angular.json'],
    },
  },
  {
    npmPackage: 'nuxt',
    info: {
      name: 'nuxt',
      displayName: 'Nuxt',
      clientExposedPrefixes: ['NUXT_PUBLIC_'],
      configFiles: ['nuxt.config.ts', 'nuxt.config.js'],
    },
  },
  {
    npmPackage: '@sveltejs/kit',
    info: {
      name: 'sveltekit',
      displayName: 'SvelteKit',
      clientExposedPrefixes: ['PUBLIC_'],
      configFiles: ['svelte.config.js'],
    },
  },
  {
    npmPackage: 'gatsby',
    info: {
      name: 'gatsby',
      displayName: 'Gatsby',
      clientExposedPrefixes: ['GATSBY_'],
      configFiles: ['gatsby-config.js', 'gatsby-config.ts'],
    },
  },
];

/**
 * Non-JS framework detection: look for config files that identify
 * Python / Ruby frameworks.
 */
const FILE_BASED_FRAMEWORKS: Array<{
  file: string;
  info: FrameworkInfo;
}> = [
  {
    file: 'manage.py',
    info: {
      name: 'django',
      displayName: 'Django',
      clientExposedPrefixes: [], // Django doesn't expose env to client
      configFiles: ['manage.py', 'settings.py'],
    },
  },
  {
    file: 'Gemfile',
    info: {
      name: 'rails',
      displayName: 'Ruby on Rails',
      clientExposedPrefixes: [], // Rails doesn't expose env to client by default
      configFiles: ['Gemfile', 'config/application.rb'],
    },
  },
  {
    file: 'requirements.txt',
    info: {
      name: 'flask',
      displayName: 'Flask / Python',
      clientExposedPrefixes: [],
      configFiles: ['requirements.txt', 'app.py'],
    },
  },
];

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Detect which web framework a project uses.
 *
 * Detection order:
 * 1. Read `package.json` and check `dependencies` + `devDependencies`
 *    for known framework packages.
 * 2. Fall back to file-based detection for non-JS frameworks.
 * 3. Return `undefined` if no framework can be determined.
 */
export async function detectFramework(
  projectDir: string,
): Promise<FrameworkInfo | undefined> {
  // 1. Dependency-based detection
  const pkgJsonPath = path.join(projectDir, 'package.json');
  let pkg: any;

  try {
    const raw = await fs.readFile(pkgJsonPath, 'utf-8');
    pkg = JSON.parse(raw);
  } catch {
    // No package.json — skip dependency checks
  }

  if (pkg) {
    // Check dependencies / devDependencies
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

    for (const candidate of FRAMEWORK_CANDIDATES) {
      if (candidate.npmPackage && deps[candidate.npmPackage]) {
        return candidate.info;
      }
    }
  }

  // 2. File-based detection
  for (const fb of FILE_BASED_FRAMEWORKS) {
    const exists = await fileExists(path.join(projectDir, fb.file));
    if (exists) return fb.info;
  }

  return undefined;
}

/**
 * Check whether any client-exposed env vars (those whose names start
 * with a framework-specific prefix like `NEXT_PUBLIC_`, `VITE_`, etc.)
 * contain values that look like secrets.
 *
 * This is one of the most important checks in Bilt because client-side
 * env vars are embedded in the JavaScript bundle and visible to anyone
 * who inspects the page source.
 *
 * Returns:
 *   • `critical` findings for values that match a secret-detection rule
 *   • `warning` findings for values with high Shannon entropy
 */
export function checkClientExposedSecrets(
  envFiles: ParsedEnvFile | ParsedEnvFile[],
  framework: FrameworkInfo,
  rules: SecretRule[] = SECRET_RULES,
  entropyThreshold: number = 4.5,
): ScanFinding[] {
  const findings: ScanFinding[] = [];
  const files = Array.isArray(envFiles) ? envFiles : [envFiles];

  // If the framework has no client-exposed prefixes, nothing to check
  if (framework.clientExposedPrefixes.length === 0) return findings;

  for (const envFile of files) {
    for (const [key, entry] of envFile.entries) {
      // Check if this var uses a client-exposed prefix
      const exposedPrefix = framework.clientExposedPrefixes.find((prefix) =>
        key.startsWith(prefix),
      );

      if (!exposedPrefix) continue;

      const value = entry.value;
      if (!value || value.length === 0) continue;

      // Check against every secret rule
      let matchedRule = false;
      for (const rule of rules) {
        rule.pattern.lastIndex = 0;
        if (rule.pattern.test(value)) {
          findings.push({
            id: nextId('env-exposed'),
            severity: 'critical',
            category: 'env-exposed',
            message:
              `Variable "${key}" is exposed to the client bundle via ${framework.displayName} ` +
              `and contains a secret (${rule.name})`,
            file: envFile.filePath,
            line: entry.line,
            ruleId: rule.id,
            suggestion:
              `Remove the "${exposedPrefix}" prefix to keep this value server-side only, ` +
              `or use a different variable name for the secret`,
          });
          matchedRule = true;
          break; // One finding per var is enough
        }
      }

      // If no rule matched, check entropy
      if (!matchedRule && isHighEntropy(value, entropyThreshold)) {
        findings.push({
          id: nextId('env-exposed'),
          severity: 'warning',
          category: 'env-exposed',
          message:
            `Variable "${key}" is exposed to the client bundle via ${framework.displayName} ` +
            `and has a high-entropy value that may be a secret`,
          file: envFile.filePath,
          line: entry.line,
          suggestion:
            `Verify that "${key}" is safe to expose publicly. ` +
            `If it's a secret, remove the "${exposedPrefix}" prefix.`,
        });
      }
    }
  }

  return findings;
}
