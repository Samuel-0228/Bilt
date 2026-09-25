// ─── API Abuse & Cost Protection Readiness Check ──────────────────────────────
// Guided inspection for unauthenticated expensive operations, AI endpoints,
// rate limiting, and runaway cloud cost vectors.
// Status: GUIDED — mandatory pre-production check for AI applications.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReadinessCategory } from "../taxonomy.js";
import type { BiltCheckFinding, CheckMode } from "../finding.js";
import type { CategoryChecker, CheckContext } from "../check-runner.js";
import { generateCheckFingerprint } from "../finding.js";

const CATEGORY: ReadinessCategory = "api-abuse-and-cost";

export const apiAbuseAndCostChecker: CategoryChecker = {
  category: CATEGORY,
  mode: "guided" as CheckMode,

  async run(context: CheckContext): Promise<BiltCheckFinding[]> {
    const findings: BiltCheckFinding[] = [];

    // Check 1: AI / Paid API invocations in endpoints
    for (const file of context.files) {
      const normalizedPath = file.path.replace(/\\/g, "/");
      if (
        normalizedPath.includes("/node_modules/") ||
        normalizedPath.includes("/dist/") ||
        normalizedPath.includes("/build/") ||
        normalizedPath.includes("/test")
      ) {
        continue;
      }

      const content = file.content;
      const isRoute =
        normalizedPath.includes("/api/") ||
        normalizedPath.includes("/routes/") ||
        normalizedPath.endsWith("route.ts") ||
        normalizedPath.endsWith("route.js");

      const callsExpensiveApi =
        /openai|anthropic|chat\.completions|generateContent|replicate|elevenlabs|twilio\.messages|resend\.emails|sendgrid/i.test(
          content,
        );

      if (isRoute && callsExpensiveApi) {
        const hasRateLimit =
          /rateLimit|ratelimit|upstash\/ratelimit|limiter|throttle/i.test(content);
        const hasAuth =
          /session|auth|currentUser|req\.user|userId|getServerSession|getAuth/i.test(
            content,
          );

        if (!hasRateLimit || !hasAuth) {
          findings.push({
            ruleId: "ABUSE-GUIDED-001",
            category: CATEGORY,
            mode: "guided",
            severity: "high",
            precision: "high",
            maturity: "stable",
            status: "needs-review",
            title: `Paid API / AI provider called without evident rate limiting or auth in ${file.path}`,
            whyItMatters:
              "An unauthenticated or un-throttled endpoint invoking external AI APIs (OpenAI, Anthropic, etc.) " +
              "allows attackers or bots to spam requests and exhaust your API credits, generating unexpected bills.",
            technicalDetail:
              `${file.path} invokes expensive downstream third-party services. ` +
              `Auth check present: ${hasAuth}. Rate limiting present: ${hasRateLimit}.`,
            agentAction:
              "Require authentication for all AI / paid endpoints and add IP- or user-based rate limiting " +
              "(e.g., using @upstash/ratelimit or express-rate-limit).",
            evidenceRequired: true,
            fixable: false,
            file: file.path,
            line: 1,
            fingerprint: generateCheckFingerprint("ABUSE-GUIDED-001", file.path, 1),
          });
        }
      }
    }

    // Check 2: Global rate limiting check across all detected routes
    const hasGlobalRateLimiter = context.files.some((f) =>
      /rateLimit|upstash\/ratelimit|express-rate-limit|fastify-rate-limit/i.test(
        f.content,
      ),
    );

    if (context.routeMap.length > 3 && !hasGlobalRateLimiter) {
      findings.push({
        ruleId: "ABUSE-GUIDED-002",
        category: CATEGORY,
        mode: "guided",
        severity: "medium",
        precision: "medium",
        maturity: "stable",
        status: "needs-review",
        title: "No global or route-level rate limiting middleware detected",
        whyItMatters:
          "Public APIs without rate limiting are susceptible to credential stuffing, brute-force attacks, " +
          "and Denial of Service (DoS) from repetitive automated requests.",
        technicalDetail:
          `Application has ${context.routeMap.length} routes, but no rate limiting middleware was found in dependencies or code.`,
        agentAction:
          "Install and configure rate limiting middleware (such as express-rate-limit or Upstash Redis rate limiting).",
        evidenceRequired: true,
        fixable: false,
        fingerprint: generateCheckFingerprint("ABUSE-GUIDED-002", "global-rate-limit"),
      });
    }

    return findings;
  },
};
