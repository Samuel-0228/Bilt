// ─── AI Issue Explanation Engine ────────────────────────────────────────────
// Generates structured 6-question AI explanations for findings.
// Operates locally with rich domain knowledge, with optional AI API enhancement & 2.5s fallback.
// ─────────────────────────────────────────────────────────────────────────────

import type { ScanFinding, AIExplanation } from "../../types/index.js";
import { getAIConfig } from "./config.js";
import { getApiKey } from "./storage.js";
import { getProvider } from "./providers/index.js";
import { redactForAI } from "./redact.js";

/**
 * Static local 6-part AI Explanation for a finding (0 network calls, 100% reliable local baseline).
 */
export function generateAIExplanation(finding: ScanFinding): AIExplanation {
  const cat = finding.category;
  const msg = finding.message;
  const sev = finding.severity;

  // 1. Secret / Credential Leaks
  if (cat === "secret-detected" || cat === "git-history-secret") {
    const providerName = finding.provider?.displayName || "Third-Party API Provider";
    const verification = finding.verificationState === "verified-live"
      ? "This credential is LIVE and active."
      : finding.verificationState === "verified-dead"
        ? "This credential appears inactive/revoked."
        : "Unverified liveness status.";

    return {
      whatIsIt: `Hardcoded ${providerName} secret key detected in ${finding.file}.`,
      whyIsItAProblem: `Embedding credentials directly in source code or Git history allows unauthorized access to production resources, cloud infrastructure, or user data if committed to public/shared repositories. ${verification}`,
      howSerious: sev === "critical"
        ? "Critical. Hardcoded secrets can lead to account takeover, data breaches, and heavy unexpected cloud bills."
        : "High. Exposed keys risk compromise.",
      canItBeExploited: "Yes. Automated bot scrapers search public GitHub repos within seconds of code pushes to extract exposed API keys.",
      howToFix: `1. Move the secret into a local .env file (not tracked in Git).\n2. Reference it via process.env.\n3. Rotate/revoke the credential at ${finding.provider?.rotationUrl || "the provider portal"}.`,
      canBiltFix: true,
    };
  }

  // 2. Client-Exposed Secrets
  if (cat === "env-exposed") {
    return {
      whatIsIt: "Server secret exposed to the client bundle via a public environment variable prefix.",
      whyIsItAProblem: "Frameworks bundle any environment variable matching public prefixes (e.g., NEXT_PUBLIC_, VITE_) directly into client JavaScript delivered to browsers.",
      howSerious: "Critical. Anyone viewing your website can inspect client bundle JS and extract private database credentials or API secrets.",
      canItBeExploited: "Trivially. Open browser DevTools → Console / Sources and type the exposed prefix name.",
      howToFix: "Remove the public prefix (e.g. rename NEXT_PUBLIC_SECRET_KEY to SECRET_KEY) so it remains server-side only.",
      canBiltFix: true,
    };
  }

  // 3. Environment Variable Issues
  if (cat === "env-missing") {
    return {
      whatIsIt: "Environment variable referenced in code but missing from .env file.",
      whyIsItAProblem: "Code expecting runtime environment variables will receive undefined, causing runtime crashes or unhandled exceptions.",
      howSerious: "High. Prevents application from starting or crashes during execution.",
      canItBeExploited: "No, but it causes availability outages and crash loops.",
      howToFix: `Add the missing variable key to your .env file and .env.example.`,
      canBiltFix: true,
    };
  }

  if (cat === "env-unused") {
    return {
      whatIsIt: "Environment variable defined in .env but never referenced in source code.",
      whyIsItAProblem: "Dead or obsolete environment variables clutter configuration and create confusion for team members.",
      howSerious: "Info / Low. Cleanliness and maintenance issue.",
      canItBeExploited: "No direct security risk.",
      howToFix: "Remove the unused entry from .env if no longer needed.",
      canBiltFix: true,
    };
  }

  if (cat === "env-mismatch") {
    return {
      whatIsIt: "Mismatch between keys declared in .env vs .env.example or production environment files.",
      whyIsItAProblem: "New team members cloning the repo or CI deployment pipelines will lack required environment keys.",
      howSerious: "Medium. Disrupts developer onboarding and deployment pipelines.",
      canItBeExploited: "No direct security risk.",
      howToFix: "Synchronize .env.example so it matches all required key names.",
      canBiltFix: true,
    };
  }

  // 4. Git Hygiene
  if (cat === "gitignore-missing" || cat === "git-committed-env") {
    return {
      whatIsIt: "Sensitive file or directory not properly ignored in .gitignore.",
      whyIsItAProblem: "Local environment files containing secrets or heavy build artifacts like node_modules risk being committed to remote Git history.",
      howSerious: "Critical if .env file is involved; Warning if build directories are missing.",
      canItBeExploited: "Yes. Once committed to Git, secrets remain visible in commit history even if deleted in later commits.",
      howToFix: `Add rule to .gitignore file.`,
      canBiltFix: true,
    };
  }

  if (cat === "git-large-file") {
    return {
      whatIsIt: "Large binary or media file (>5MB) detected in Git working tree.",
      whyIsItAProblem: "Storing large binaries directly in Git bloats repository size, slows down git clone/pull, and degrades developer experience.",
      howSerious: "Medium. Impairs repo performance.",
      canItBeExploited: "No.",
      howToFix: "Use Git LFS (Large File Storage) or external object storage (S3/Cloudinary).",
      canBiltFix: false,
    };
  }

  if (cat === "git-hygiene") {
    return {
      whatIsIt: "Git commit hygiene warning (WIP commit, trailing whitespace, or unpushed force push risks).",
      whyIsItAProblem: "Unclean commits decrease repository maintainability and increase likelihood of regression bugs.",
      howSerious: "Info / Low.",
      canItBeExploited: "No.",
      howToFix: "Clean up commit message and stage clean changes before pushing.",
      canBiltFix: false,
    };
  }

  // 5. Dependency Intelligence
  if (cat === "dep-vulnerable") {
    return {
      whatIsIt: "Vulnerable package dependency detected in package manifest.",
      whyIsItAProblem: "Known CVE vulnerabilities in third-party npm packages can allow remote code execution, prototype pollution, or XSS.",
      howSerious: "High to Critical depending on CVE severity.",
      canItBeExploited: "Yes, automated exploit scripts target known npm package vulnerabilities.",
      howToFix: "Upgrade the vulnerable package to a patched version using your package manager.",
      canBiltFix: true,
    };
  }

  if (cat === "dep-duplicate" || cat === "dep-unused" || cat === "dep-outdated") {
    return {
      whatIsIt: `Dependency issue: ${msg}`,
      whyIsItAProblem: "Unused or duplicate packages increase install time, bloat node_modules, and slow down build pipelines.",
      howSerious: "Medium.",
      canItBeExploited: "No direct exploit risk.",
      howToFix: "Prune unused dependencies or deduplicate version ranges in package.json.",
      canBiltFix: true,
    };
  }

  // 6. Configuration Intelligence
  if (cat === "config-tsconfig" || cat === "config-docker" || cat === "config-ci" || cat === "config-package") {
    return {
      whatIsIt: `Risky configuration setting detected: ${msg}`,
      whyIsItAProblem: "Misconfigured tsconfig options (e.g. skipLibCheck false, strict false) or Docker/CI defaults lower code quality and build reliability.",
      howSerious: "Medium.",
      canItBeExploited: "Varies (e.g. Docker running as root exposes container escape vectors).",
      howToFix: "Adjust configuration setting to recommended security and strictness baseline.",
      canBiltFix: true,
    };
  }

  // 7. Performance Insights
  if (cat === "perf-image" || cat === "perf-bundle" || cat === "perf-import") {
    return {
      whatIsIt: `Performance bottleneck detected: ${msg}`,
      whyIsItAProblem: "Uncompressed images (>500KB) or heavy import patterns (e.g., importing full lodash instead of lodash-es) increase bundle size and slow page load times.",
      howSerious: "Medium / Warning.",
      canItBeExploited: "No.",
      howToFix: "Compress images (WebP/AVIF) and use tree-shakable modular package imports.",
      canBiltFix: false,
    };
  }

  // Generic fallback
  return {
    whatIsIt: msg,
    whyIsItAProblem: "Potential quality, security, or repository health degradation.",
    howSerious: sev === "critical" ? "High" : "Medium",
    canItBeExploited: "Depends on environment context.",
    howToFix: finding.suggestion || "Review and update the affected file.",
    canBiltFix: false,
  };
}

