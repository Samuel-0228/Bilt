import { describe, it, expect, vi, afterEach } from "vitest";
import { generateAIExplanation, generateAIExplanationWithFallback } from "../../src/core/ai/explainer.js";
import type { ScanFinding } from "../../src/types/index.js";

describe("AI Fallback Path", () => {
  const mockFinding: ScanFinding = {
    id: "f-test-1",
    severity: "critical",
    category: "secret-detected",
    message: "Stripe Secret Key detected",
    file: "src/config.ts",
    line: 10,
    provider: {
      name: "stripe",
      displayName: "Stripe",
      icon: "stripe",
      rotationUrl: "https://dashboard.stripe.com",
      docsUrl: "https://stripe.com/docs",
    },
  };

  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should return static explanation when no key is configured", async () => {
    const explanation = await generateAIExplanationWithFallback(mockFinding);
    expect(explanation).toBeDefined();
    expect(explanation.whatIsIt).toContain("Hardcoded Stripe secret key");
  });

  it("should fall back gracefully to static explanation when AI call times out or throws error", async () => {
    // Mock network failure
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network timeout after 2500ms"));

    const explanation = await generateAIExplanationWithFallback(mockFinding);
    expect(explanation).toEqual(generateAIExplanation(mockFinding));
  });
});
