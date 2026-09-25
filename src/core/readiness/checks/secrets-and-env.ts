// ─── Secrets and Environment Readiness Check ──────────────────────────────────
// Wraps existing scan/secrets + scan/env engines into the readiness taxonomy.
// Status: ENFORCED — fully automated.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReadinessCategory } from "../taxonomy.js";
import type { BiltCheckFinding, CheckMode } from "../finding.js";
import type { CategoryChecker, CheckContext } from "../check-runner.js";
import { generateCheckFingerprint } from "../finding.js";

const CATEGORY: ReadinessCategory = "secrets-and-env";

/**
 * Automated checks for secrets and environment configuration:
 * - Hardcoded credentials, API keys, private keys
 * - Committed .env files
 * - Secrets in client-side code
 * - Missing .env.example
 * - Database credentials in source
 */
export const secretsAndEnvChecker: CategoryChecker = {
  category: CATEGORY,
  mode: "automated" as CheckMode,

  async run(context: CheckContext): Promise<BiltCheckFinding[]> {
    const findings: BiltCheckFinding[] = [];

    for (const file of context.files) {
      const normalizedPath = file.path.replace(/\\/g, "/");

      // Skip non-source files
      if (
        normalizedPath.includes("/node_modules/") ||
        normalizedPath.includes("/dist/") ||
        normalizedPath.includes("/build/") ||
        normalizedPath.includes("/.git/")
      ) {
        continue;
      }

      // Check 1: Committed .env files with real values
      if (isEnvFile(normalizedPath)) {
        const envFindings = checkEnvFile(file.path, file.content);
        findings.push(...envFindings);
      }

      // Check 2: Hardcoded secrets in source code
      if (isSourceFile(normalizedPath)) {
        const secretFindings = checkHardcodedSecrets(file.path, file.content, context);
        findings.push(...secretFindings);
      }

      // Check 3: Secrets in client-side code
      if (isClientFile(normalizedPath, context)) {
        const clientFindings = checkClientSecrets(file.path, file.content, context);
        findings.push(...clientFindings);
      }
    }

    // Check 4: Missing .env.example
    const hasEnvFile = context.files.some((f) =>
      /^\.env($|\.)/.test(f.path.replace(/\\/g, "/").split("/").pop() || ""),
    );
    const hasEnvExample = context.files.some((f) =>
      f.path.replace(/\\/g, "/").endsWith(".env.example"),
    );
    if (hasEnvFile && !hasEnvExample) {
      findings.push({
        ruleId: "CHECK-SEC-ENV-004",
        category: CATEGORY,
        mode: "automated",
        severity: "medium",
        precision: "high",
        maturity: "stable",
        status: "fail",
        title: "Missing .env.example template",
        whyItMatters:
          "Without a .env.example, new developers or deployment systems " +
          "may not know which environment variables are required, leading to " +
          "misconfigured deployments or accidental use of development defaults.",
        technicalDetail:
          "Found .env file(s) but no .env.example template. " +
          "A .env.example should list all required variables with placeholder values.",
        agentAction:
          "Create a .env.example file listing all required environment variables " +
          "with safe placeholder values. Never include real secrets.",
        fixable: true,
        fingerprint: generateCheckFingerprint("CHECK-SEC-ENV-004", ".env.example"),
      });
    }

    return findings;
  },
};

// ─── Helper: Check .env files for committed secrets ──────────────────────────

