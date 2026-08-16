// ─── Framework API Route Detector ─────────────────────────────────────────────
// Normalizes route definitions across Express, Fastify, Next.js, FastAPI, DRF, & Rails.
// ─────────────────────────────────────────────────────────────────────────────

import path from "node:path";
import fg from "fast-glob";
import fs from "node:fs/promises";
import type { APIRouteInfo, HTTPMethod } from "./types.js";

let routeCounter = 0;

function nextRouteId(): string {
  return `route-${Date.now()}-${++routeCounter}`;
}

export async function detectApiRoutes(
  rootDir: string,
  files?: Array<{ path: string; content: string }>
): Promise<APIRouteInfo[]> {
  const routes: APIRouteInfo[] = [];

  let filePayloads: Array<{ path: string; content: string }> = [];
  if (files) {
    filePayloads = files;
  } else {
    const matchedFiles = await fg(["**/*.{ts,js,tsx,jsx,py,rb}"], {
      cwd: rootDir,
      ignore: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**", "**/vendor/**", "**/venv/**"],
      onlyFiles: true,
    });

    for (const relPath of matchedFiles) {
      const fullPath = path.join(rootDir, relPath);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.size > 512_000) continue;
        const content = await fs.readFile(fullPath, "utf-8");
        filePayloads.push({ path: relPath, content });
      } catch {
        // Skip unreadable files
      }
    }
  }

  for (const file of filePayloads) {
    const ext = path.extname(file.path).toLowerCase();
    const normalizedPath = file.path.replace(/\\/g, "/");

    // 1. Next.js App Router route handlers (e.g. app/api/users/route.ts)
    if (normalizedPath.match(/(?:^|\/)(?:src\/)?app\/.*route\.(?:ts|js|jsx|tsx)$/i)) {
      extractNextJsAppRoutes(normalizedPath, file.content, routes);
    }
    // 2. Next.js Pages Router API routes (e.g. pages/api/users.ts)
    else if (normalizedPath.match(/(?:^|\/)(?:src\/)?pages\/api\/.*\.(?:ts|js|jsx|tsx)$/i)) {
      extractNextJsPagesRoutes(normalizedPath, file.content, routes);
    }

    // 3. Express & Fastify routes (JS/TS files)
    if (ext === ".ts" || ext === ".js" || ext === ".tsx" || ext === ".jsx") {
      extractExpressFastifyRoutes(normalizedPath, file.content, routes);
    }

    // 4. FastAPI & Django REST Framework (Python files)
    if (ext === ".py") {
      extractFastApiRoutes(normalizedPath, file.content, routes);
      extractDjangoRoutes(normalizedPath, file.content, routes);
    }

    // 5. Rails routes & controllers (Ruby files)
    if (ext === ".rb" || normalizedPath.endsWith("routes.rb")) {
      extractRailsRoutes(normalizedPath, file.content, routes);
    }
  }

  return routes;
}

function extractNextJsAppRoutes(
  filePath: string,
  content: string,
  outRoutes: APIRouteInfo[]
): void {
  // Infer route path from folder structure: e.g. app/api/users/route.ts -> /api/users
  let apiPath = filePath
    .replace(/^.*?(?:src\/)?app\//i, "/")
    .replace(/\/route\.(?:ts|js|jsx|tsx)$/i, "");
  if (!apiPath.startsWith("/")) apiPath = "/" + apiPath;
  apiPath = apiPath.replace(/\[([^\]]+)\]/g, ":$1"); // Convert [id] to :id

  const lines = content.split("\n");
  const methods: HTTPMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD", "ALL"];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const method of methods) {
      const funcRegex = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`, "i");
      const constRegex = new RegExp(`export\\s+const\\s+${method}\\b`, "i");

      if (funcRegex.test(line) || constRegex.test(line)) {
        // Extract function block
        const handlerContent = extractFunctionBlock(lines, i);
        outRoutes.push({
          id: nextRouteId(),
          method: method,
          path: apiPath || "/",
          handlerFile: filePath,
          handlerLine: i + 1,
          framework: "nextjs",
          codeSnippet: line.trim(),
          handlerContent,
        });
      }
    }
  }
}

function extractNextJsPagesRoutes(
  filePath: string,
  content: string,
  outRoutes: APIRouteInfo[]
): void {
  let apiPath = filePath
    .replace(/^.*?(?:src\/)?pages\//i, "/")
    .replace(/\.(?:ts|js|jsx|tsx)$/i, "")
    .replace(/\/index$/i, "");
  if (!apiPath.startsWith("/")) apiPath = "/" + apiPath;
  apiPath = apiPath.replace(/\[([^\]]+)\]/g, ":$1");

  const lines = content.split("\n");
  const reqMethodMatches = content.matchAll(/req\.method\s*===\s*['"](GET|POST|PUT|PATCH|DELETE)['"]/gi);
  const foundMethods = new Set<HTTPMethod>();
  for (const m of reqMethodMatches) {
    if (m[1]) foundMethods.add(m[1].toUpperCase() as HTTPMethod);
  }

  if (foundMethods.size === 0) {
    // Catch-all or default handler
    outRoutes.push({
      id: nextRouteId(),
      method: "ALL",
      path: apiPath,
      handlerFile: filePath,
      handlerLine: 1,
      framework: "nextjs",
      codeSnippet: lines[0] || "export default handler",
      handlerContent: content,
    });
  } else {
    for (const method of foundMethods) {
      outRoutes.push({
        id: nextRouteId(),
        method: method,
        path: apiPath,
        handlerFile: filePath,
        handlerLine: 1,
        framework: "nextjs",
        codeSnippet: `req.method === '${method}'`,
        handlerContent: content,
      });
    }
  }
}

function extractExpressFastifyRoutes(
  filePath: string,
  content: string,
  outRoutes: APIRouteInfo[]
): void {
  const lines = content.split("\n");
  // Match app.get('/path', ...), router.post('/path', ...), fastify.post('/path', ...), app.all(...)
  const routeRegex = /(?:app|router|fastify|server)\.(get|post|put|patch|delete|all|use|route)\s*\(\s*['"`]([^'"`]+)['"`]/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    routeRegex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = routeRegex.exec(line)) !== null) {
      const rawMethod = match[1]!.toUpperCase();
      const routePath = match[2]!;
      const method: HTTPMethod = rawMethod === "ALL" || rawMethod === "USE" ? "ALL" : (rawMethod as HTTPMethod);

      const isFastify = content.includes("fastify") || content.includes("Fastify");
      const framework = isFastify ? "fastify" : "express";
      const handlerContent = extractFunctionBlock(lines, i);

      outRoutes.push({
        id: nextRouteId(),
        method,
        path: routePath,
        handlerFile: filePath,
        handlerLine: i + 1,
        framework,
        codeSnippet: line.trim(),
        handlerContent,
      });
    }
  }
}

function extractFastApiRoutes(
  filePath: string,
  content: string,
  outRoutes: APIRouteInfo[]
): void {
  const lines = content.split("\n");
  // @app.get("/path"), @router.post("/path"), @app.api_route("/path", methods=["GET", "POST"])
  const decoratorRegex = /@(app|router|api_router)\.(get|post|put|patch|delete|api_route)\s*\(\s*["']([^"']+)["']/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    decoratorRegex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = decoratorRegex.exec(line)) !== null) {
      const rawMethod = match[2]!.toUpperCase();
      const routePath = match[3]!;
      const method: HTTPMethod = rawMethod === "API_ROUTE" ? "ALL" : (rawMethod as HTTPMethod);

      const handlerContent = extractPythonDefBlock(lines, i);

      outRoutes.push({
        id: nextRouteId(),
        method,
        path: routePath,
        handlerFile: filePath,
        handlerLine: i + 1,
        framework: "fastapi",
        codeSnippet: line.trim(),
        handlerContent,
      });
    }
  }
}

function extractDjangoRoutes(
  filePath: string,
  content: string,
  outRoutes: APIRouteInfo[]
): void {
  const lines = content.split("\n");

  // path('api/users/', views.UserView.as_view()) or re_path(...)
  const pathRegex = /(?:path|re_path)\s*\(\s*["']([^"']+)["']/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    pathRegex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pathRegex.exec(line)) !== null) {
      const routePath = "/" + match[1]!.replace(/^\//, "");
      const handlerContent = extractPythonDefBlock(lines, i);

      outRoutes.push({
        id: nextRouteId(),
        method: "ALL",
        path: routePath,
        handlerFile: filePath,
        handlerLine: i + 1,
        framework: "django",
        codeSnippet: line.trim(),
        handlerContent,
      });
    }
  }

  // Also check @api_view(['POST', 'GET']) in views
  const apiViewRegex = /@api_view\s*\(\s*\[([^\]]+)\]\s*\)/gi;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    apiViewRegex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = apiViewRegex.exec(line)) !== null) {
      const methodsStr = match[1]!;
      const methods = methodsStr.match(/['"](GET|POST|PUT|PATCH|DELETE)['"]/gi) || [];
      const handlerContent = extractPythonDefBlock(lines, i);

      for (const mStr of methods) {
        const m = mStr.replace(/['"]/g, "").toUpperCase() as HTTPMethod;
        outRoutes.push({
          id: nextRouteId(),
          method: m,
          path: filePath,
          handlerFile: filePath,
          handlerLine: i + 1,
          framework: "django",
          codeSnippet: line.trim(),
          handlerContent,
        });
      }
    }
  }
}

function extractRailsRoutes(
  filePath: string,
  content: string,
  outRoutes: APIRouteInfo[]
): void {
  const lines = content.split("\n");
  const routeRegex = /(get|post|put|patch|delete|match)\s+["']([^"']+)["']/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    routeRegex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = routeRegex.exec(line)) !== null) {
      const rawMethod = match[1]!.toUpperCase();
      const routePath = match[2]!;
      const method: HTTPMethod = rawMethod === "MATCH" ? "ALL" : (rawMethod as HTTPMethod);

      outRoutes.push({
        id: nextRouteId(),
        method,
        path: routePath,
        handlerFile: filePath,
        handlerLine: i + 1,
        framework: "rails",
        codeSnippet: line.trim(),
        handlerContent: extractRubyDefBlock(lines, i),
      });
    }
  }

  // resources :users
  const resourcesRegex = /resources\s+:([a-zA-Z0-9_]+)/gi;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    resourcesRegex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = resourcesRegex.exec(line)) !== null) {
      const resource = match[1]!;
      const stdMethods: HTTPMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
      for (const m of stdMethods) {
        outRoutes.push({
          id: nextRouteId(),
          method: m,
          path: `/${resource}`,
          handlerFile: filePath,
          handlerLine: i + 1,
          framework: "rails",
          codeSnippet: line.trim(),
          handlerContent: extractRubyDefBlock(lines, i),
        });
      }
    }
  }
}

function extractFunctionBlock(lines: string[], startIdx: number): string {
  const endIdx = Math.min(lines.length, startIdx + 40);
  return lines.slice(startIdx, endIdx).join("\n");
}

function extractPythonDefBlock(lines: string[], startIdx: number): string {
  const endIdx = Math.min(lines.length, startIdx + 40);
  return lines.slice(startIdx, endIdx).join("\n");
}

function extractRubyDefBlock(lines: string[], startIdx: number): string {
  const endIdx = Math.min(lines.length, startIdx + 40);
  return lines.slice(startIdx, endIdx).join("\n");
}
