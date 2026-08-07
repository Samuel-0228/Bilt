import { describe, it, expect } from "vitest";
import { SecretAnalyzer } from "../../../src/core/security-engine/secret-analyzer.js";

describe("SecretAnalyzer Unit Tests", () => {
  it("should classify NEXT_PUBLIC and Supabase anon variables as SAFE", () => {
    const res1 = SecretAnalyzer.classifyKey("NEXT_PUBLIC_SUPABASE_ANON_KEY", "eyJhbGciOi...");
    expect(res1.isSafe).toBe(true);
    expect(res1.isSecret).toBe(false);

    const res2 = SecretAnalyzer.classifyKey("VITE_PUBLIC_API_URL", "https://api.example.com");
    expect(res2.isSafe).toBe(true);
  });

  it("should classify service_role, database passwords, and private keys as UNSAFE", () => {
    const res1 = SecretAnalyzer.classifyKey("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOi...");
    expect(res1.isSafe).toBe(false);
    expect(res1.isSecret).toBe(true);

    const res2 = SecretAnalyzer.classifyKey("DATABASE_URL", "postgres://admin:secretPass123@localhost:5432/db");
    expect(res2.isSafe).toBe(false);
    expect(res2.isSecret).toBe(true);
  });

  it("should detect exposed secrets in markdown and text files", () => {
    const docContent = `
      # Documentation
      Here is the admin key:
      sk-proj-1234567890abcdef1234567890abcdef12345678
    `;
    const secrets = SecretAnalyzer.scanTextForSecrets(docContent, "README.md");
    expect(secrets.length).toBeGreaterThan(0);
    expect(secrets[0].type).toBe("openai_key");
  });
});
