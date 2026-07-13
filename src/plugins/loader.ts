// ─── Plugin Loader ───────────────────────────────────────────────────────────
// Discovers, loads, and validates plugins from node_modules and config paths.

import { createRequire } from 'node:module';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { BiltConfig, PluginManifest } from '../types/index.js';
import { validatePlugin } from './interface.js';

const require = createRequire(import.meta.url);

/**
 * Load all plugins from:
 * 1. `bilt-plugin-*` packages in node_modules
 * 2. Explicit paths in config.plugins
 *
 * Each module is dynamically imported and validated at runtime.
 */
export async function loadPlugins(
  config: BiltConfig,
  rootDir: string,
): Promise<PluginManifest[]> {
  const plugins: PluginManifest[] = [];
  const seen = new Set<string>();

  // ── 1. Discover bilt-plugin-* in node_modules ────────────────────────
  const nodeModulesDir = path.join(rootDir, 'node_modules');
  try {
    const entries = await fs.readdir(nodeModulesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('bilt-plugin-')) {
        const pluginPath = path.join(nodeModulesDir, entry.name);
        const loaded = await tryLoadPlugin(pluginPath);
        if (loaded && !seen.has(loaded.name)) {
          seen.add(loaded.name);
          plugins.push(loaded);
        }
      }

      // Also check @bilt/ scoped packages
      if (entry.isDirectory() && entry.name === '@bilt') {
        const scopedDir = path.join(nodeModulesDir, '@bilt');
        try {
          const scopedEntries = await fs.readdir(scopedDir, {
            withFileTypes: true,
          });
          for (const se of scopedEntries) {
            if (se.isDirectory() && se.name.startsWith('plugin-')) {
              const pluginPath = path.join(scopedDir, se.name);
              const loaded = await tryLoadPlugin(pluginPath);
              if (loaded && !seen.has(loaded.name)) {
                seen.add(loaded.name);
                plugins.push(loaded);
              }
            }
          }
        } catch {
          // Scoped directory not readable
        }
      }
    }
  } catch {
    // node_modules doesn't exist — fine
  }

  // ── 2. Load explicit plugin paths from config ────────────────────────
  for (const pluginRef of config.plugins) {
    const resolved = path.isAbsolute(pluginRef)
      ? pluginRef
      : path.resolve(rootDir, pluginRef);

    const loaded = await tryLoadPlugin(resolved);
    if (loaded && !seen.has(loaded.name)) {
      seen.add(loaded.name);
      plugins.push(loaded);
    }
  }

  return plugins;
}

/**
 * Attempt to dynamically import a plugin from a given path, validate, return.
 * Returns null if loading fails or validation fails.
 */
async function tryLoadPlugin(
  pluginPath: string,
): Promise<PluginManifest | null> {
  try {
    // Try dynamic import (ESM)
    let mod: unknown;
    try {
      mod = await import(pluginPath);
    } catch {
      // Fallback to require (CJS)
      try {
        mod = require(pluginPath) as unknown;
      } catch {
        return null;
      }
    }

    // Unwrap default export if present
    const exported =
      mod !== null &&
      typeof mod === 'object' &&
      'default' in mod
        ? (mod as Record<string, unknown>)['default']
        : mod;

    if (validatePlugin(exported)) {
      return exported;
    }

    return null;
  } catch {
    return null;
  }
}
