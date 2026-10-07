// ─── Dependency Intelligence Scanner ─────────────────────────────────────────
// Analyzes package.json, lockfiles, duplicate versions, unused packages, and security risks.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import type { ScanFinding, BiltConfig } from "../../types/index.js";

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}

/**
 * Identify implicit framework packages and transitive peer dependencies that should not
 * be flagged as unused even if not directly imported in user source files.
 */
function getImplicitFrameworkDeps(
  rootDir: string,
  allDeps: Record<string, string>,
  config?: Partial<BiltConfig>,
): Set<string> {
  const allowlist = new Set<string>();

  const frameworkPreset = config?.framework?.toLowerCase().trim();

  // Next.js
  const isNext =
    frameworkPreset === "next" ||
    frameworkPreset === "nextjs" ||
    Boolean(allDeps["next"]) ||
    fsSync.existsSync(path.join(rootDir, "next.config.js")) ||
    fsSync.existsSync(path.join(rootDir, "next.config.mjs")) ||
    fsSync.existsSync(path.join(rootDir, "next.config.ts"));

  if (isNext) {
    allowlist.add("react");
    allowlist.add("react-dom");
    allowlist.add("@types/react");
    allowlist.add("@types/react-dom");
    allowlist.add("@types/node");
    allowlist.add("sharp");
    allowlist.add("next");
  }

  // Remix
  const isRemix =
    frameworkPreset === "remix" ||
    Boolean(allDeps["@remix-run/react"]) ||
    Boolean(allDeps["@remix-run/node"]) ||
    fsSync.existsSync(path.join(rootDir, "remix.config.js")) ||
    fsSync.existsSync(path.join(rootDir, "remix.config.ts"));

  if (isRemix) {
    allowlist.add("react");
    allowlist.add("react-dom");
    allowlist.add("@remix-run/node");
    allowlist.add("@remix-run/react");
    allowlist.add("@remix-run/serve");
    allowlist.add("@types/react");
    allowlist.add("@types/react-dom");
  }

  // Vite
  const isVite =
    frameworkPreset === "vite" ||
    Boolean(allDeps["vite"]) ||
    fsSync.existsSync(path.join(rootDir, "vite.config.js")) ||
    fsSync.existsSync(path.join(rootDir, "vite.config.ts")) ||
    fsSync.existsSync(path.join(rootDir, "vite.config.mjs"));

  if (isVite) {
    allowlist.add("@vitejs/plugin-react");
    allowlist.add("@vitejs/plugin-react-swc");
    allowlist.add("@vitejs/plugin-vue");
    allowlist.add("@vitejs/plugin-vue-jsx");
    allowlist.add("@sveltejs/vite-plugin-svelte");
    allowlist.add("vite-plugin-inspect");
  }

  // Nuxt
  const isNuxt =
    frameworkPreset === "nuxt" ||
    Boolean(allDeps["nuxt"]) ||
    fsSync.existsSync(path.join(rootDir, "nuxt.config.ts")) ||
    fsSync.existsSync(path.join(rootDir, "nuxt.config.js"));

  if (isNuxt) {
    allowlist.add("vue");
    allowlist.add("vue-router");
    allowlist.add("@nuxt/devtools");
    allowlist.add("nuxt");
  }

  // Astro
  const isAstro =
    frameworkPreset === "astro" ||
    Boolean(allDeps["astro"]) ||
    fsSync.existsSync(path.join(rootDir, "astro.config.mjs")) ||
    fsSync.existsSync(path.join(rootDir, "astro.config.ts")) ||
    fsSync.existsSync(path.join(rootDir, "astro.config.js"));

  if (isAstro) {
    allowlist.add("@astrojs/tailwind");
    allowlist.add("@astrojs/react");
    allowlist.add("@astrojs/vue");
    allowlist.add("@astrojs/svelte");
    allowlist.add("@astrojs/mdx");
    allowlist.add("astro");
  }

  // SvelteKit
  const isSvelteKit =
    frameworkPreset === "sveltekit" ||
    Boolean(allDeps["@sveltejs/kit"]) ||
    fsSync.existsSync(path.join(rootDir, "svelte.config.js")) ||
    fsSync.existsSync(path.join(rootDir, "svelte.config.ts"));

  if (isSvelteKit) {
    allowlist.add("svelte");
    allowlist.add("@sveltejs/kit");
    allowlist.add("@sveltejs/adapter-auto");
    allowlist.add("@sveltejs/adapter-node");
    allowlist.add("@sveltejs/adapter-static");
    allowlist.add("@sveltejs/adapter-vercel");
    allowlist.add("@sveltejs/adapter-cloudflare");
  }

  // Supabase SSR & helper libraries
  const hasSupabase =
    Boolean(allDeps["@supabase/ssr"]) ||
    Boolean(allDeps["@supabase/supabase-js"]) ||
    Boolean(allDeps["@supabase/auth-helpers-nextjs"]);

  if (hasSupabase) {
    allowlist.add("@supabase/ssr");
    allowlist.add("@supabase/supabase-js");
    allowlist.add("@supabase/auth-helpers-nextjs");
  }

  return allowlist;
}

