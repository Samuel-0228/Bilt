import type { SecurityRule, SecurityFindingDetails } from "../types.js";
import { ASTAnalyzer } from "../ast-analyzer.js";

export const authRules: SecurityRule[] = [
  // 1. Unverified JWT Decode (jwt.decode instead of jwt.verify)
  {
    id: "SEC-AUTH-001",
    category: "authentication",
    severity: "critical",
    title: "Unverified JWT Token Decode",
    frameworks: ["all"],
    provider: "none",
    description: "JWT token is decoded with jwt.decode() without signature verification.",
    whyThisIsDangerous:
      "jwt.decode() only parses the Base64 payload without checking the signature or issuer, allowing anyone to forge arbitrarily tampered JWT payloads.",
    howAttackersAbuseIt:
      "An attacker crafts a forged JWT payload with 'isAdmin: true' or an arbitrary user ID and passes it to the API, gaining unauthorized access without knowing the secret.",
    suggestedFix: "Use jwt.verify(token, secret) instead of jwt.decode(token) to validate token integrity and authenticity.",
    owaspMapping: "A07:2021 - Identification and Authentication Failures",
    cwe: "CWE-347",
    docsUrl: "https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html",
    testCases: [
      {
        name: "Detect jwt.decode usage",
        code: `const decoded = jwt.decode(token);`,
        shouldMatch: true,
      },
      {
        name: "Ignore jwt.verify usage",
        code: `const verified = jwt.verify(token, process.env.JWT_SECRET);`,
        shouldMatch: false,
      },
    ],
    safeAutoFix: (content, finding) => {
      if (content.includes("jwt.decode(")) {
        const fixed = content.replace(/jwt\.decode\(([^)]+)\)/g, "jwt.verify($1, process.env.JWT_SECRET)");
        return {
          modifiedContent: fixed,
          description: "Replaced jwt.decode(...) with jwt.verify(..., process.env.JWT_SECRET).",
        };
      }
      return null;
    },
    match: (astContext) => {
      const findings: SecurityFindingDetails[] = [];
      const { sourceFile } = ASTAnalyzer.parse(astContext.filePath, astContext.fileContent);
      const matches = ASTAnalyzer.findCallExpressions(sourceFile, ["jwt.decode", "decodeToken", "decodeJwt"]);

      for (const m of matches) {
        // Check if jwt.verify exists in the surrounding function
        const hasVerifyCall = astContext.fileContent.includes("jwt.verify") || astContext.fileContent.includes("verifyToken");
        if (!hasVerifyCall) {
          findings.push({
            ruleId: "SEC-AUTH-001",
            category: "authentication" as const,
            severity: "critical" as const,
            confidence: "high" as const,
            title: "Unverified JWT Token Decode",
            message: `jwt.decode() used at line ${m.line} without prior signature verification!`,
            evidence: {
              file: astContext.filePath,
              line: m.line,
              column: m.col,
              snippet: m.text,
              symbol: m.name,
            },
            affectedFiles: [astContext.filePath],
            affectedLines: [m.line],
            whyThisIsDangerous:
              "jwt.decode() parses the Base64 payload without checking the cryptographic signature, allowing arbitrary token forgery.",
            howAttackersAbuseIt:
              "An attacker modifies token payload claims (e.g. sub=admin_id) and sends the unverified token to bypass authentication.",
            suggestedFix: "Replace jwt.decode() with jwt.verify(token, secret).",
            automaticFixAvailability: {
              available: true,
              fixId: "fix-jwt-decode",
              description: "Replace jwt.decode with jwt.verify using JWT_SECRET.",
            },
            documentation: {
              owasp: "A07:2021-Identification and Authentication Failures",
              cwe: "CWE-347",
            },
            owaspMapping: "A07:2021 - Identification and Authentication Failures",
          });
        }
      }
      return findings;
    },
  },

  // 2. Disabled or Fake/Placeholder Auth (`// TODO: add auth` or `auth: false`)
  {
    id: "SEC-AUTH-002",
    category: "authentication",
    severity: "critical",
    title: "Disabled or Placeholder Authentication",
    frameworks: ["all"],
    provider: "none",
    description: "Authentication is explicitly disabled or left as a TODO placeholder in a route handler.",
    whyThisIsDangerous:
      "Routes intended to require authentication are completely open to unauthenticated public requests.",
    howAttackersAbuseIt:
      "Attackers discover unauthenticated endpoint routes via enumeration and execute sensitive operations.",
    suggestedFix: "Implement production authentication middleware or guard.",
    owaspMapping: "A07:2021 - Identification and Authentication Failures",
    cwe: "CWE-306",
    testCases: [
      {
        name: "Detect fake auth return true",
        code: `function checkAuth(req) { return true; // TODO: implement auth }`,
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
          (lower.includes("todo") && lower.includes("auth")) ||
          lower.includes("auth: false") ||
          lower.includes("authentication: false") ||
          (lower.includes("checkauth") && lower.includes("return true")) ||
          (lower.includes("authenticate") && lower.includes("return true")) ||
          lower.includes("bypassauth = true")
        ) {
          findings.push({
            ruleId: "SEC-AUTH-002",
            category: "authentication" as const,
            severity: "critical" as const,
            confidence: "high" as const,
            title: "Disabled or Placeholder Authentication",
            message: `Placeholder or disabled authentication detected at line ${lineNum}: '${lineText.trim()}'.`,
            evidence: {
              file: astContext.filePath,
              line: lineNum,
              snippet: lineText.trim(),
            },
            affectedFiles: [astContext.filePath],
            affectedLines: [lineNum],
            whyThisIsDangerous:
              "Placeholder authentication checks grant immediate access to unauthenticated requests.",
            howAttackersAbuseIt:
              "Attackers make direct requests to administrative or sensitive API routes.",
            suggestedFix: "Enforce real user authentication checks before processing requests.",
            automaticFixAvailability: { available: false },
            documentation: {
              owasp: "A07:2021-Identification and Authentication Failures",
              cwe: "CWE-306",
            },
            owaspMapping: "A07:2021 - Identification and Authentication Failures",
          });
        }
      });

      return findings;
    },
  },

  // 3. Hardcoded Admin Users or Default Passwords
  {
    id: "SEC-AUTH-003",
    category: "authentication",
    severity: "critical",
    title: "Hardcoded Admin User or Default Password",
    frameworks: ["all"],
    provider: "none",
    description: "Hardcoded fallback admin user credentials or default password string found in authentication logic.",
    whyThisIsDangerous:
      "Hardcoded credentials in source code can be extracted by anyone with read access to the code or compiled bundle.",
    howAttackersAbuseIt:
      "Attackers log into administrative accounts using default credentials like 'admin' / 'password123'.",
    suggestedFix: "Store user credentials in a secure database with salted password hashing (e.g. bcrypt/argon2).",
    owaspMapping: "A07:2021 - Identification and Authentication Failures",
    cwe: "CWE-798",
    testCases: [
      {
        name: "Detect admin password compare",
        code: `if (username === "admin" && password === "admin123") { grantAccess(); }`,
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
          (lower.includes('username === "admin"') || lower.includes("username === 'admin'")) &&
          (lower.includes("password") || lower.includes("pass"))
        ) {
          findings.push({
            ruleId: "SEC-AUTH-003",
            category: "authentication" as const,
            severity: "critical" as const,
            confidence: "high" as const,
            title: "Hardcoded Admin User or Default Password",
            message: `Hardcoded admin login credentials check at line ${lineNum}.`,
            evidence: {
              file: astContext.filePath,
              line: lineNum,
              snippet: lineText.trim(),
            },
            affectedFiles: [astContext.filePath],
            affectedLines: [lineNum],
            whyThisIsDangerous: "Hardcoded credentials bypass proper authentication and cannot be revoked easily.",
            howAttackersAbuseIt: "Attackers log in using known hardcoded credentials.",
            suggestedFix: "Use standard database password verification.",
            automaticFixAvailability: { available: false },
            documentation: {
              owasp: "A07:2021-Identification and Authentication Failures",
              cwe: "CWE-798",
            },
            owaspMapping: "A07:2021 - Identification and Authentication Failures",
          });
        }
      });

      return findings;
    },
  },
];
