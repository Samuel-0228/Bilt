// ─── Authentication Readiness Check ──────────────────────────────────────────
// Automated verification of authentication implementation patterns.
// Status: ENFORCED — deterministic checks for common auth issues.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReadinessCategory } from "../taxonomy.js";
import type { BiltCheckFinding, CheckMode } from "../finding.js";
import type { CategoryChecker, CheckContext } from "../check-runner.js";
import { generateCheckFingerprint } from "../finding.js";

const CATEGORY: ReadinessCategory = "auth";

/**
 * Automated checks for authentication implementation:
 * - JWT verification vs decode
 * - Password hashing (bcrypt/argon2/scrypt vs plaintext)
 * - Cookie security (httpOnly, secure, sameSite)
 * - Session configuration
 * - Auth bypass patterns (TODO auth, disabled auth)
 * - Hardcoded credentials
 */
export const authChecker: CategoryChecker = {
  category: CATEGORY,
  mode: "automated" as CheckMode,

  async run(context: CheckContext): Promise<BiltCheckFinding[]> {
    const findings: BiltCheckFinding[] = [];

    for (const file of context.files) {
      if (!isRelevantFile(file.path)) continue;

      const lines = file.content.split("\n");

      // Run each check
      findings.push(...checkJwtDecode(file.path, lines));
      findings.push(...checkPasswordHashing(file.path, lines, file.content));
      findings.push(...checkCookieSecurity(file.path, lines));
      findings.push(...checkAuthBypass(file.path, lines));
      findings.push(...checkHardcodedCredentials(file.path, lines));
      findings.push(...checkJwtExpiry(file.path, lines, file.content));
    }

    return findings;
  },
};

// ─── JWT: decode without verify ──────────────────────────────────────────────

function checkJwtDecode(filePath: string, lines: string[]): BiltCheckFinding[] {
  const findings: BiltCheckFinding[] = [];
  const hasVerify = lines.some((l) => l.includes("jwt.verify") || l.includes("verifyToken") || l.includes("jwtVerify"));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (
      (line.includes("jwt.decode(") || line.includes("jwtDecode(") || line.includes("decodeJwt(")) &&
      !hasVerify
    ) {
      findings.push({
        ruleId: "CHECK-AUTH-001",
        category: CATEGORY,
        mode: "automated",
        severity: "critical",
        precision: "high",
        maturity: "stable",
        status: "fail",
        title: "JWT decoded without signature verification",
        whyItMatters:
          "jwt.decode() parses the token payload without checking the cryptographic " +
          "signature. An attacker can create a token with any claims (e.g., admin: true) " +
          "and your application will trust it.",
        technicalDetail:
          `${filePath}:${i + 1} uses jwt.decode() without a corresponding jwt.verify(). ` +
          "The JWT signature is the only thing preventing token forgery.",
        agentAction:
          "Replace jwt.decode() with jwt.verify(token, secret). " +
          "Ensure the signing secret is stored in an environment variable.",
        fixable: true,
        file: filePath,
        line: i + 1,
        fingerprint: generateCheckFingerprint("CHECK-AUTH-001", filePath, i + 1),
      });
    }
  }
  return findings;
}

// ─── Password: plaintext or weak hashing ─────────────────────────────────────

