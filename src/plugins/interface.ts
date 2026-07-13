// ─── Plugin Interface ────────────────────────────────────────────────────────
// Re-exports plugin types and provides runtime validation + context creation.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import { simpleGit } from 'simple-git';
import type {
  PluginManifest,
  PluginContext,
  PluginResult,
  BiltConfig,
} from '../types/index.js';

// Re-export plugin types for consumers
export type { PluginManifest, PluginContext, PluginResult };

// ─── Runtime Validation ──────────────────────────────────────────────────────

/**
 * Runtime type-guard: validates that an unknown value conforms to PluginManifest.
 */
export function validatePlugin(plugin: unknown): plugin is PluginManifest {
  if (plugin === null || typeof plugin !== 'object') return false;

  const p = plugin as Record<string, unknown>;

  if (typeof p['name'] !== 'string' || p['name'].length === 0) return false;
  if (typeof p['version'] !== 'string' || p['version'].length === 0) return false;
  if (typeof p['description'] !== 'string') return false;
  if (typeof p['check'] !== 'function') return false;

  // fix is optional but must be a function if present
  if (p['fix'] !== undefined && typeof p['fix'] !== 'function') return false;

  return true;
}

// ─── Context Builder ─────────────────────────────────────────────────────────

/**
 * Build a PluginContext from the project root and config.
 * Collects file list, parses .env files, and gathers git info.
 */
export async function createPluginContext(
  rootDir: string,
  config: BiltConfig,
): Promise<PluginContext> {
  // Gather all project files (respecting ignore patterns)
  const files = await fg('**/*', {
    cwd: rootDir,
    dot: true,
    ignore: config.ignore,
    onlyFiles: true,
  });

  // Parse env vars from .env files
  const envVars = new Map<string, Map<string, string>>();
  const envFiles = files.filter(
    (f) => path.basename(f).startsWith('.env') && !f.includes('node_modules'),
  );

  for (const envFile of envFiles) {
    const fullPath = path.join(rootDir, envFile);
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const vars = new Map<string, string>();
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed === '' || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed
          .slice(eqIdx + 1)
          .trim()
          .replace(/^["']|["']$/g, '');
        vars.set(key, value);
      }
      envVars.set(envFile, vars);
    } catch {
      // Skip unreadable files
    }
  }

  // Git info
  let isRepo = false;
  let branch: string | undefined;
  try {
    const git = simpleGit(rootDir);
    isRepo = await git.checkIsRepo();
    if (isRepo) {
      const status = await git.status();
      branch = status.current ?? undefined;
    }
  } catch {
    isRepo = false;
  }

  return {
    rootDir,
    files,
    envVars,
    git: { isRepo, branch },
    config,
  };
}