function checkEnvFile(filePath: string, content: string): BiltCheckFinding[] {
  const findings: BiltCheckFinding[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) continue;

    const key = line.substring(0, eqIdx).trim();
    const value = line.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, "");

    // Skip empty values and obvious placeholders
    if (!value || isPlaceholder(value)) continue;

    // Check for secret-looking keys with real values
    if (isSecretKey(key) && value.length > 8) {
      findings.push({
        ruleId: "CHECK-SEC-ENV-001",
        category: "secrets-and-env",
        mode: "automated",
        severity: "critical",
        precision: "high",
        maturity: "stable",
        status: "fail",
        title: `Secret value committed in ${filePath}`,
        whyItMatters:
          "Environment files with real secret values committed to version control " +
          "expose credentials to anyone with repository access, including in git history.",
        technicalDetail:
          `${key} in ${filePath} at line ${i + 1} contains what appears to be ` +
          "a real secret value. This file should be in .gitignore.",
        agentAction:
          `Remove ${filePath} from version control, add it to .gitignore, ` +
          "rotate the exposed credential, and store secrets via environment " +
          "variables or a secrets manager.",
        fixable: true,
        file: filePath,
        line: i + 1,
        fingerprint: generateCheckFingerprint("CHECK-SEC-ENV-001", filePath, i + 1),
      });
    }
  }

  return findings;
}

// ─── Helper: Check for hardcoded secrets in source ───────────────────────────