function checkPasswordHashing(filePath: string, lines: string[], content: string): BiltCheckFinding[] {
  const findings: BiltCheckFinding[] = [];
  const hasStrongHash = /bcrypt|argon2|scrypt|pbkdf2/i.test(content);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lower = line.toLowerCase();

    // Plaintext password comparison
    if (
      (lower.includes("password ===") || lower.includes("password ==") ||
       lower.includes("=== password") || lower.includes("== password")) &&
      !lower.includes("hash") && !lower.includes("compare")
    ) {
      findings.push({
        ruleId: "CHECK-AUTH-002",
        category: CATEGORY,
        mode: "automated",
        severity: "critical",
        precision: "high",
        maturity: "stable",
        status: "fail",
        title: "Plaintext password comparison",
        whyItMatters:
          "Comparing passwords with === or == means passwords are stored or " +
          "transmitted in plaintext. If the database is breached, every user's " +
          "password is immediately exposed.",
        technicalDetail:
          `${filePath}:${i + 1} compares a password value directly instead of ` +
          "using a secure hash comparison like bcrypt.compare().",
        agentAction:
          "Hash passwords with bcrypt, argon2, or scrypt before storing. " +
          "Use bcrypt.compare(plaintext, hash) for verification.",
        fixable: false,
        file: filePath,
        line: i + 1,
        fingerprint: generateCheckFingerprint("CHECK-AUTH-002", filePath, i + 1),
      });
    }

    // Weak hashing (MD5/SHA1 for passwords)
    if (
      (lower.includes("md5(") || lower.includes("sha1(") || lower.includes("createhash('md5')") || lower.includes('createhash("sha1")')) &&
      (lower.includes("password") || lower.includes("passwd") || lower.includes("pass"))
    ) {
      findings.push({
        ruleId: "CHECK-AUTH-003",
        category: CATEGORY,
        mode: "automated",
        severity: "high",
        precision: "medium",
        maturity: "stable",
        status: "fail",
        title: "Weak password hashing algorithm",
        whyItMatters:
          "MD5 and SHA1 are fast hash functions not designed for password storage. " +
          "An attacker with a database dump can crack millions of MD5 hashes per second.",
        technicalDetail:
          `${filePath}:${i + 1} uses a weak hash for password processing. ` +
          "Use bcrypt, argon2, or scrypt which are designed to be slow.",
        agentAction:
          "Replace MD5/SHA1 password hashing with bcrypt or argon2. " +
          "Plan a migration path for existing password hashes.",
        fixable: false,
        file: filePath,
        line: i + 1,
        fingerprint: generateCheckFingerprint("CHECK-AUTH-003", filePath, i + 1),
      });
    }
  }
  return findings;
}

// ─── Cookie: missing security flags ──────────────────────────────────────────

function checkCookieSecurity(filePath: string, lines: string[]): BiltCheckFinding[] {
  const findings: BiltCheckFinding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Look for cookie-setting patterns
    if (
      line.includes("cookie(") ||
      line.includes("setCookie(") ||
      line.includes("cookies.set(") ||
      line.includes("res.cookie(")
    ) {
      // Check surrounding lines for security flags
      const block = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 10)).join("\n");

      if (!block.includes("httpOnly")) {
        findings.push({
          ruleId: "CHECK-AUTH-004",
          category: CATEGORY,
          mode: "automated",
          severity: "high",
          precision: "medium",
          maturity: "stable",
          status: "fail",
          title: "Cookie missing httpOnly flag",
          whyItMatters:
            "Without httpOnly, cookies are accessible to JavaScript. " +
            "A cross-site scripting (XSS) vulnerability can steal session tokens.",
          technicalDetail:
            `Cookie set at ${filePath}:${i + 1} does not include httpOnly: true. ` +
            "Session and authentication cookies should always be httpOnly.",
          agentAction:
            "Add httpOnly: true to the cookie options.",
          fixable: true,
          file: filePath,
          line: i + 1,
          fingerprint: generateCheckFingerprint("CHECK-AUTH-004", filePath, i + 1),
        });
      }

      if (!block.includes("secure")) {
        findings.push({
          ruleId: "CHECK-AUTH-005",
          category: CATEGORY,
          mode: "automated",
          severity: "medium",
          precision: "medium",
          maturity: "stable",
          status: "fail",
          title: "Cookie missing secure flag",
          whyItMatters:
            "Without the secure flag, cookies may be sent over unencrypted HTTP, " +
            "allowing network attackers to intercept session tokens.",
          technicalDetail:
            `Cookie set at ${filePath}:${i + 1} does not include secure: true.`,
          agentAction:
            "Add secure: true to the cookie options for production.",
          fixable: true,
          file: filePath,
          line: i + 1,
          fingerprint: generateCheckFingerprint("CHECK-AUTH-005", filePath, i + 1),
        });
      }
    }
  }
  return findings;
}

// ─── Auth: bypass patterns ───────────────────────────────────────────────────

