import type { SecurityRule, SecurityFindingDetails } from "../types.js";

export const apiConfigRules: SecurityRule[] = [
  // 1. Stack Trace / Verbose Errors Exposed in API Response
  {
    id: "SEC-CFG-001",
    category: "configuration",
    severity: "warning",
    title: "Verbose Error Details or Stack Trace Exposed",
    frameworks: ["express", "nextjs", "all"],
    provider: "none",
    description: "API error responses leak internal stack trace (err.stack) or exception details directly to HTTP client.",
    whyThisIsDangerous:
      "Leaking stack traces reveals file paths, framework versions, internal database structures, and environment variable names to potential attackers.",
    howAttackersAbuseIt:
      "Attacker triggers artificial exception errors to map out internal backend architecture and database columns.",
    suggestedFix: "Sanitize production error responses: return generic error messages to clients while logging detailed stack traces privately server-side.",
    owaspMapping: "A05:2021 - Security Misconfiguration",
    cwe: "CWE-209",
    testCases: [
      {
        name: "Detect err.stack in res.json",
        code: `app.use((err, req, res, next) => { res.status(500).json({ error: err.message, stack: err.stack }); });`,
        shouldMatch: true,
      },
    ],
    safeAutoFix: (content) => {
      if (content.includes("err.stack") || content.includes("error.stack") || content.includes("e.stack")) {
        const fixed = content
          .replace(/stack:\s*err\.stack/g, "stack: process.env.NODE_ENV === 'development' ? err.stack : undefined")
          .replace(/stack:\s*error\.stack/g, "stack: process.env.NODE_ENV === 'development' ? error.stack : undefined")
          .replace(/stack:\s*e\.stack/g, "stack: process.env.NODE_ENV === 'development' ? e.stack : undefined");
        return {
          modifiedContent: fixed,
          description: "Conditionally hide error stack traces in production environment responses.",
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

        if (
          (lower.includes("res.json(") || lower.includes("res.send(")) &&
          (lower.includes("err.stack") || lower.includes("error.stack") || lower.includes("e.stack"))
        ) {
          findings.push({
            ruleId: "SEC-CFG-001",
            category: "configuration" as const,
            severity: "warning" as const,
            confidence: "high" as const,
            title: "Verbose Error Details or Stack Trace Exposed",
            message: `Internal stack trace returned to client in HTTP response at line ${lineNum}.`,
            evidence: {
              file: astContext.filePath,
              line: lineNum,
              snippet: lineText.trim(),
            },
            affectedFiles: [astContext.filePath],
            affectedLines: [lineNum],
            whyThisIsDangerous: "Stack traces reveal server internals and system structure to attackers.",
            howAttackersAbuseIt: "Attacker triggers errors to gather intelligence for targeted exploits.",
            suggestedFix: "Do not include `err.stack` in public API responses.",
            automaticFixAvailability: { available: true, description: "Hide stack traces in production" },
            documentation: {
              owasp: "A05:2021-Security Misconfiguration",
              cwe: "CWE-209",
            },
            owaspMapping: "A05:2021 - Security Misconfiguration",
          });
        }
      });

      return findings;
    },
  },

  // 2. Missing Security Headers (Helmet middleware missing in Express)
  {
    id: "SEC-CFG-002",
    category: "configuration",
    severity: "info",
    title: "Missing Essential HTTP Security Headers",
    frameworks: ["express"],
    provider: "none",
    description: "Express application missing helmet() middleware for setting security HTTP headers (X-Frame-Options, X-Content-Type-Options, CSP).",
    whyThisIsDangerous:
      "Missing security headers leave web applications vulnerable to clickjacking, MIME-sniffing, and XSS attacks.",
    howAttackersAbuseIt:
      "Attacker embeds website inside an invisible iframe to execute clickjacking attacks against logged-in users.",
    suggestedFix: "Install helmet package and register `app.use(helmet())` at top of middleware chain.",
    owaspMapping: "A05:2021 - Security Misconfiguration",
    cwe: "CWE-1059",
    testCases: [
      {
        name: "Detect express app without helmet",
        code: `const app = express(); app.listen(3000);`,
        shouldMatch: true,
      },
    ],
    safeAutoFix: (content, finding, astContext) => {
      if (content.includes("express()") && !content.includes("helmet()")) {
        let fixed = content;
        const importStatement = astContext?.filePath.endsWith(".ts")
          ? "import helmet from 'helmet';\n"
          : "const helmet = require('helmet');\n";

        if (!fixed.includes("helmet")) {
          fixed = importStatement + fixed;
        }

        fixed = fixed.replace(/const\s+(\w+)\s*=\s*express\(\);/g, "const $1 = express();\n$1.use(helmet());");
        if (fixed !== content) {
          return {
            modifiedContent: fixed,
            description: "Registered helmet() security middleware on Express application instance.",
          };
        }
      }
      return null;
    },
    match: (astContext) => {
      const findings: SecurityFindingDetails[] = [];
      const ext = astContext.filePath.toLowerCase();
      const isJsTs = ext.endsWith(".ts") || ext.endsWith(".js") || ext.endsWith(".tsx") || ext.endsWith(".jsx");
      const isConfigFile = ext.includes("config.js") || ext.includes("config.ts") || ext.includes("config.mjs") || ext.includes("config.cjs");

      if (
        isJsTs &&
        !isConfigFile &&
        astContext.fileContent.includes("express()") &&
        !astContext.fileContent.includes("helmet()")
      ) {
        findings.push({
          ruleId: "SEC-CFG-002",
          category: "configuration" as const,
          severity: "info" as const,
          confidence: "medium" as const,
          title: "Missing Essential HTTP Security Headers",
          message: `Express application created in ${astContext.filePath} without helmet() security headers middleware.`,
          evidence: {
            file: astContext.filePath,
            line: 1,
            snippet: "const app = express();",
          },
          affectedFiles: [astContext.filePath],
          affectedLines: [1],
          whyThisIsDangerous: "Default Express response headers do not protect against clickjacking or MIME-sniffing.",
          howAttackersAbuseIt: "Attacker framing attacks or cross-domain MIME exploits.",
          suggestedFix: "Add `import helmet from 'helmet'; app.use(helmet());`.",
          automaticFixAvailability: { available: true, description: "Add helmet security headers middleware" },
          documentation: {
            owasp: "A05:2021-Security Misconfiguration",
            cwe: "CWE-1059",
          },
          owaspMapping: "A05:2021 - Security Misconfiguration",
        });
      }
      return findings;
    },
  },
];
