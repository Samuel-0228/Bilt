// ─── HTTP Method Allowlisting Detector ───────────────────────────────────────
// Flags wildcard or catch-all route handlers (e.g. app.all, ALL handlers).
// ─────────────────────────────────────────────────────────────────────────────

import type { ScanFinding } from "../../types/index.js";
import type { APIRouteInfo } from "./types.js";

let findingCounter = 0;
function nextFindingId(): string {
  return `api-wildcard-method-${Date.now()}-${++findingCounter}`;
}

export function detectMethodAllowlisting(routes: APIRouteInfo[]): ScanFinding[] {
  const findings: ScanFinding[] = [];

  for (const route of routes) {
    if (route.method === "ALL" || route.method === "WILDCARD") {
      const headline = `Wildcard HTTP method matcher on ${route.path}`;
      const why = `Route handler accepts any HTTP method (GET/POST/PUT/DELETE/etc.) instead of enforcing an explicit allowlist of permitted HTTP methods.`;
      const action = `Restrict the route to specific HTTP methods (e.g., app.get() / app.post() or export async function GET / POST instead of app.all() / export async function ALL).`;

      findings.push({
        id: nextFindingId(),
        severity: "warning",
        category: "api-wildcard-method",
        message: headline,
        file: route.handlerFile,
        line: route.handlerLine,
        suggestion: action,
        confidence: "high",
        aiExplanation: {
          whatIsIt: `Unrestricted HTTP method allowlist on ${route.path}. The handler processes requests using a catch-all method matcher.`,
          whyIsItAProblem: why,
          howSerious: `WARNING — unexpected HTTP methods (e.g. TRACE, HEAD, SEARCH) could bypass auth checks or trigger unintended code paths.`,
          canItBeExploited: `An attacker can send unexpected HTTP methods to probe the handler or bypass method-specific middleware filters.`,
          howToFix: action,
          canBiltFix: false,
        },
        knowledge: {
          provider: "bilt-api-security",
          type: "api-wildcard-method",
          whatItIs: `Wildcard HTTP method on ${route.path}`,
          why,
          safeAsPublic: false,
          action,
          docsUrl: "https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/06-Test_HTTP_Methods",
        },
      });
    }
  }

  return findings;
}
