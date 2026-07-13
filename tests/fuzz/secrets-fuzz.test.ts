import { describe, it, expect } from "vitest";
import { scanFileForSecrets } from "../../src/core/scan/secrets.js";
import { SECRET_RULES } from "../../src/core/rules/secret-rules.js";
import { DEFAULT_CONFIG } from "../../src/config/config.js";

describe("Secrets Detection Fuzz Tests", () => {
  // Generate random characters
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,./<>?~` \n\t";

  function generateRandomString(length: number): string {
    let result = "";
    for (let i = 0; i < length; i++) {
      const idx = Math.floor(Math.random() * chars.length);
      result += chars[idx];
    }
    return result;
  }

  it("should scan random inputs without crashing", () => {
    for (let i = 0; i < 1000; i++) {
      const len = Math.floor(Math.random() * 192) + 8; // length 8 to 200
      const fuzzString = generateRandomString(len);

      expect(() => {
        scanFileForSecrets(
          fuzzString,
          `fuzz-${i}.txt`,
          SECRET_RULES,
          DEFAULT_CONFIG.entropyThreshold,
        );
      }).not.toThrow();
    }
  });

  it("should handle strings similar to keys but slightly modified without false positives", () => {
    // Modify a few chars in standard keys to check robustness
    const closeAWSKey = "AKIA" + "1234567890ABCDEF"; // valid length and prefix but maybe low entropy or modified
    const closeStripeKey = "sk_test_" + "abc"; // too short
    const closeOpenAIKey = "sk-" + "abc123"; // too short

    const content = `
      const aws = "${closeAWSKey}";
      const stripe = "${closeStripeKey}";
      const openai = "${closeOpenAIKey}";
    `;

    const findings = scanFileForSecrets(
      content,
      "close-calls.js",
      SECRET_RULES,
      DEFAULT_CONFIG.entropyThreshold,
    );

    // Should not flag stripe or openai because they are too short
    const stripeFindings = findings.filter((f) =>
      f.message.toLowerCase().includes("stripe"),
    );
    const openaiFindings = findings.filter((f) =>
      f.message.toLowerCase().includes("openai"),
    );

    expect(stripeFindings.length).toBe(0);
    expect(openaiFindings.length).toBe(0);
  });
});
