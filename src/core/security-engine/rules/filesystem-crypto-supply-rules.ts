import type { SecurityRule, SecurityFindingDetails } from "../types.js";

export const filesystemCryptoSupplyRules: SecurityRule[] = [
  // 1. Weak Cryptography / PRNG for Tokens (Math.random for secrets)
  {
    id: "SEC-CRY-001",
    category: "cryptography",
    severity: "critical",
    title: "Use of Weak Pseudo-Random Number Generator for Security Token",
    frameworks: ["all"],
    provider: "none",
    description: "Math.random() used to generate session tokens, password reset tokens, or cryptographic keys.",
    whyThisIsDangerous:
      "Math.random() uses a predictable PRNG seed. Attackers can predict past and future generated tokens from observed samples.",
    howAttackersAbuseIt:
      "Attacker collects a few generated reset token strings and predicts the reset token generated for the administrator's account.",
    suggestedFix: "Use Node's crypto.randomBytes() or crypto.randomUUID() / Web Crypto crypto.getRandomValues().",
    owaspMapping: "A02:2021 - Cryptographic Failures",
    cwe: "CWE-330",
    testCases: [
      {
        name: "Detect Math.random token generation",
        code: `const token = Math.random().toString(36).substring(2);`,
        shouldMatch: true,
      },
    ],
    safeAutoFix: (content) => {
      if (content.includes("Math.random().toString(36)")) {
        const fixed = content.replace(
          /Math\.random\(\)\.toString\(36\)/g,
          "require('crypto').randomBytes(16).toString('hex')"
        );
        return {
          modifiedContent: fixed,
          description: "Replaced Math.random() token generation with crypto.randomBytes(16).",
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
          lower.includes("math.random()") &&
          (lower.includes("token") || lower.includes("secret") || lower.includes("password") || lower.includes("key") || lower.includes("session"))
        ) {
          findings.push({
            ruleId: "SEC-CRY-001",
            category: "cryptography" as const,
            severity: "critical" as const,
            confidence: "high" as const,
            title: "Use of Weak Pseudo-Random Number Generator for Security Token",
            message: `Math.random() used to generate secret token at line ${lineNum}: '${lineText.trim()}'.`,
            evidence: {
              file: astContext.filePath,
              line: lineNum,
              snippet: lineText.trim(),
            },
            affectedFiles: [astContext.filePath],
            affectedLines: [lineNum],
            whyThisIsDangerous: "Math.random() is mathematically predictable and not cryptographically secure.",
            howAttackersAbuseIt: "Attacker predicts generated password reset or session tokens.",
            suggestedFix: "Use crypto.randomBytes() or crypto.randomUUID().",
            automaticFixAvailability: {
              available: true,
              fixId: "fix-crypto-prng",
              description: "Replace Math.random() with crypto.randomBytes().",
            },
            documentation: {
              owasp: "A02:2021-Cryptographic Failures",
              cwe: "CWE-330",
            },
            owaspMapping: "A02:2021 - Cryptographic Failures",
          });
        }
      });

      return findings;
    },
  },

  // 2. Path Traversal File System Operations (fs.readFile with user input)
  {
    id: "SEC-FS-001",
    category: "filesystem",
    severity: "critical",
    title: "Path Traversal in File Operations",
    frameworks: ["all"],
    provider: "none",
    description: "FileSystem call (fs.readFile, fs.unlink, path.join) receives un-sanitized user parameter input.",
    whyThisIsDangerous:
      "Path traversal sequences (`../`) allow attackers to escape the intended directory and read or overwrite arbitrary files on the host system.",
    howAttackersAbuseIt:
      "Attacker passes `filename=../../../../etc/passwd` to a download API endpoint.",
    suggestedFix: "Sanitize user paths with path.basename() or verify resolving path starts with base directory.",
    owaspMapping: "A01:2021 - Broken Access Control",
    cwe: "CWE-22",
    testCases: [
      {
        name: "Detect path.join with req.query",
        code: `const filePath = path.join(__dirname, req.query.file); fs.readFileSync(filePath);`,
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
          (lower.includes("fs.readfile") || lower.includes("fs.readfilesync") || lower.includes("fs.unlink") || lower.includes("res.sendfile")) &&
          (lower.includes("req.query") || lower.includes("req.params") || lower.includes("req.body")) &&
          !lower.includes("path.basename")
        ) {
          findings.push({
            ruleId: "SEC-FS-001",
            category: "filesystem" as const,
            severity: "critical" as const,
            confidence: "high" as const,
            title: "Path Traversal in File Operations",
            message: `File system operation receives user request parameter directly at line ${lineNum}.`,
            evidence: {
              file: astContext.filePath,
              line: lineNum,
              snippet: lineText.trim(),
            },
            affectedFiles: [astContext.filePath],
            affectedLines: [lineNum],
            whyThisIsDangerous: "Unsanitized file paths enable directory traversal attacks.",
            howAttackersAbuseIt: "Attacker passes `../` sequences to read host files.",
            suggestedFix: "Use path.basename() or validate normalized path stays inside allowed root dir.",
            automaticFixAvailability: { available: false },
            documentation: {
              owasp: "A01:2021-Broken Access Control",
              cwe: "CWE-22",
            },
            owaspMapping: "A01:2021 - Broken Access Control",
          });
        }
      });

      return findings;
    },
  },
];
