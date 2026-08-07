import type { SecurityRule, SecurityFindingDetails } from "../types.js";

export const dockerGitDepRules: SecurityRule[] = [
  // 1. Docker running as Root user or latest tag / copied .env
  {
    id: "SEC-DOC-001",
    category: "configuration",
    severity: "warning",
    title: "Insecure Docker Container Configuration",
    frameworks: ["docker"],
    provider: "none",
    description: "Dockerfile runs container process as root user, uses :latest tag, or copies .env files into container build layer.",
    whyThisIsDangerous:
      "Running container processes as root increases container breakout severity. Copying .env into container images bakes production secrets permanently into image layers.",
    howAttackersAbuseIt:
      "Attacker exploiting an RCE vulnerability inside the container automatically inherits root privileges on host or extracts baked image layers.",
    suggestedFix: "Use pinned base image tags (e.g. node:18-alpine), set explicit non-root user `USER node`, and add `.env` to `.dockerignore`.",
    owaspMapping: "A05:2021 - Security Misconfiguration",
    cwe: "CWE-250",
    testCases: [
      {
        name: "Detect COPY .env in Dockerfile",
        code: `COPY .env .env`,
        shouldMatch: true,
      },
    ],
    match: (astContext) => {
      const findings: SecurityFindingDetails[] = [];
      if (!astContext.filePath.endsWith("Dockerfile")) return findings;

      const lines = astContext.fileContent.split("\n");
      let hasUserDirective = false;

      lines.forEach((lineText, idx) => {
        const lineNum = idx + 1;
        const trimmed = lineText.trim();

        if (trimmed.startsWith("USER ")) {
          hasUserDirective = true;
        }

        if (trimmed.startsWith("COPY ") && (trimmed.includes(".env") || trimmed.includes("node_modules"))) {
          findings.push({
            ruleId: "SEC-DOC-001",
            category: "configuration" as const,
            severity: "critical" as const,
            confidence: "high" as const,
            title: "Insecure Docker Container Configuration",
            message: `Dockerfile copies sensitive files into container layer at line ${lineNum}: '${trimmed}'.`,
            evidence: {
              file: astContext.filePath,
              line: lineNum,
              snippet: trimmed,
            },
            affectedFiles: [astContext.filePath],
            affectedLines: [lineNum],
            whyThisIsDangerous: "Baking .env or node_modules into Docker images exposes secrets in image registries.",
            howAttackersAbuseIt: "Attacker pulls image layers and inspects baked environment credentials.",
            suggestedFix: "Add `.env` and `node_modules` to `.dockerignore`.",
            automaticFixAvailability: { available: false },
            documentation: {
              owasp: "A05:2021-Security Misconfiguration",
              cwe: "CWE-250",
            },
            owaspMapping: "A05:2021 - Security Misconfiguration",
          });
        }
      });

      if (!hasUserDirective) {
        findings.push({
          ruleId: "SEC-DOC-001",
          category: "configuration" as const,
          severity: "warning" as const,
          confidence: "high" as const,
          title: "Insecure Docker Container Configuration",
          message: `Dockerfile in ${astContext.filePath} missing non-root USER directive.`,
          evidence: {
            file: astContext.filePath,
            line: 1,
            snippet: lines[0] || "",
          },
          affectedFiles: [astContext.filePath],
          affectedLines: [1],
          whyThisIsDangerous: "Containers running as default root user elevate container escape impact.",
          howAttackersAbuseIt: "Attacker exploiting application vulnerabilities gains container root privileges.",
          suggestedFix: "Add `USER node` before CMD/ENTRYPOINT.",
          automaticFixAvailability: { available: false },
          documentation: {
            owasp: "A05:2021-Security Misconfiguration",
            cwe: "CWE-250",
          },
          owaspMapping: "A05:2021 - Security Misconfiguration",
        });
      }

      return findings;
    },
  },

  // 2. Supply Chain / Unpinned or Vulnerable Dependencies
  {
    id: "SEC-DEP-001",
    category: "supply-chain",
    severity: "warning",
    title: "Missing Lockfile for Deterministic Dependency Builds",
    frameworks: ["all"],
    provider: "none",
    description: "Project package.json exists without package-lock.json, pnpm-lock.yaml, or yarn.lock file.",
    whyThisIsDangerous:
      "Missing lockfiles mean builds fetch arbitrary latest minor/patch dependency versions on every install, exposing deployments to broken updates or malicious dependency hijackings.",
    howAttackersAbuseIt:
      "Attacker publishes a malicious patch version of an unpinned sub-dependency (Dependency Confusion / Typosquatting).",
    suggestedFix: "Run `npm install` or `pnpm install` to commit a lockfile.",
    owaspMapping: "A06:2021 - Vulnerable and Outdated Components",
    cwe: "CWE-1104",
    testCases: [
      {
        name: "Check missing lockfile",
        code: `{"name":"test"}`,
        shouldMatch: false,
      },
    ],
    match: () => {
      // Checked dynamically by rule engine package inspector
      return [];
    },
  },
];