/**
 * Generate AI explanation with strict 2.5s network timeout and seamless static fallback.
 */
export async function generateAIExplanationWithFallback(finding: ScanFinding): Promise<AIExplanation> {
  const staticFallback = generateAIExplanation(finding);

  try {
    const config = getAIConfig();
    const activeProviderId = config.activeProvider;
    if (!activeProviderId) return staticFallback;

    const { key } = await getApiKey(activeProviderId);
    if (!key) return staticFallback;

    const provider = getProvider(activeProviderId);
    const redactedContext = redactForAI({ findings: [finding] });

    const prompt =
      "Analyze the redacted finding context and return ONLY a JSON object with keys: " +
      "whatIsIt, whyIsItAProblem, howSerious, canItBeExploited, howToFix, canBiltFix (boolean).";

    // Strict 2.5s network timeout for scan explanation enhancement
    const rawResponse = await provider.complete(prompt, redactedContext, undefined, key, 2500);

    // Extract JSON block if response contains markdown wrapper
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return staticFallback;

    const parsed = JSON.parse(jsonMatch[0]) as Partial<AIExplanation>;
    if (parsed.whatIsIt && parsed.whyIsItAProblem && parsed.howToFix) {
      return {
        whatIsIt: parsed.whatIsIt,
        whyIsItAProblem: parsed.whyIsItAProblem,
        howSerious: parsed.howSerious || staticFallback.howSerious,
        canItBeExploited: parsed.canItBeExploited || staticFallback.canItBeExploited,
        howToFix: parsed.howToFix,
        canBiltFix: typeof parsed.canBiltFix === "boolean" ? parsed.canBiltFix : staticFallback.canBiltFix,
      };
    }
  } catch {
    // Network error, rate limit, timeout, or parsing failure -> fallback immediately to static template
  }

  return staticFallback;
}
