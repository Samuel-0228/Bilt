import { describe, it, expect } from "vitest";
import { redactKnownSecrets } from "../../src/core/safety/sanitizer.js";

describe("Universal Secret Redaction & Leak Protection", () => {
  it("should redact GitHub personal access tokens", () => {
    const fakeGhp = ["ghp", "1234567890abcdef1234567890abcdef"].join("_");
    const raw = `Found token ${fakeGhp} in code`;
    const redacted = redactKnownSecrets(raw);
    expect(redacted).not.toContain("1234567890abcdef1234567890abcdef");
    expect(redacted).toContain("ghp_***");
  });

  it("should redact Stripe live and test secret keys", () => {
    const fakeStripe = ["sk", "live", "51OzX1234567890abcdefghijklm"].join("_");
    const raw = `stripe_key = '${fakeStripe}'`;
    const redacted = redactKnownSecrets(raw);
    expect(redacted).not.toContain("51OzX1234567890abcdefghijklm");
    expect(redacted).toContain("sk_l***");
  });

  it("should redact Anthropic API keys", () => {
    const fakeAnt = ["sk", "ant", "api03", "abcdef1234567890abcdef1234567890abcdef"].join("-");
    const raw = `client = Anthropic(api_key='${fakeAnt}')`;
    const redacted = redactKnownSecrets(raw);
    expect(redacted).not.toContain("abcdef1234567890abcdef1234567890abcdef");
    expect(redacted).toContain("sk-a***");
  });

  it("should redact SendGrid API keys", () => {
    const fakeSg = ["SG", "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"].join(".");
    const raw = `sg_key = '${fakeSg}'`;
    const redacted = redactKnownSecrets(raw);
    expect(redacted).not.toContain("abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
    expect(redacted).toContain("SG.a***");
  });

  it("should redact Resend API keys", () => {
    const fakeResend = ["re", "1234567890abcdef12345678"].join("_");
    const raw = `resend = Resend('${fakeResend}')`;
    const redacted = redactKnownSecrets(raw);
    expect(redacted).not.toContain("1234567890abcdef12345678");
    expect(redacted).toContain("re_1***");
  });

  it("should redact JSON Web Tokens (JWT)", () => {
    const raw = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const redacted = redactKnownSecrets(raw);
    expect(redacted).not.toContain("SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c");
  });

  it("should redact full RSA/EC private keys", () => {
    const raw = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y3e1...
-----END RSA PRIVATE KEY-----`;
    const redacted = redactKnownSecrets(raw);
    expect(redacted).not.toContain("MIIEowIBAAKCAQEA0Y3e1");
    expect(redacted).toContain("[PRIVATE_KEY_REDACTED]");
  });

  it("should safely handle empty or non-secret strings without modification", () => {
    expect(redactKnownSecrets("")).toBe("");
    expect(redactKnownSecrets("Normal log line with no keys")).toBe(
      "Normal log line with no keys",
    );
  });
});
