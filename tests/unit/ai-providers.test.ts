import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getProvider, getAllProviders } from "../../src/core/ai/providers/index.js";
import type { RedactedContext } from "../../src/core/ai/types.js";

const mockContext: RedactedContext = {
  projectName: "test-app",
  framework: "nextjs",
  findings: [
    {
      id: "f-1",
      category: "secret-detected",
      severity: "critical",
      file: "src/secret.ts",
      line: 10,
      classification: {
        type: "stripe-secret-key",
        context: "hardcoded literal",
      },
      snippet: "const key = [SECRET_VALUE_REDACTED];",
    },
  ],
};

describe("AI Provider Adapters", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should list all supported providers with default fast/cheap models", () => {
    const providers = getAllProviders();
    expect(providers).toHaveLength(6);
    const ids = providers.map((p) => p.id);
    expect(ids).toEqual(["anthropic", "openai", "gemini", "openrouter", "groq", "local"]);
  });

  describe("OpenAI Provider", () => {
    it("should validate valid key and fail on invalid key", async () => {
      const provider = getProvider("openai");

      // Success mock
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      } as any);

      const isValid = await provider.validateKey("sk-valid-key");
      expect(isValid).toBe(true);

      // Failure mock
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      } as any);

      const isInvalid = await provider.validateKey("sk-invalid-key");
      expect(isInvalid).toBe(false);
    });

    it("should send correct request shape to OpenAI chat completions endpoint", async () => {
      const provider = getProvider("openai");
      let capturedUrl = "";
      let capturedBody: any = null;
      let capturedHeaders: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        capturedUrl = url;
        capturedHeaders = opts.headers;
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: "OpenAI explanation response" } }],
          }),
        };
      });

      const response = await provider.complete("Explain issue", mockContext, undefined, "sk-test-key");

      expect(capturedUrl).toBe("https://api.openai.com/v1/chat/completions");
      expect(capturedHeaders.Authorization).toBe("Bearer sk-test-key");
      expect(capturedBody.model).toBe("gpt-4o-mini");
      expect(response).toBe("OpenAI explanation response");
    });
  });

  describe("Anthropic Provider", () => {
    it("should send correct request shape and headers for Anthropic messages API", async () => {
      const provider = getProvider("anthropic");
      let capturedUrl = "";
      let capturedBody: any = null;
      let capturedHeaders: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        capturedUrl = url;
        capturedHeaders = opts.headers;
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true,
          json: async () => ({
            content: [{ text: "Anthropic explanation response" }],
          }),
        };
      });

      const response = await provider.complete("Explain issue", mockContext, undefined, "sk-ant-test-key");

      expect(capturedUrl).toBe("https://api.anthropic.com/v1/messages");
      expect(capturedHeaders["x-api-key"]).toBe("sk-ant-test-key");
      expect(capturedHeaders["anthropic-version"]).toBe("2023-06-01");
      expect(capturedBody.model).toBe("claude-3-haiku-20240307");
      expect(response).toBe("Anthropic explanation response");
    });
  });

  describe("Gemini Provider", () => {
    it("should send correct URL query params and request shape for Gemini API", async () => {
      const provider = getProvider("gemini");
      let capturedUrl = "";
      let capturedBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        capturedUrl = url;
        capturedBody = JSON.parse(opts.body);
        return {
          ok: true,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: "Gemini explanation response" }] } }],
          }),
        };
      });

      const response = await provider.complete("Explain issue", mockContext, undefined, "AIzaSyTestKey");

      expect(capturedUrl).toContain("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyTestKey");
      expect(capturedBody.contents[0].parts[0].text).toContain("Explain issue");
      expect(response).toBe("Gemini explanation response");
    });
  });

  describe("OpenRouter & Groq Providers", () => {
    it("should format OpenRouter request correctly", async () => {
      const provider = getProvider("openrouter");
      let capturedUrl = "";
      let capturedHeaders: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        capturedUrl = url;
        capturedHeaders = opts.headers;
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: "OpenRouter response" } }],
          }),
        };
      });

      const response = await provider.complete("Explain issue", mockContext, undefined, "sk-or-key");
      expect(capturedUrl).toBe("https://openrouter.ai/api/v1/chat/completions");
      expect(capturedHeaders["HTTP-Referer"]).toBe("https://bilt.dev");
      expect(response).toBe("OpenRouter response");
    });

    it("should format Groq request correctly", async () => {
      const provider = getProvider("groq");
      let capturedUrl = "";

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: "Groq response" } }],
          }),
        };
      });

      const response = await provider.complete("Explain issue", mockContext, undefined, "gsk-key");
      expect(capturedUrl).toBe("https://api.groq.com/openai/v1/chat/completions");
      expect(response).toBe("Groq response");
    });
  });
});