/**
 * Scan package dependencies and usage.
 */
export async function scanDependencies(
  rootDir: string,
  config?: Partial<BiltConfig>,
): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = [];
  const pkgPath = path.join(rootDir, "package.json");

  let pkgContent = "";
  try {
    pkgContent = await fs.readFile(pkgPath, "utf-8");
  } catch {
    return findings;
  }

  let pkg: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  } = {};
  try {
    pkg = JSON.parse(pkgContent);
  } catch {
    findings.push({
      id: nextId("config-package"),
      severity: "critical",
      category: "config-package",
      message: "package.json is invalid JSON",
      file: "package.json",
      suggestion: "Fix JSON syntax errors in package.json.",
    });
    return findings;
  }

  const dependencies = pkg.dependencies || {};
  const devDependencies = pkg.devDependencies || {};
  const allDeps = { ...dependencies, ...devDependencies };

  // 1. Check for known vulnerable / abandoned package patterns
  const HIGH_RISK_PACKAGES: Record<string, string> = {
    "request": "request package is deprecated and unmaintained. Use native fetch or axios.",
    "axios-mock-adapter": "check for security updates.",
    "event-stream": "historical malicious package compromise.",
    "flatmap-stream": "historical malicious payload package.",
    "core-js": "check version compatibility.",
  };

  for (const [depName, reason] of Object.entries(HIGH_RISK_PACKAGES)) {
    if (allDeps[depName]) {
      findings.push({
        id: nextId("dep-vulnerable"),
        severity: depName === "event-stream" || depName === "flatmap-stream" ? "critical" : "warning",
        category: "dep-vulnerable",
        message: `Deprecated or vulnerable dependency detected: ${depName}`,
        file: "package.json",
        suggestion: reason,
      });
    }
  }

  // 2. Check for unused dependencies by scanning source files & package.json scripts
  const BUILD_CLI_PACKAGES = new Set([
    "vite",
    "vitest",
    "typescript",
    "tsx",
    "ts-node",
    "tailwindcss",
    "postcss",
    "autoprefixer",
    "concurrently",
    "rimraf",
    "cross-env",
    "dotenv",
    "husky",
    "lint-staged",
    "eslint",
    "prettier",
    "sharp",
    "micro",
    "nodemon",
    "zod",
    "clsx",
    "tailwind-merge",
    "class-variance-authority",
    "date-fns",
    "swr",
    "react-hook-form",
    "@hookform/resolvers",
    "lucide-react",
    "embla-carousel-react",
  ]);

  const scriptsContent = pkg.scripts ? JSON.stringify(pkg.scripts) : "";
  const userIgnored = new Set(config?.ignoreUnused || []);
  const implicitFrameworkDeps = getImplicitFrameworkDeps(rootDir, allDeps, config);

  const depNames = Object.keys(dependencies).filter((name) => {
    if (userIgnored.has(name)) {
      return false;
    }
    if (implicitFrameworkDeps.has(name)) {
      return false;
    }
    if (name.startsWith("@types/") || name.includes("plugin") || name.includes("preset") || name.includes("config")) {
      return false;
    }
    if (BUILD_CLI_PACKAGES.has(name)) {
      return false;
    }
    if (scriptsContent.includes(name)) {
      return false;
    }
    return true;
  });

  if (depNames.length > 0) {
    try {
      const codeFiles = await fg(["**/*.{js,ts,jsx,tsx,mjs,cjs,json,vue,svelte}"], {
        cwd: rootDir,
        ignore: ["node_modules/**", "dist/**", "build/**", ".next/**", ".nuxt/**"],
        onlyFiles: true,
      });

      const importedModules = new Set<string>();
      for (const file of codeFiles.slice(0, 2000)) {
        try {
          const content = await fs.readFile(path.join(rootDir, file), "utf-8");
          const matches = content.matchAll(
            /(?:(?:import|export)\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"])/g,
          );
          for (const match of matches) {
            const specifier = match[1] || match[2] || match[3] || match[4];
            if (specifier) {
              const parts = specifier.split("/");
              const rootPkg =
                specifier.startsWith("@") && parts.length >= 2
                  ? `${parts[0]}/${parts[1]}`
                  : parts[0] || specifier;
              importedModules.add(rootPkg);
            }
          }
        } catch {
          // Skip
        }
      }

      for (const dep of depNames) {
        if (!importedModules.has(dep)) {
          findings.push({
            id: nextId("dep-unused"),
            severity: "info",
            category: "dep-unused",
            message: `Dependency "${dep}" is listed in package.json but not imported in scanned source files.`,
            file: "package.json",
            suggestion: `If unused, run your package manager uninstall command (e.g. npm uninstall ${dep}).`,
          });
        }
      }
    } catch {
      // Skip
    }
  }

  return findings;
}
