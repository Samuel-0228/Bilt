import type { SecurityFindingDetails } from "./types.js";
import { SecretAnalyzer } from "./secret-analyzer.js";

export interface EnvFile {
  filePath: string;
  entries: Map<string, { value: string; line: number; comment?: string }>;
}

export class EnvAnalyzer {
  /**
   * Scans set of env files and source code references for environment anti-patterns
   */
  public static analyze(
    envFiles: EnvFile[],
    sourceCodeKeys: Map<string, Array<{ file: string; line: number }>>,
    frameworks: string[]
  ): SecurityFindingDetails[] {
    const findings: SecurityFindingDetails[] = [];

    const envMap = new Map<string, EnvFile>();
    envFiles.forEach((ef) => envMap.set(ef.filePath.replace(/\\/g, "/"), ef));

    const mainEnv = envFiles.find((ef) => ef.filePath.endsWith(".env")) || envFiles[0];
    const exampleEnv = envFiles.find(
      (ef) => ef.filePath.endsWith(".env.example") || ef.filePath.endsWith(".env.template")
    );
    const prodEnv = envFiles.find(
      (ef) => ef.filePath.endsWith(".env.production") || ef.filePath.endsWith(".env.prod")
    );

    // 1. Client Secret Exposure & Invalid Prefixes (e.g. NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY)
    envFiles.forEach((ef) => {
      ef.entries.forEach((info, key) => {
        const uppercaseKey = key.toUpperCase();

        // Check if a client public prefix is attached to a secret key name
        if (
          uppercaseKey.startsWith("NEXT_PUBLIC_") ||
          uppercaseKey.startsWith("VITE_") ||
          uppercaseKey.startsWith("PUBLIC_") ||
          uppercaseKey.startsWith("REACT_APP_")
        ) {
          const sensitiveKeywords = [
            "SECRET",
            "SERVICE_ROLE",
            "PRIVATE_KEY",
            "PASSWORD",
            "DATABASE_URL",
            "ADMIN",
            "MASTER_KEY",
          ];

          if (sensitiveKeywords.some((kw) => uppercaseKey.includes(kw))) {
            findings.push({
              ruleId: "SEC-ENV-001",
              category: "secrets",
              severity: "critical",
              confidence: "high",
              title: "Client-Exposed Secret Environment Variable",
              message: `Environment variable '${key}' exposes a sensitive backend secret to the client bundle!`,
              evidence: {
                file: ef.filePath,
                line: info.line,
                snippet: `${key}=${info.value ? "[REDACTED]" : ""}`,
                symbol: key,
              },
              affectedFiles: [ef.filePath],
              affectedLines: [info.line],
              whyThisIsDangerous:
                "Frameworks like Next.js and Vite bundle environment variables prefixed with NEXT_PUBLIC_ or VITE_ directly into client-side JavaScript, rendering secrets readable by anyone.",
              howAttackersAbuseIt:
                "An attacker opens browser developer tools, inspects bundled JS source, extracts the secret, and bypasses authentication or accesses private databases.",
              suggestedFix: `Remove the public prefix (e.g. rename '${key}' to '${key.replace(/^(NEXT_PUBLIC_|VITE_|PUBLIC_|REACT_APP_)/, "")}') and ensure it is only accessed in backend/server routes.`,
              automaticFixAvailability: {
                available: true,
                fixId: "fix-client-secret-prefix",
                description: "Strip public prefix from secret key in env file.",
              },
              documentation: {
                owasp: "A01:2021-Broken Access Control",
                cwe: "CWE-522",
                docsUrl: "https://nextjs.org/docs/app/building-your-application/configuring/environment-variables#bundling-environment-variables-for-the-browser",
              },
              owaspMapping: "A01:2021 - Broken Access Control",
            });
          }
        }
      });
    });

    // 2. Duplicate Variables in Same Env File
    envFiles.forEach((ef) => {
      const counts = new Map<string, number[]>();
      ef.entries.forEach((info, key) => {
        const lines = counts.get(key) || [];
        lines.push(info.line);
        counts.set(key, lines);
      });

      counts.forEach((lines, key) => {
        if (lines.length > 1) {
          findings.push({
            ruleId: "SEC-ENV-002",
            category: "configuration",
            severity: "warning",
            confidence: "high",
            title: "Duplicate Environment Variable",
            message: `Environment variable '${key}' is defined ${lines.length} times in ${ef.filePath}.`,
            evidence: {
              file: ef.filePath,
              line: lines[1] ?? lines[0] ?? 1,
              snippet: `${key}=...`,
              symbol: key,
            },
            affectedFiles: [ef.filePath],
            affectedLines: lines,
            whyThisIsDangerous:
              "Duplicate environment variable declarations lead to unpredictable overrides depending on parsing order, causing environment drift and security inconsistencies.",
            howAttackersAbuseIt:
              "Discrepancies between developer expectations and runtime configuration can accidentally disable security flags or auth providers.",
            suggestedFix: `Deduplicate '${key}' in ${ef.filePath} so only one valid definition exists.`,
            automaticFixAvailability: {
              available: true,
              fixId: "fix-duplicate-env",
              description: "Remove duplicate env entries.",
            },
            documentation: {
              owasp: "A05:2021-Security Misconfiguration",
              cwe: "CWE-1059",
            },
            owaspMapping: "A05:2021 - Security Misconfiguration",
          });
        }
      });
    });

    // 3. Documented vs Undocumented Variables (.env vs .env.example)
    if (mainEnv && exampleEnv) {
      mainEnv.entries.forEach((info, key) => {
        if (!exampleEnv.entries.has(key)) {
          findings.push({
            ruleId: "SEC-ENV-003",
            category: "configuration",
            severity: "info",
            confidence: "medium",
            title: "Undocumented Environment Variable",
            message: `Environment variable '${key}' present in ${mainEnv.filePath} is missing from ${exampleEnv.filePath}.`,
            evidence: {
              file: mainEnv.filePath,
              line: info.line,
              snippet: `${key}=...`,
              symbol: key,
            },
            affectedFiles: [mainEnv.filePath, exampleEnv.filePath],
            affectedLines: [info.line],
            whyThisIsDangerous:
              "Missing documentation in .env.example leads to broken CI/CD deployments and fallback errors in production.",
            howAttackersAbuseIt:
              "Deployment failure or uninitialized security configurations when deploying new instances.",
            suggestedFix: `Add '${key}=' to ${exampleEnv.filePath} with a placeholder value.`,
            automaticFixAvailability: {
              available: true,
              fixId: "fix-add-env-example",
              description: "Add placeholder to .env.example",
            },
            documentation: {
              owasp: "A05:2021-Security Misconfiguration",
              cwe: "CWE-1059",
            },
            owaspMapping: "A05:2021 - Security Misconfiguration",
          });
        }
      });
    }

    // 4. Missing Variables referenced in Code
    if (mainEnv) {
      sourceCodeKeys.forEach((occurrences, key) => {
        // Ignore standard built-in process.env keys
        if (
          key === "NODE_ENV" ||
          key === "PORT" ||
          key === "TZ" ||
          key === "VERCEL" ||
          key === "NETLIFY" ||
          key === "CI"
        ) {
          return;
        }

        if (!mainEnv.entries.has(key)) {
          const firstOcc = occurrences[0];
          if (!firstOcc) return;
          findings.push({
            ruleId: "SEC-ENV-004",
            category: "configuration",
            severity: "warning",
            confidence: "medium",
            title: "Missing Environment Variable Referenced in Source",
            message: `Source code references 'process.env.${key}' but '${key}' is missing from ${mainEnv.filePath}.`,
            evidence: {
              file: firstOcc.file,
              line: firstOcc.line,
              snippet: `process.env.${key}`,
              symbol: key,
            },
            affectedFiles: [firstOcc.file, mainEnv.filePath],
            affectedLines: [firstOcc.line],
            whyThisIsDangerous:
              "Referencing undefined environment variables can result in undefined values being passed to security critical functions or silent fallbacks.",
            howAttackersAbuseIt:
              "Attackers exploit empty strings or undefined parameters in authentication checks, JWT secret verification, or API requests.",
            suggestedFix: `Define '${key}=' in ${mainEnv.filePath}.`,
            automaticFixAvailability: {
              available: true,
              fixId: "fix-add-missing-env",
              description: "Add missing env key declaration.",
            },
            documentation: {
              owasp: "A05:2021-Security Misconfiguration",
              cwe: "CWE-440",
            },
            owaspMapping: "A05:2021 - Security Misconfiguration",
          });
        }
      });
    }

    return findings;
  }
}
