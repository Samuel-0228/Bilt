import type { SecurityRule, SecurityFindingDetails } from "../types.js";
import { ASTAnalyzer } from "../ast-analyzer.js";

export const authzRules: SecurityRule[] = [
  // 1. Client decides permissions (isAdmin from req.body / req.query / localStorage)
  {
    id: "SEC-AUTHZ-001",
    category: "authorization",
    severity: "critical",
    title: "Client-Supplied Privilege Flag",
    frameworks: ["all"],
    provider: "none",
    description: "Authorization role or isAdmin status is trusted directly from client request body or localStorage.",
    whyThisIsDangerous:
      "Clients control request parameters. Trusting `req.body.isAdmin` or `localStorage.getItem('role')` allows any HTTP client to self-grant administrator rights.",
    howAttackersAbuseIt:
      "An attacker sends `{ \"isAdmin\": true, \"role\": \"admin\" }` in the POST/PUT payload to elevate their privileges to site superuser.",
    suggestedFix: "Derive user permissions exclusively from authenticated server session / verified JWT claims or database lookup.",
    owaspMapping: "A01:2021 - Broken Access Control",
    cwe: "CWE-639",
    docsUrl: "https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html",
    testCases: [
      {
        name: "Detect req.body.isAdmin",
        code: `const isAdmin = req.body.isAdmin || req.body.role === 'admin';`,
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
          (lower.includes("req.body.isadmin") ||
            lower.includes("req.body.role") ||
            lower.includes("req.query.role") ||
            lower.includes("req.params.role") ||
            (lower.includes("localstorage.getitem") && (lower.includes("role") || lower.includes("isadmin")))) &&
          (lower.includes("if") || lower.includes("const") || lower.includes("let"))
        ) {
          findings.push({
            ruleId: "SEC-AUTHZ-001",
            category: "authorization" as const,
            severity: "critical" as const,
            confidence: "high" as const,
            title: "Client-Supplied Privilege Flag",
            message: `User authorization role is taken from untrusted client input at line ${lineNum}: '${lineText.trim()}'.`,
            evidence: {
              file: astContext.filePath,
              line: lineNum,
              snippet: lineText.trim(),
            },
            affectedFiles: [astContext.filePath],
            affectedLines: [lineNum],
            whyThisIsDangerous: "Clients can manipulate HTTP body/query parameters to self-assign admin roles.",
            howAttackersAbuseIt: "Attacker modifies request JSON body to set `isAdmin: true` and access restricted functionality.",
            suggestedFix: "Retrieve roles from server-side database user lookup or verified JWT token claims.",
            automaticFixAvailability: { available: false },
            documentation: {
              owasp: "A01:2021-Broken Access Control",
              cwe: "CWE-639",
            },
            owaspMapping: "A01:2021 - Broken Access Control",
          });
        }
      });

      return findings;
    },
  },

  // 2. Missing Ownership Verification (IDOR)
  {
    id: "SEC-AUTHZ-002",
    category: "authorization",
    severity: "warning",
    title: "Missing Resource Ownership Verification (IDOR)",
    frameworks: ["express", "nextjs", "all"],
    provider: "none",
    description: "Database query fetches or mutates record by route parameter ID without verifying that the record belongs to the authenticated user.",
    whyThisIsDangerous:
      "Insecure Direct Object Reference (IDOR) enables authenticated users to view or tamper with other users' data by changing numeric or UUID route parameters.",
    howAttackersAbuseIt:
      "An attacker changes `/api/users/102/invoices` to `/api/users/103/invoices` to inspect another customer's private financial records.",
    suggestedFix: "Filter database query by both resource ID AND authenticated session user ID: `db.find({ id: req.params.id, userId: session.user.id })`.",
    owaspMapping: "A01:2021 - Broken Access Control",
    cwe: "CWE-639",
    testCases: [
      {
        name: "Detect un-owned findById",
        code: `app.get('/api/doc/:id', async (req, res) => { const doc = await db.findById(req.params.id); res.json(doc); });`,
        shouldMatch: true,
      },
    ],
    match: (astContext) => {
      const findings: SecurityFindingDetails[] = [];
      const lines = astContext.fileContent.split("\n");

      if (!astContext.isBackend) return findings;

      lines.forEach((lineText, idx) => {
        const lineNum = idx + 1;
        const lower = lineText.toLowerCase();

        if (
          (lower.includes("req.params.id") || lower.includes("params.id")) &&
          (lower.includes("findbyid") || lower.includes("delete") || lower.includes("update")) &&
          !lower.includes("userid") &&
          !lower.includes("ownerid") &&
          !lower.includes("session")
        ) {
          findings.push({
            ruleId: "SEC-AUTHZ-002",
            category: "authorization" as const,
            severity: "warning" as const,
            confidence: "medium" as const,
            title: "Missing Resource Ownership Verification (IDOR)",
            message: `Resource query at line ${lineNum} queries by client parameter ID without scoping to user session ownership.`,
            evidence: {
              file: astContext.filePath,
              line: lineNum,
              snippet: lineText.trim(),
            },
            affectedFiles: [astContext.filePath],
            affectedLines: [lineNum],
            whyThisIsDangerous: "Users can access resources belonging to any account by changing URL parameters.",
            howAttackersAbuseIt: "Attacker iterates parameter IDs to dump all database records.",
            suggestedFix: "Scope queries by session.user.id in addition to parameter ID.",
            automaticFixAvailability: { available: false },
            documentation: {
              owasp: "A01:2021-Broken Access Control",
              cwe: "CWE-639",
            },
            owaspMapping: "A01:2021 - Broken Access Control",
          });
        }
      });

      return findings;
    },
  },
];