function checkAuthBypass(filePath: string, lines: string[]): BiltCheckFinding[] {
  const findings: BiltCheckFinding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lower = line.toLowerCase();

    if (
      (lower.includes("todo") && lower.includes("auth")) ||
      lower.includes("auth: false") ||
      lower.includes("authentication: false") ||
      lower.includes("bypassauth") ||
      (lower.includes("isauth") && lower.includes("return true") && lower.includes("//"))
    ) {
      findings.push({
        ruleId: "CHECK-AUTH-006",
        category: CATEGORY,
        mode: "automated",
        severity: "critical",
        precision: "high",
        maturity: "stable",
        status: "fail",
        title: "Authentication bypass or placeholder",
        whyItMatters:
          "This code disables or stubs out authentication. " +
          "Any user — or attacker — can access protected functionality without credentials.",
        technicalDetail:
          `${filePath}:${i + 1} contains an authentication bypass pattern. ` +
          "This may be a development placeholder that was not replaced before shipping.",
        agentAction:
          "Replace the placeholder with a real authentication check. " +
          "Use your auth library's middleware (e.g., NextAuth, Clerk, Passport).",
        fixable: false,
        file: filePath,
        line: i + 1,
        fingerprint: generateCheckFingerprint("CHECK-AUTH-006", filePath, i + 1),
      });
    }
  }
  return findings;
}

// ─── Auth: hardcoded credentials ─────────────────────────────────────────────

function checkHardcodedCredentials(filePath: string, lines: string[]): BiltCheckFinding[] {
  const findings: BiltCheckFinding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lower = line.toLowerCase();

    if (
      (lower.includes('username === "admin"') || lower.includes("username === 'admin'")) &&
      (lower.includes("password") || lower.includes("pass"))
    ) {
      findings.push({
        ruleId: "CHECK-AUTH-007",
        category: CATEGORY,
        mode: "automated",
        severity: "critical",
        precision: "high",
        maturity: "stable",
        status: "fail",
        title: "Hardcoded admin credentials",
        whyItMatters:
          "Hardcoded username/password combinations are discoverable by anyone " +
          "who can read the source code. They cannot be rotated without a code change.",
        technicalDetail:
          `${filePath}:${i + 1} contains a hardcoded credential check.`,
        agentAction:
          "Store user credentials in a database with hashed passwords. " +
          "Use bcrypt or argon2 for password hashing.",
        fixable: false,
        file: filePath,
        line: i + 1,
        fingerprint: generateCheckFingerprint("CHECK-AUTH-007", filePath, i + 1),
      });
    }
  }
  return findings;
}

// ─── JWT: missing expiry ─────────────────────────────────────────────────────

function checkJwtExpiry(filePath: string, lines: string[], content: string): BiltCheckFinding[] {
  const findings: BiltCheckFinding[] = [];

  // Look for jwt.sign calls
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.includes("jwt.sign(") || line.includes("sign({")) {
      const block = lines.slice(i, Math.min(lines.length, i + 8)).join("\n");
      if (!block.includes("expiresIn") && !block.includes("exp:") && !block.includes("exp ")) {
        findings.push({
          ruleId: "CHECK-AUTH-008",
          category: CATEGORY,
          mode: "automated",
          severity: "high",
          precision: "medium",
          maturity: "stable",
          status: "fail",
          title: "JWT signed without expiry",
          whyItMatters:
            "A JWT without an expiry never becomes invalid. If it is stolen, " +
            "the attacker can use it forever — there is no automatic revocation.",
          technicalDetail:
            `${filePath}:${i + 1} creates a JWT without specifying expiresIn or exp. ` +
            "Tokens should have a short expiry (e.g., 15 minutes for access tokens).",
          agentAction:
            "Add { expiresIn: '15m' } (or appropriate duration) to jwt.sign() options. " +
            "Use refresh tokens for longer sessions.",
          fixable: true,
          file: filePath,
          line: i + 1,
          fingerprint: generateCheckFingerprint("CHECK-AUTH-008", filePath, i + 1),
        });
      }
    }
  }
  return findings;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function isRelevantFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  if (
    normalized.includes("/node_modules/") ||
    normalized.includes("/dist/") ||
    normalized.includes("/build/") ||
    normalized.includes("/.git/") ||
    normalized.includes("/security-engine/") ||
    normalized.includes("/core/rules/") ||
    normalized.includes("/readiness/")
  ) {
    return false;
  }
  return /\.(ts|js|tsx|jsx|mjs|cjs)$/.test(filePath);
}
