import type { SecurityRule, SecurityFindingDetails } from "../types.js";

export const businessLogicRules: SecurityRule[] = [
  // 1. Unlimited Password Reset / OTP Generation / Login Attempts (Missing Rate Limiting)
  {
    id: "SEC-BUS-001",
    category: "business-logic",
    severity: "warning",
    title: "Missing Rate Limiting on Sensitive Endpoint",
    frameworks: ["express", "nextjs", "all"],
    provider: "none",
    description: "Sensitive route (login, password-reset, otp, coupon) lacks rate limiting guard middleware.",
    whyThisIsDangerous:
      "Endpoints without rate limiting allow automated brute-force, credential stuffing, and SMS/OTP flooding attacks.",
    howAttackersAbuseIt:
      "Attacker sends 100,000 login attempts per minute to brute-force user accounts or trigger high SMS fees.",
    suggestedFix: "Apply express-rate-limit or Redis rate-limiting middleware to login and OTP endpoints.",
    owaspMapping: "A04:2021 - Insecure Design",
    cwe: "CWE-307",
    testCases: [
      {
        name: "Detect un-limited login route",
        code: `app.post('/api/login', async (req, res) => { /* login */ });`,
        shouldMatch: true,
      },
    ],
    match: (astContext) => {
      const findings: SecurityFindingDetails[] = [];
      const lines = astContext.fileContent.split("\n");

      lines.forEach((lineText, idx) => {
        const lineNum = idx + 1;
        const lower = lineText.toLowerCase();

        if (
          (lower.includes("/login") || lower.includes("/reset-password") || lower.includes("/otp") || lower.includes("/coupon")) &&
          (lower.includes("post(") || lower.includes("post(")) &&
          !lower.includes("limiter") &&
          !lower.includes("ratelimit") &&
          !astContext.fileContent.includes("rateLimit")
        ) {
          findings.push({
            ruleId: "SEC-BUS-001",
            category: "business-logic" as const,
            severity: "warning" as const,
            confidence: "medium" as const,
            title: "Missing Rate Limiting on Sensitive Endpoint",
            message: `Sensitive endpoint at line ${lineNum} lacks rate-limiting protection.`,
            evidence: {
              file: astContext.filePath,
              line: lineNum,
              snippet: lineText.trim(),
            },
            affectedFiles: [astContext.filePath],
            affectedLines: [lineNum],
            whyThisIsDangerous: "Endpoints without rate limiting invite brute-force and resource exhaustion attacks.",
            howAttackersAbuseIt: "Attacker runs automated credential stuffing scripts against the login route.",
            suggestedFix: "Add rate-limiting middleware to restrict consecutive requests per IP/user.",
            automaticFixAvailability: { available: false },
            documentation: {
              owasp: "A04:2021-Insecure Design",
              cwe: "CWE-307",
            },
            owaspMapping: "A04:2021 - Insecure Design",
          });
        }
      });

      return findings;
    },
  },

  // 2. Financial / Balance Mutation Missing Transaction Rollback / Race Conditions
  {
    id: "SEC-BUS-002",
    category: "business-logic",
    severity: "warning",
    title: "Database State Mutation Without Transaction Isolation",
    frameworks: ["all"],
    provider: "none",
    description: "Financial, balance, or inventory updates executed sequentially without database transaction locks or atomic operations.",
    whyThisIsDangerous:
      "Executing balance deductions or coupon usages in non-atomic operations leads to Race Conditions (TOCTOU) where multiple concurrent requests duplicate funds or reuse single-use coupons.",
    howAttackersAbuseIt:
      "Attacker sends 50 concurrent requests simultaneously for a single $10 coupon, redeeming $500 total value.",
    suggestedFix: "Wrap operations in a database transaction (`db.transaction()`) with atomic SQL increment/decrement queries.",
    owaspMapping: "A04:2021 - Insecure Design",
    cwe: "CWE-362",
    testCases: [
      {
        name: "Detect balance read then write without transaction",
        code: `const user = await db.getUser(id); await db.updateBalance(id, user.balance - price);`,
        shouldMatch: true,
      },
    ],
    match: (astContext) => {
      const findings: SecurityFindingDetails[] = [];
      const lines = astContext.fileContent.split("\n");

      lines.forEach((lineText, idx) => {
        const lineNum = idx + 1;
        const lower = lineText.toLowerCase();

        if (
          (lower.includes("updatebalance") || lower.includes("balance -") || lower.includes("inventory -")) &&
          !lower.includes("transaction") &&
          !lower.includes("atomic")
        ) {
          findings.push({
            ruleId: "SEC-BUS-002",
            category: "business-logic" as const,
            severity: "warning" as const,
            confidence: "medium" as const,
            title: "Database State Mutation Without Transaction Isolation",
            message: `Balance/inventory update at line ${lineNum} missing atomic transaction isolation.`,
            evidence: {
              file: astContext.filePath,
              line: lineNum,
              snippet: lineText.trim(),
            },
            affectedFiles: [astContext.filePath],
            affectedLines: [lineNum],
            whyThisIsDangerous: "Non-atomic state mutations are vulnerable to race conditions.",
            howAttackersAbuseIt: "Attacker issues concurrent requests to exploit time-of-check to time-of-use gaps.",
            suggestedFix: "Use atomic database transactions or atomic SQL updates.",
            automaticFixAvailability: { available: false },
            documentation: {
              owasp: "A04:2021-Insecure Design",
              cwe: "CWE-362",
            },
            owaspMapping: "A04:2021 - Insecure Design",
          });
        }
      });

      return findings;
    },
  },
];
