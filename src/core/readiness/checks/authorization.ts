// ─── Authorization Readiness Check ──────────────────────────────────────────
// Guided inspection for resource ownership, IDOR, and role-based permissions.
// Status: GUIDED — requires verification of server-side resource ownership.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReadinessCategory } from "../taxonomy.js";
import type { BiltCheckFinding, CheckMode } from "../finding.js";
import type { CategoryChecker, CheckContext } from "../check-runner.js";
import { generateCheckFingerprint } from "../finding.js";

const CATEGORY: ReadinessCategory = "authorization";

export const authorizationChecker: CategoryChecker = {
  category: CATEGORY,
  mode: "guided" as CheckMode,

  async run(context: CheckContext): Promise<BiltCheckFinding[]> {
    const findings: BiltCheckFinding[] = [];

    // Check 1: RouteMap inspection for ID-based routes (IDOR risk)
    const idRoutes = context.routeMap.filter((r) => {
      const p = r.path.toLowerCase();
      return (
        p.includes("/:") ||
        p.includes("[") ||
        r.resourceIdParam !== undefined ||
        /\/(users|orders|accounts|documents|items|profiles|messages|posts)\//.test(p)
      );
    });

    for (const route of idRoutes) {
      // Look for ownership checks in handler file/content
      const fileEntry = context.files.find((f) => f.path.replace(/\\/g, "/").endsWith(route.file.replace(/\\/g, "/")));
      const content = fileEntry?.content || "";

      const hasOwnershipCheck =
        /userId|user_id|session\.user|auth\.user|req\.user|currentUser|accountId|ownerId|where:\s*\{\s*id.*userId/i.test(content);

      if (!hasOwnershipCheck) {
        findings.push({
          ruleId: "AUTHZ-GUIDED-001",
          category: CATEGORY,
          mode: "guided",
          severity: "high",
          precision: "medium",
          maturity: "stable",
          status: "needs-review",
          title: `Resource ownership verification needed for ${route.method} ${route.path}`,
          whyItMatters:
            "Anyone may be able to access or mutate another user's private resource " +
            "simply by changing the resource ID in the URL parameter (Insecure Direct Object Reference / IDOR).",
          technicalDetail:
            `Route ${route.method} ${route.path} in ${route.file}:${route.line} accesses ` +
            "a parameterized resource without an obvious server-side ownership or permission check.",
          agentAction:
            "Verify that the route handler checks whether the authenticated user owns or is authorized " +
            "to access the requested resource. Enforce server-side ownership checks in database queries.",
          evidenceRequired: true,
          fixable: false,
          file: route.file,
          line: route.line,
          fingerprint: generateCheckFingerprint("AUTHZ-GUIDED-001", route.file, route.line),
        });
      }
    }

    // Check 2: Client-side role/admin bypass patterns
    for (const file of context.files) {
      const normalizedPath = file.path.replace(/\\/g, "/");
      if (
        normalizedPath.includes("/node_modules/") ||
        normalizedPath.includes("/dist/") ||
        normalizedPath.includes("/build/") ||
        normalizedPath.includes("/.git/") ||
        normalizedPath.includes("/security-engine/") ||
        normalizedPath.includes("/core/rules/") ||
        normalizedPath.includes("/readiness/")
      ) {
        continue;
      }

      const lines = file.content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (
          /req\.body\.(isAdmin|is_admin|role|permissions)\b/i.test(line) &&
          !normalizedPath.includes("/test")
        ) {
          findings.push({
            ruleId: "AUTHZ-AUTO-002",
            category: CATEGORY,
            mode: "automated",
            severity: "critical",
            precision: "high",
            maturity: "stable",
            status: "fail",
            title: "Client-controlled authorization role or admin flag",
            whyItMatters:
              "Allowing users to submit their own role or admin flag in the request body " +
              "allows attackers to escalate their privileges to administrator status.",
            technicalDetail:
              `${file.path}:${i + 1} extracts 'isAdmin' or 'role' directly from the client request body. ` +
              "Privileges must be assigned server-side from a trusted database session.",
            agentAction:
              "Remove client-controlled role assignment. Roles must only be read from authenticated server sessions.",
            fixable: false,
            file: file.path,
            line: i + 1,
            fingerprint: generateCheckFingerprint("AUTHZ-AUTO-002", file.path, i + 1),
          });
        }
      }
    }

    // If no ID routes were found but routes exist, add guided confirmation
    if (findings.length === 0 && context.routeMap.length > 0) {
      // General guided check for route authorization
      findings.push({
        ruleId: "AUTHZ-GUIDED-002",
        category: CATEGORY,
        mode: "guided",
        severity: "medium",
        precision: "low",
        maturity: "stable",
        status: "needs-review",
        title: "Verify multi-tenant resource isolation and authorization guards",
        whyItMatters:
          "Multi-user applications must ensure that every API endpoint validates tenant and user permissions.",
        technicalDetail:
          `Discovered ${context.routeMap.length} endpoints. Verify server-side permission gates exist for sensitive operations.`,
        agentAction:
          "Confirm that private routes are protected by authorization middleware and cannot be queried anonymously.",
        evidenceRequired: true,
        fixable: false,
        fingerprint: generateCheckFingerprint("AUTHZ-GUIDED-002", "routes"),
      });
    }

    return findings;
  },
};
