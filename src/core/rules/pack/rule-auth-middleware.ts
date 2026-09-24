import path from "node:path";
import type { Finding } from "../../finding/types.js";
import { toAgentFinding } from "../../finding/mapper.js";
import type { ScanFinding } from "../../../types/index.js";

const AUTH_MIDDLEWARE_REGEX =
  /\b(?:requireAuth|authenticate|verifyToken|checkAuth|ensureAuthenticated|passport\.authenticate|withAuth|protect|authMiddleware|auth)\b/;

const NEXT_SESSION_REGEX = /\b(?:getServerSession|verifySession|auth\(\))\b/;

const SENSITIVE_ROUTE_PATTERNS = [
  /\/admin\b/i,
  /\/user(?:s)?\/(?:settings|profile|delete|update)\b/i,
  /\/billing\b/i,
  /\/account\b/i,
  /\/keys\b/i,
  /\/orders\b/i,
];

export function evaluateRouteAuthMiddleware(
  filePath: string,
  content: string,
): Finding[] {
  const findings: Finding[] = [];
  const normalizedPath = filePath.replace(/\\/g, "/");

  // Check 1: Express/Fastify style: app.post('/path', ...), router.delete(...)
  const lines = content.split("\n");
  const routeRegex =
    /(?:app|router)\.(post|put|delete|patch)\s*\(\s*["'`]([^"'`]+)["'`](.*)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const match = line.match(routeRegex);

    if (match) {
      const method = match[1]!.toUpperCase();
      const routePath = match[2]!;
      const restOfLine = match[3] || "";

      // Check if route is sensitive or mutative
      const isSensitive = SENSITIVE_ROUTE_PATTERNS.some((re) =>
        re.test(routePath),
      );

      if (isSensitive) {
        // Strip out single-line comment if any at end of line
        const codeOnly = restOfLine.replace(/\/\/.*$/, "");
        const hasAuth = AUTH_MIDDLEWARE_REGEX.test(codeOnly);

        if (!hasAuth) {
          const raw: ScanFinding = {
            id: `auth-missing-route-${Date.now()}-${i}`,
            ruleId: "RULE-AUTH-001",
            severity: "critical",
            category: "framework-warning",
            message: `Missing authentication middleware on sensitive ${method} route: '${routePath}'`,
            file: filePath,
            line: i + 1,
            preview: line.trim(),
            suggestion:
              "Attach authentication middleware (e.g. requireAuth, verifyToken) to protect this endpoint.",
          };
          findings.push(
            toAgentFinding(raw, { surroundingSnippet: line.trim() }),
          );
        }
      }
    }
  }

  // Check 2: Next.js App Router (route.ts in app/api/...)
  if (
    normalizedPath.includes("app/api/admin") ||
    normalizedPath.includes("app/api/billing")
  ) {
    const hasNextAuth = NEXT_SESSION_REGEX.test(content);
    if (!hasNextAuth) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (
          /export\s+(?:async\s+)?function\s+(POST|PUT|DELETE|PATCH)\b/i.test(
            line,
          )
        ) {
          const raw: ScanFinding = {
            id: `auth-missing-nextjs-${Date.now()}-${i}`,
            ruleId: "RULE-AUTH-001",
            severity: "critical",
            category: "framework-warning",
            message: `Next.js sensitive route handler lacks session verification or auth guard.`,
            file: filePath,
            line: i + 1,
            preview: line.trim(),
            suggestion:
              "Call auth() or getServerSession() before executing mutations in sensitive route handlers.",
          };
          findings.push(
            toAgentFinding(raw, { surroundingSnippet: line.trim() }),
          );
        }
      }
    }
  }

  return findings;
}
