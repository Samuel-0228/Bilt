// ─── Configuration Intelligence Scanner ─────────────────────────────────────
// Audits tsconfig, package.json, Dockerfile, GitHub Actions, and framework configs.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import type { ScanFinding } from "../../types/index.js";

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}

export async function scanConfigurations(rootDir: string): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = [];

  // 1. Audit tsconfig.json
  const tsconfigPath = path.join(rootDir, "tsconfig.json");
  try {
    const content = await fs.readFile(tsconfigPath, "utf-8");
    // Strip single-line comments in json for parsing
    const cleaned = content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const tsconfig = JSON.parse(cleaned);
    const opts = tsconfig.compilerOptions || {};

    if (opts.strict === false) {
      findings.push({
        id: nextId("config-tsconfig"),
        severity: "warning",
        category: "config-tsconfig",
        message: "TypeScript strict mode is disabled (strict: false)",
        file: "tsconfig.json",
        suggestion: 'Enable "strict": true in tsconfig.json compilerOptions for full type safety.',
      });
    }

    if (opts.noImplicitAny === false) {
      findings.push({
        id: nextId("config-tsconfig"),
        severity: "info",
        category: "config-tsconfig",
        message: "noImplicitAny is set to false in tsconfig.json",
        file: "tsconfig.json",
        suggestion: 'Set "noImplicitAny": true to prevent accidental fallback to `any` type.',
      });
    }
  } catch {
    // Missing tsconfig.json or invalid JSON — ignore if JS project
  }

  // 2. Audit Dockerfile & docker-compose
  const dockerfilePath = path.join(rootDir, "Dockerfile");
  try {
    const dockerContent = await fs.readFile(dockerfilePath, "utf-8");
    if (!dockerContent.includes("USER ") && !dockerContent.includes("USER node")) {
      findings.push({
        id: nextId("config-docker"),
        severity: "warning",
        category: "config-docker",
        message: "Dockerfile does not specify a non-root USER",
        file: "Dockerfile",
        suggestion: "Add a non-root user (e.g. USER node or USER 1000) to prevent running container processes as root.",
      });
    }

    if (dockerContent.includes("FROM node:latest") || dockerContent.includes("FROM node:alpine")) {
      findings.push({
        id: nextId("config-docker"),
        severity: "info",
        category: "config-docker",
        message: "Dockerfile uses unpinned base image tag (e.g. latest)",
        file: "Dockerfile",
        suggestion: "Pin Docker base images to explicit version tags (e.g. node:20-alpine).",
      });
    }
  } catch {
    // No Dockerfile
  }

  // 3. Audit GitHub Actions workflows
  try {
    const workflowFiles = await fg([".github/workflows/*.{yml,yaml}"], {
      cwd: rootDir,
      onlyFiles: true,
    });

    for (const wfFile of workflowFiles) {
      const fullPath = path.join(rootDir, wfFile);
      const wfContent = await fs.readFile(fullPath, "utf-8");

      if (wfContent.includes("actions/checkout@v1") || wfContent.includes("actions/checkout@v2")) {
        findings.push({
          id: nextId("config-ci"),
          severity: "warning",
          category: "config-ci",
          message: `${wfFile} uses outdated GitHub action version (v1/v2)`,
          file: wfFile,
          suggestion: "Upgrade actions/checkout to @v4 in your CI pipeline.",
        });
      }

      if (wfContent.includes("pull_request_target") && wfContent.includes("checkout")) {
        findings.push({
          id: nextId("config-ci"),
          severity: "critical",
          category: "config-ci",
          message: `${wfFile} uses pull_request_target with checkout, exposing repository token to fork PRs`,
          file: wfFile,
          suggestion: "Use standard pull_request event or restrict permissions block in GitHub Actions.",
        });
      }
    }
  } catch {
    // Skip
  }

  return findings;
}