const SECRET_PATTERNS = [
  { pattern: /(?:sk[-_]live|sk[-_]test)_[a-zA-Z0-9]{20,}/g, type: "Stripe API key" },
  { pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/g, type: "AWS Access Key" },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, type: "GitHub Personal Access Token" },
  { pattern: /gho_[a-zA-Z0-9]{36}/g, type: "GitHub OAuth Token" },
  { pattern: /glpat-[a-zA-Z0-9\-_]{20,}/g, type: "GitLab Access Token" },
  { pattern: /xoxb-[0-9]{10,}-[a-zA-Z0-9]{20,}/g, type: "Slack Bot Token" },
  { pattern: /xoxp-[0-9]{10,}-[a-zA-Z0-9]{20,}/g, type: "Slack User Token" },
  { pattern: /(?:eyJhbGciOiJ)[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{20,}/g, type: "JWT Token" },
  { pattern: /-----BEGIN (?:RSA )?PRIVATE KEY-----/g, type: "Private Key" },
  { pattern: /(?:mongodb(?:\+srv)?:\/\/)[^\s'"]+/g, type: "MongoDB Connection String" },
  { pattern: /(?:postgres(?:ql)?:\/\/)[^\s'"]+/g, type: "PostgreSQL Connection String" },
  { pattern: /(?:mysql:\/\/)[^\s'"]+/g, type: "MySQL Connection String" },
];

function checkHardcodedSecrets(
  filePath: string,
  content: string,
  _context: CheckContext,
): BiltCheckFinding[] {
  const findings: BiltCheckFinding[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("*")) continue;

    for (const { pattern, type } of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        findings.push({
          ruleId: "CHECK-SEC-ENV-002",
          category: "secrets-and-env",
          mode: "automated",
          severity: "critical",
          precision: "high",
          maturity: "stable",
          status: "fail",
          title: `Hardcoded ${type} in source code`,
          whyItMatters:
            `A ${type} is embedded directly in source code. Anyone with ` +
            "read access to this repository (or its git history) can extract " +
            "and use this credential.",
          technicalDetail:
            `Found ${type} pattern at ${filePath}:${i + 1}. ` +
            "Credentials should be stored in environment variables, not in code.",
          agentAction:
            `Move the ${type} to an environment variable. ` +
            "Reference it via process.env.VARIABLE_NAME. " +
            "Rotate the exposed credential immediately.",
          fixable: true,
          file: filePath,
          line: i + 1,
          fingerprint: generateCheckFingerprint("CHECK-SEC-ENV-002", filePath, i + 1),
        });
        break; // One finding per line
      }
    }
  }

  return findings;
}

// ─── Helper: Check for secrets in client-side code ───────────────────────────

function checkClientSecrets(
  filePath: string,
  content: string,
  context: CheckContext,
): BiltCheckFinding[] {
  const findings: BiltCheckFinding[] = [];
  const lines = content.split("\n");

  // Get client-exposed prefixes from ecosystem
  const clientPrefixes = getClientPrefixes(context);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Check for service role / admin keys in client-side files
    const serviceKeyPatterns = [
      /supabase.*service[_-]?role/i,
      /SUPABASE_SERVICE_ROLE_KEY/,
      /firebase.*admin/i,
      /FIREBASE_ADMIN/,
      /DATABASE_URL/,
      /DB_PASSWORD/,
      /STRIPE_SECRET/i,
      /SECRET_KEY/,
      /PRIVATE_KEY/,
    ];

    for (const pattern of serviceKeyPatterns) {
      if (pattern.test(line)) {
        findings.push({
          ruleId: "CHECK-SEC-ENV-003",
          category: "secrets-and-env",
          mode: "automated",
          severity: "critical",
          precision: "high",
          maturity: "stable",
          status: "fail",
          title: "Server-side secret referenced in client-side code",
          whyItMatters:
            "Server-side secrets (service role keys, admin credentials, database URLs) " +
            "must never be available in client-side code. They will be included in the " +
            "JavaScript bundle sent to every user's browser.",
          technicalDetail:
            `${filePath}:${i + 1} references a server-side secret. ` +
            "Client-side code should only use public/anon keys. " +
            "Service role and admin keys must stay on the server.",
          agentAction:
            "Move this logic to a server-side API route or server action. " +
            "Client-side code should call your API, which uses the secret server-side.",
          fixable: false,
          file: filePath,
          line: i + 1,
          fingerprint: generateCheckFingerprint("CHECK-SEC-ENV-003", filePath, i + 1),
        });
        break;
      }
    }
  }

  return findings;
}

// ─── Utility Functions ───────────────────────────────────────────────────────

function isEnvFile(filePath: string): boolean {
  const basename = filePath.split("/").pop() || "";
  return (
    basename === ".env" ||
    basename.startsWith(".env.") &&
    !basename.endsWith(".example") &&
    !basename.endsWith(".template") &&
    !basename.endsWith(".sample")
  );
}

function isSourceFile(filePath: string): boolean {
  return /\.(ts|js|tsx|jsx|mjs|cjs)$/.test(filePath);
}

function isClientFile(filePath: string, context: CheckContext): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  // Next.js client components, React components, Vue components
  if (
    normalized.includes("/components/") ||
    normalized.includes("/pages/") && !normalized.includes("/api/") ||
    normalized.includes("/app/") && !normalized.includes("/api/") && !normalized.endsWith("route.ts") && !normalized.endsWith("route.js") ||
    normalized.includes("/src/") && (normalized.endsWith(".tsx") || normalized.endsWith(".jsx"))
  ) {
    return true;
  }
  return false;
}

function isPlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower === "your-key-here" ||
    lower === "xxx" ||
    lower === "placeholder" ||
    lower === "changeme" ||
    lower === "todo" ||
    lower.startsWith("your_") ||
    lower.startsWith("replace_") ||
    lower.includes("<your") ||
    lower.includes("example") ||
    value === "" ||
    value === '""' ||
    value === "''"
  );
}

function isSecretKey(key: string): boolean {
  const upper = key.toUpperCase();
  return (
    upper.includes("SECRET") ||
    upper.includes("PASSWORD") ||
    upper.includes("PRIVATE") ||
    upper.includes("TOKEN") ||
    upper.includes("API_KEY") ||
    upper.includes("APIKEY") ||
    upper.includes("ACCESS_KEY") ||
    upper.includes("SERVICE_ROLE") ||
    upper.includes("DATABASE_URL") ||
    upper.includes("DB_") ||
    upper.includes("MONGO") ||
    upper.includes("REDIS_URL") ||
    upper.includes("STRIPE_SECRET") ||
    upper.includes("AUTH_SECRET")
  );
}

function getClientPrefixes(context: CheckContext): string[] {
  const defaults = ["NEXT_PUBLIC_", "VITE_", "REACT_APP_", "EXPO_PUBLIC_", "NUXT_PUBLIC_", "PUBLIC_", "GATSBY_"];
  if (context.ecosystem?.clientExposedPrefixes) {
    return [...new Set([...defaults, ...context.ecosystem.clientExposedPrefixes])];
  }
  return defaults;
}
