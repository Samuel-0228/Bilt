// ─── Unified Bilt Project Model ───────────────────────────────────────────────
// Single discovery pass aggregating framework info, files, route map, components,
// env, dependencies, design brief, and requirements into a single ProjectModel.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import type { FrameworkInfo } from "../../types/index.js";
import { detectEcosystem } from "../ecosystem/detector.js";
import { extractRouteMap } from "../readiness/route-map.js";
import type { RouteMapEntry } from "../readiness/check-runner.js";
import { readDesignBrief } from "../design/brief/storage.js";
import type { DesignBrief } from "../design/brief/types.js";
import { loadRequirementsContract, type Requirement } from "../contract/requirements.js";
import { MAX_FILE_SIZE } from "../readiness/cache.js";

export interface FileInfo {
  path: string;
  absolutePath: string;
  size: number;
  content: string;
}

export interface DependencyInfo {
  name: string;
  version: string;
  isDev: boolean;
}

export interface AuthModel {
  detected: boolean;
  providers: string[];
  hasMiddleware: boolean;
}

export interface AuthorizationModel {
  detected: boolean;
  hasRoleChecks: boolean;
  unprotectedRoutesCount: number;
}

export interface DatabaseModel {
  detected: boolean;
  orm?: string;
  hasDirectQueries: boolean;
}

export interface EnvironmentModel {
  envFiles: string[];
  missingVarsCount: number;
}

export interface ProjectModel {
  rootDir: string;
  framework?: FrameworkInfo;
  files: FileInfo[];
  dependencies: DependencyInfo[];
  routes: RouteMapEntry[];
  auth: AuthModel;
  authorization: AuthorizationModel;
  database: DatabaseModel;
  environment: EnvironmentModel;
  requirements: Requirement[];
  designBrief?: DesignBrief;
  timestamp: string;
}

/**
 * Discover and build a unified ProjectModel for a directory.
 */
export async function buildProjectModel(rootDir: string): Promise<ProjectModel> {
  const absoluteRoot = path.resolve(rootDir);

  // 1. Detect Ecosystem & Framework
  const ecosystem = await detectEcosystem(absoluteRoot);
  const primaryFw = ecosystem.primaryFramework;
  const framework: FrameworkInfo | undefined = primaryFw
    ? {
        name: primaryFw.id,
        displayName: primaryFw.name,
        clientExposedPrefixes: ecosystem.clientExposedPrefixes,
        configFiles: primaryFw.configFiles || [],
      }
    : undefined;

  // 2. Load Project Files
  const filePaths = await fg(
    [
      "**/*.ts",
      "**/*.js",
      "**/*.tsx",
      "**/*.jsx",
      "**/*.mjs",
      "**/*.cjs",
      "**/*.json",
      "**/*.yml",
      "**/*.yaml",
      "**/.env*",
      "**/Dockerfile*",
      "**/docker-compose*",
    ],
    {
      cwd: absoluteRoot,
      ignore: [
        "node_modules/**",
        "dist/**",
        "build/**",
        ".git/**",
        "coverage/**",
        ".next/**",
        ".nuxt/**",
        ".cache/**",
        "tests/**",
        "test/**",
        "**/fixtures/**",
      ],
      absolute: true,
      dot: true,
    },
  );

  const files: FileInfo[] = [];
  for (const fPath of filePaths) {
    try {
      const stat = await fs.stat(fPath);
      if (stat.size > MAX_FILE_SIZE) continue;
      const relPath = path.relative(absoluteRoot, fPath).replace(/\\/g, "/");
      const content = await fs.readFile(fPath, "utf-8");
      files.push({
        path: relPath,
        absolutePath: fPath,
        size: stat.size,
        content,
      });
    } catch {
      // Skip unreadable files
    }
  }

  // 3. Extract Route Map
  const routes = await extractRouteMap(absoluteRoot, files);

  // 4. Dependencies
  const dependencies: DependencyInfo[] = [];
  try {
    const pkgRaw = await fs.readFile(path.join(absoluteRoot, "package.json"), "utf-8");
    const pkg = JSON.parse(pkgRaw);
    if (pkg.dependencies) {
      for (const [name, version] of Object.entries(pkg.dependencies)) {
        dependencies.push({ name, version: String(version), isDev: false });
      }
    }
    if (pkg.devDependencies) {
      for (const [name, version] of Object.entries(pkg.devDependencies)) {
        dependencies.push({ name, version: String(version), isDev: true });
      }
    }
  } catch {
    // package.json missing or unparseable
  }

  // 5. Auth / Authz / DB / Env Models
  const authProviders: string[] = [];
  let hasAuthMiddleware = false;
  let hasRoleChecks = false;
  let hasDirectDb = false;
  let dbOrm: string | undefined;

  for (const file of files) {
    const lower = file.content.toLowerCase();
    if (lower.includes("jsonwebtoken") || lower.includes("jwt")) authProviders.push("jwt");
    if (lower.includes("passport")) authProviders.push("passport");
    if (lower.includes("@clerk") || lower.includes("clerk")) authProviders.push("clerk");
    if (lower.includes("next-auth") || lower.includes("auth.js")) authProviders.push("next-auth");
    if (lower.includes("supabase") && lower.includes("auth")) authProviders.push("supabase");

    if (lower.includes("authenticate") || lower.includes("authguard") || lower.includes("requireauth")) {
      hasAuthMiddleware = true;
    }
    if (lower.includes("role ===") || lower.includes("hasrole") || lower.includes("permission")) {
      hasRoleChecks = true;
    }
    if (lower.includes("prisma")) dbOrm = "prisma";
    if (lower.includes("drizzle")) dbOrm = "drizzle";
    if (lower.includes("typeorm")) dbOrm = "typeorm";
    if (lower.includes("mongoose")) dbOrm = "mongoose";
    if (lower.includes("SELECT ") || lower.includes("INSERT INTO ")) hasDirectDb = true;
  }

  const envFiles = files.filter((f) => path.basename(f.path).startsWith(".env")).map((f) => f.path);

  // 6. Contract Requirements & Design Brief
  const reqContract = await loadRequirementsContract(absoluteRoot);
  const designBrief = await readDesignBrief(absoluteRoot);

  return {
    rootDir: absoluteRoot,
    framework,
    files,
    dependencies,
    routes,
    auth: {
      detected: authProviders.length > 0 || hasAuthMiddleware,
      providers: Array.from(new Set(authProviders)),
      hasMiddleware: hasAuthMiddleware,
    },
    authorization: {
      detected: hasRoleChecks,
      hasRoleChecks,
      unprotectedRoutesCount: routes.filter((r) => !r.path.includes("auth")).length,
    },
    database: {
      detected: !!dbOrm || hasDirectDb,
      orm: dbOrm,
      hasDirectQueries: hasDirectDb,
    },
    environment: {
      envFiles,
      missingVarsCount: 0,
    },
    requirements: reqContract.requirements,
    designBrief: designBrief || undefined,
    timestamp: new Date().toISOString(),
  };
}
