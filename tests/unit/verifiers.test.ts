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

    it("should return unverified when API returns 500", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 500,
      } as any);

      const result = await verifyStripe("sk_live_12345");
      expect(result).toBe("unverified");
    });

    it("should return unverified when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      const result = await verifyStripe("sk_live_12345");
      expect(result).toBe("unverified");
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

    it("should return unverified when API returns 500", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 500,
      } as any);

      const result = await verifyGitHub("ghp_12345");
      expect(result).toBe("unverified");
    });

    it("should return unverified when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      const result = await verifyGitHub("ghp_12345");
      expect(result).toBe("unverified");
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

    it("should return unverified when API returns 500", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 500,
      } as any);

      const result = await verifyOpenAI("sk-12345");
      expect(result).toBe("unverified");
    });

    it("should return unverified when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      const result = await verifyOpenAI("sk-12345");
      expect(result).toBe("unverified");
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

    it("should return unverified when API returns 401", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 401,
        json: async () => ({ ok: false }),
      } as any);

      const result = await verifySlack("xoxb-12345");
      expect(result).toBe("unverified");
    });

    it("should return unverified when json parsing throws", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
        json: async () => { throw new Error("JSON error"); },
      } as any);

      const result = await verifySlack("xoxb-12345");
      expect(result).toBe("unverified");
    });

    it("should return unverified when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      const result = await verifySlack("xoxb-12345");
      expect(result).toBe("unverified");
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

    it("should return verified-dead when API returns 401 or 403", async () => {
      const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64");
      const payload = Buffer.from(JSON.stringify({ iss: "https://xyz.supabase.co/auth/v1" })).toString("base64");
      const token = `${header}.${payload}.signature`;

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 401,
      } as any);

      const result1 = await verifySupabase(token);
      expect(result1).toBe("verified-dead");

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 403,
      } as any);

      const result2 = await verifySupabase(token);
      expect(result2).toBe("verified-dead");
    });

    it("should return unverified when API returns 500", async () => {
      const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64");
      const payload = Buffer.from(JSON.stringify({ iss: "https://xyz.supabase.co/auth/v1" })).toString("base64");
      const token = `${header}.${payload}.signature`;

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 500,
      } as any);

      const result = await verifySupabase(token);
      expect(result).toBe("unverified");
    });

    it("should return unverified for non-jwt format", async () => {
      const result = await verifySupabase("invalid-format");
      expect(result).toBe("unverified");
    });

    it("should return unverified if iss claim is missing or invalid", async () => {
      const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64");
      const payload1 = Buffer.from(JSON.stringify({ iss: 123 })).toString("base64");
      const result1 = await verifySupabase(`${header}.${payload1}.sig`);
      expect(result1).toBe("unverified");

      const payload2 = Buffer.from(JSON.stringify({ iss: "https://invalid-domain.com" })).toString("base64");
      const result2 = await verifySupabase(`${header}.${payload2}.sig`);
      expect(result2).toBe("unverified");
    });

    it("should return unverified when fetch throws", async () => {
      const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64");
      const payload = Buffer.from(JSON.stringify({ iss: "https://xyz.supabase.co/auth/v1" })).toString("base64");
      const token = `${header}.${payload}.signature`;

      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      const result = await verifySupabase(token);
      expect(result).toBe("unverified");
    });
  });

  describe("AWS Verifier", () => {
    afterEach(() => {
      delete process.env.AWS_SECRET_ACCESS_KEY;
      delete process.env.AWS_ACCESS_KEY_ID;
    });

    it("should return unverified if companion key is missing", async () => {
      const result = await verifyAWS("AKIA1234567890123456");
      expect(result).toBe("unverified");
    });

    it("should return verified-live if key & companion secret are set and API returns 200", async () => {
      process.env.AWS_SECRET_ACCESS_KEY = "secret-key-12345";
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
      } as any);

      const result = await verifyAWS("AKIA1234567890123456");
      expect(result).toBe("verified-live");
    });

    it("should return verified-dead if API returns 403 with common validation errors", async () => {
      process.env.AWS_SECRET_ACCESS_KEY = "secret-key-12345";

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 403,
        text: async () => "<Code>InvalidClientTokenId</Code>",
      } as any);
      const result1 = await verifyAWS("AKIA1234567890123456");
      expect(result1).toBe("verified-dead");

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 403,
        text: async () => "<Code>SignatureDoesNotMatch</Code>",
      } as any);
      const result2 = await verifyAWS("AKIA1234567890123456");
      expect(result2).toBe("verified-dead");

      vi.mocked(fetch).mockResolvedValueOnce({
        status: 403,
        text: async () => "<Code>AuthFailure</Code>",
      } as any);
      const result3 = await verifyAWS("AKIA1234567890123456");
      expect(result3).toBe("verified-dead");
    });

    it("should return unverified if API returns 403 with other errors", async () => {
      process.env.AWS_SECRET_ACCESS_KEY = "secret-key-12345";
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 403,
        text: async () => "<Code>AccessDenied</Code>",
      } as any);

      const result = await verifyAWS("AKIA1234567890123456");
      expect(result).toBe("unverified");
    });

    it("should return unverified if API returns 500", async () => {
      process.env.AWS_SECRET_ACCESS_KEY = "secret-key-12345";
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 500,
      } as any);

      const result = await verifyAWS("AKIA1234567890123456");
      expect(result).toBe("unverified");
    });

    it("should find companion access key if given a secret key", async () => {
      process.env.AWS_ACCESS_KEY_ID = "AKIA1234567890123456";
      vi.mocked(fetch).mockResolvedValueOnce({
        status: 200,
      } as any);

      // Secret keys are 40 chars
      const result = await verifyAWS("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
      expect(result).toBe("verified-live");
    });

    it("should return unverified when fetch throws", async () => {
      process.env.AWS_SECRET_ACCESS_KEY = "secret-key-12345";
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      const result = await verifyAWS("AKIA1234567890123456");
      expect(result).toBe("unverified");
    });
  });
});
