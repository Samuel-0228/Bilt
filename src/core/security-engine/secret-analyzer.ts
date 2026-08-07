import type { ASTContext, RuleConfidence } from "./types.js";

export interface SecretClassification {
  isSecret: boolean;
  isSafe: boolean;
  type: string;
  confidence: RuleConfidence;
  reason: string;
}

export class SecretAnalyzer {
  /** Known safe public prefix patterns */
  private static SAFE_PREFIXES = [
    "NEXT_PUBLIC_",
    "VITE_PUBLIC_",
    "VITE_",
    "PUBLIC_",
    "REACT_APP_PUBLIC_",
    "EXPO_PUBLIC_",
    "NUXT_PUBLIC_",
  ];

  /** Known safe values (e.g. Supabase anon key default examples or public keys) */
  private static SAFE_PATTERNS = [
    /supabase_anon_key/i,
    /anon_key/i,
    /public_key/i,
    /publishable_key/i,
    /pk_test_/i,
    /pk_live_/i,
  ];

  /** Unsafe secret patterns */
  private static UNSAFE_SECRET_PATTERNS: Array<{
    type: string;
    pattern: RegExp;
    confidence: RuleConfidence;
    reason: string;
  }> = [
    {
      type: "service_role",
      pattern: /(service_role|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_KEY)\s*[:=]\s*['"`]?([a-zA-Z0-9.\-_]{20,})['"`]?/i,
      confidence: "high",
      reason: "Supabase service_role key has full admin bypass capabilities over RLS.",
    },
    {
      type: "database_password",
      pattern: /(postgres(ql)?|mysql|mongodb(\+srv)?):\/\/[^:]+:([^@\s"']+)@/i,
      confidence: "high",
      reason: "Database connection string containing plaintext password.",
    },
    {
      type: "private_key",
      pattern: /-----BEGIN (RSA|EC|OPENSSH|DSA|PRIVATE) KEY-----/i,
      confidence: "high",
      reason: "Embedded RSA/SSH Private Key file or string.",
    },
    {
      type: "aws_secret",
      pattern: /(aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*['"`]?([A-Za-z0-9/+=]{40})['"`]?/i,
      confidence: "high",
      reason: "AWS Secret Access Key exposed in source.",
    },
    {
      type: "jwt_secret",
      pattern: /(jwt_secret|JWT_SECRET|TOKEN_SECRET|SECRET_KEY)\s*[:=]\s*['"`]([a-zA-Z0-9_\-!@#$%^&*()]{10,})['"`]/i,
      confidence: "high",
      reason: "JWT secret key used to sign and verify tokens.",
    },
    {
      type: "openai_key",
      pattern: /(sk-[a-zA-Z0-9]{32,}|sk-proj-[a-zA-Z0-9_\-]{40,})/i,
      confidence: "high",
      reason: "OpenAI API secret key.",
    },
    {
      type: "anthropic_key",
      pattern: /(sk-ant-api[a-zA-Z0-9_\-]{30,})/i,
      confidence: "high",
      reason: "Anthropic Claude API key.",
    },
    {
      type: "stripe_secret",
      pattern: /(sk_test_[0-9a-zA-Z]{24,}|sk_live_[0-9a-zA-Z]{24,})/i,
      confidence: "high",
      reason: "Stripe API secret key.",
    },
    {
      type: "github_token",
      pattern: /(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})/i,
      confidence: "high",
      reason: "GitHub Personal Access Token.",
    },
    {
      type: "generic_secret_assignment",
      pattern: /(secret|password|api_key|access_token|private_key)\s*[:=]\s*['"`]([a-zA-Z0-9_\-!@#$%^&*()]{16,})['"`]/i,
      confidence: "medium",
      reason: "Hardcoded secret or password variable assignment.",
    },
  ];

  /**
   * Classify a variable key/value pair as SAFE vs UNSAFE
   */
  public static classifyKey(key: string, value?: string): SecretClassification {
    const uppercaseKey = key.toUpperCase();

    // Check if explicitly safe prefix
    const isSafePrefix = SecretAnalyzer.SAFE_PREFIXES.some((prefix) => uppercaseKey.startsWith(prefix));
    if (isSafePrefix) {
      return {
        isSecret: false,
        isSafe: true,
        type: "client_public_var",
        confidence: "high",
        reason: `Variable ${key} uses client-safe public prefix.`,
      };
    }

    // Check if key implies Supabase anon or publishable key
    if (
      uppercaseKey.includes("ANON") ||
      uppercaseKey.includes("PUBLISHABLE") ||
      uppercaseKey.includes("PUBLIC_KEY")
    ) {
      return {
        isSecret: false,
        isSafe: true,
        type: "public_anon_key",
        confidence: "high",
        reason: `Key ${key} is designated as public/anon key.`,
      };
    }

    // Check unsafe key names
    if (
      uppercaseKey.includes("SERVICE_ROLE") ||
      uppercaseKey.includes("SERVICE_KEY") ||
      uppercaseKey.includes("DATABASE_URL") ||
      uppercaseKey.includes("DB_PASSWORD") ||
      uppercaseKey.includes("PRIVATE_KEY") ||
      uppercaseKey.includes("AWS_SECRET") ||
      uppercaseKey.includes("JWT_SECRET") ||
      uppercaseKey.includes("OPENAI_API_KEY") ||
      uppercaseKey.includes("ANTHROPIC_API_KEY") ||
      uppercaseKey.includes("STRIPE_SECRET_KEY")
    ) {
      return {
        isSecret: true,
        isSafe: false,
        type: "backend_secret",
        confidence: "high",
        reason: `Key ${key} represents a sensitive backend secret that must not be exposed to clients or checked into source.`,
      };
    }

    if (value) {
      for (const item of SecretAnalyzer.UNSAFE_SECRET_PATTERNS) {
        if (item.pattern.test(value) || item.pattern.test(`${key}=${value}`)) {
          return {
            isSecret: true,
            isSafe: false,
            type: item.type,
            confidence: item.confidence,
            reason: item.reason,
          };
        }
      }
    }

    return {
      isSecret: false,
      isSafe: true,
      type: "standard_var",
      confidence: "low",
      reason: `Key ${key} does not match known secret rules.`,
    };
  }

  /**
   * Scans text content (comments, markdown, prompt templates, dockerfiles, JSON, YAML) for secrets
   */
  public static scanTextForSecrets(content: string, filePath: string): Array<{
    type: string;
    line: number;
    snippet: string;
    reason: string;
    confidence: RuleConfidence;
  }> {
    const results: Array<{
      type: string;
      line: number;
      snippet: string;
      reason: string;
      confidence: RuleConfidence;
    }> = [];

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      if (!lineText) continue;

      // Skip obvious placeholders
      if (
        lineText.includes("your-api-key") ||
        lineText.includes("your_secret_here") ||
        lineText.includes("YOUR_API_KEY") ||
        lineText.includes("example_key") ||
        lineText.includes("0000000000000000")
      ) {
        continue;
      }

      for (const item of SecretAnalyzer.UNSAFE_SECRET_PATTERNS) {
        const match = item.pattern.exec(lineText);
        if (match) {
          // If in client-side public variable, skip if safe
          const keyMatch = lineText.match(/([A-Z0-9_]+)\s*=/i);
          if (keyMatch && keyMatch[1]) {
            const key = keyMatch[1];
            if (SecretAnalyzer.SAFE_PREFIXES.some((p) => key.toUpperCase().startsWith(p))) {
              continue;
            }
          }

          results.push({
            type: item.type,
            line: i + 1,
            snippet: lineText.trim(),
            reason: item.reason,
            confidence: item.confidence,
          });
        }
      }
    }

    return results;
  }
}
