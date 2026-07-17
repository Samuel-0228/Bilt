import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verify as verifyStripe } from "../../src/core/scan/verifiers/stripe.js";
import { verify as verifyGitHub } from "../../src/core/scan/verifiers/github.js";
import { verify as verifyOpenAI } from "../../src/core/scan/verifiers/openai.js";
import { verify as verifySlack } from "../../src/core/scan/verifiers/slack.js";
import { verify as verifySupabase } from "../../src/core/scan/verifiers/supabase.js";
import { verify as verifyAWS } from "../../src/core/scan/verifiers/aws.js";

describe("Verifier Modules", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("Stripe Verifier", () => {
    it("should return verified-live when API returns 200", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
      } as any);

      const result = await verifyStripe("sk_live_12345");
      expect(result).toBe("verified-live");
      expect(fetch).toHaveBeenCalledWith("https://api.stripe.com/v1/balance", expect.any(Object));
    });

    it("should return verified-dead when API returns 401", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 401,
      } as any);

      const result = await verifyStripe("sk_live_12345");
      expect(result).toBe("verified-dead");
    });
  });

  describe("GitHub Verifier", () => {
    it("should return verified-live when API returns 200", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
      } as any);

      const result = await verifyGitHub("ghp_12345");
      expect(result).toBe("verified-live");
    });

    it("should return verified-dead when API returns 401", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 401,
      } as any);

      const result = await verifyGitHub("ghp_12345");
      expect(result).toBe("verified-dead");
    });
  });

  describe("OpenAI Verifier", () => {
    it("should return verified-live when API returns 200", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
      } as any);

      const result = await verifyOpenAI("sk-12345");
      expect(result).toBe("verified-live");
    });

    it("should return verified-dead when API returns 401", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 401,
      } as any);

      const result = await verifyOpenAI("sk-12345");
      expect(result).toBe("verified-dead");
    });
  });

  describe("Slack Verifier", () => {
    it("should return verified-live when API returns 200 and ok is true", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        json: async () => ({ ok: true }),
      } as any);

      const result = await verifySlack("xoxb-12345");
      expect(result).toBe("verified-live");
    });

    it("should return verified-dead when API returns 200 and ok is false", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        json: async () => ({ ok: false }),
      } as any);

      const result = await verifySlack("xoxb-12345");
      expect(result).toBe("verified-dead");
    });
  });

  describe("Supabase Verifier", () => {
    it("should return verified-live when token is valid and API returns 200", async () => {
      const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64");
      const payload = Buffer.from(JSON.stringify({ iss: "https://xyz.supabase.co/auth/v1" })).toString("base64");
      const token = `${header}.${payload}.signature`;

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
      } as any);

      const result = await verifySupabase(token);
      expect(result).toBe("verified-live");
      expect(fetch).toHaveBeenCalledWith("https://xyz.supabase.co/rest/v1/", expect.any(Object));
    });

    it("should return unverified for non-jwt format", async () => {
      const result = await verifySupabase("invalid-format");
      expect(result).toBe("unverified");
    });
  });

  describe("AWS Verifier", () => {
    it("should return unverified if companion key is missing", async () => {
      const result = await verifyAWS("AKIA1234567890123456");
      expect(result).toBe("unverified");
    });
  });
});
