// ─── Plugin Loader ───────────────────────────────────────────────────────────
// Discovers, loads, and validates plugins from explicit config paths and built-ins.
// Untrusted code is never executed without explicit declaration in config.plugins.

import { createRequire } from "node:module";
import path from "node:path";
import type { BiltConfig, PluginManifest } from "../types/index.js";
import { validatePlugin } from "./interface.js";
import dockerPlugin from "./official/docker.js";
import terraformPlugin from "./official/terraform.js";
import prismaPlugin from "./official/prisma.js";

const require = createRequire(import.meta.url);

const OFFICIAL_PLUGINS: Record<string, PluginManifest> = {
  docker: dockerPlugin,
  "bilt-plugin-docker": dockerPlugin,
  terraform: terraformPlugin,
  "bilt-plugin-terraform": terraformPlugin,
  prisma: prismaPlugin,
  "bilt-plugin-prisma": prismaPlugin,
};

/**
 * Load all explicitly configured plugins from:
 * 1. Official built-in plugins (docker, terraform, prisma)
 * 2. Explicit paths/packages declared in config.plugins
 *
 * Security Invariant: Never automatically executes arbitrary code found in node_modules
 * without explicit declaration in config.plugins.
 */
export async function loadPlugins(
  config: BiltConfig,
  rootDir: string,
): Promise<PluginManifest[]> {
  const plugins: PluginManifest[] = [];
  const seen = new Set<string>();

  if (!Array.isArray(config.plugins) || config.plugins.length === 0) {
    return plugins;
  }

  for (const pluginRef of config.plugins) {
    if (!pluginRef || typeof pluginRef !== "string") continue;

    const trimmed = pluginRef.trim();

    // 1. Check official built-in plugins first
    if (OFFICIAL_PLUGINS[trimmed]) {
      const official = OFFICIAL_PLUGINS[trimmed]!;
      if (!seen.has(official.name)) {
        seen.add(official.name);
        plugins.push(official);
      }
      continue;
    }

    // 2. Resolve explicit file path or node_modules package
    let resolved = trimmed;
    if (trimmed.startsWith("./") || trimmed.startsWith("../") || path.isAbsolute(trimmed)) {
      resolved = path.isAbsolute(trimmed) ? trimmed : path.resolve(rootDir, trimmed);
    } else {
      // Check node_modules in rootDir
      const inNodeModules = path.join(rootDir, "node_modules", trimmed);
      try {
        resolved = inNodeModules;
      } catch {
        resolved = trimmed;
      }
    }

    const loaded = await tryLoadPlugin(resolved);
    if (loaded && !seen.has(loaded.name)) {
      seen.add(loaded.name);
      plugins.push(loaded);
    }
  }

  return plugins;
}

/**
 * Attempt to dynamically import a plugin from a given path, validate, and return.
 * Returns null if loading fails or validation fails.
 */
async function tryLoadPlugin(
  pluginPath: string,
): Promise<PluginManifest | null> {
  try {
    let mod: unknown;
    try {
      mod = await import(pluginPath);
    } catch {
      try {
        mod = require(pluginPath) as unknown;
      } catch {
        return null;
      }
    }

    // Unwrap default export if present
    const exported =
      mod !== null && typeof mod === "object" && "default" in mod
        ? (mod as Record<string, unknown>)["default"]
        : mod;

    if (validatePlugin(exported)) {
      return exported;
    }

    return null;
  } catch {
    return null;
  }
}
