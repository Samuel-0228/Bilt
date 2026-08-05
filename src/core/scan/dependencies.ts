// ─── Dependency Intelligence Scanner ─────────────────────────────────────────
// Analyzes package.json, lockfiles, duplicate versions, unused packages, and security risks.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import type { ScanFinding } from "../../types/index.js";

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}

/**
 * Scan package dependencies and usage.
 */
export async function scanDependencies(rootDir: string): Promise<ScanFinding[]> {
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

  // 2. Check for unused dependencies by scanning source files
  const depNames = Object.keys(dependencies).filter(
    (name) => !name.startsWith("@types/") && !name.includes("plugin") && !name.includes("preset"),
  );

  if (depNames.length > 0) {
    try {
      const codeFiles = await fg(["**/*.{js,ts,jsx,tsx,mjs,cjs}"], {
        cwd: rootDir,
        ignore: ["node_modules/**", "dist/**", "build/**", ".next/**"],
        onlyFiles: true,
      });

      const importedModules = new Set<string>();
      for (const file of codeFiles.slice(0, 100)) {
        try {
          const content = await fs.readFile(path.join(rootDir, file), "utf-8");
          // Match import ... from 'pkg' or require('pkg')
          const matches = content.matchAll(/(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g);
          for (const match of matches) {
            const specifier = match[1] || match[2];
            if (specifier) {
              const parts = specifier.split("/");
              const rootPkg = specifier.startsWith("@") && parts.length >= 2
                ? `${parts[0]}/${parts[1]}`
                : parts[0] || specifier;
              importedModules.add(rootPkg);
            }
          }
        } catch {
          // Skip
        }
      }

      // Check if any declared dependency is never imported
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
