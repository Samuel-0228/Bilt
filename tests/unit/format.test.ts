import { describe, it, expect } from "vitest";
import {
  severityIcon,
  severityColor,
  maskSecret,
  formatHealthScore,
  formatProviderLink,
  formatFinding,
} from "../../src/ui/format.js";

describe("UI Format Utilities", () => {
  describe("severityIcon", () => {
    it("should return correct glyphs", () => {
      expect(severityIcon("critical")).toBe("✖");
      expect(severityIcon("warning")).toBe("▲");
      expect(severityIcon("info")).toBe("◆");
    });
  });

  describe("severityColor", () => {
    it("should return styling functions", () => {
      const critFn = severityColor("critical");
      const warnFn = severityColor("warning");
      const infoFn = severityColor("info");

      expect(typeof critFn).toBe("function");
      expect(typeof warnFn).toBe("function");
      expect(typeof infoFn).toBe("function");
    });
  });

  describe("maskSecret", () => {
    it("should mask values of length >= 12 showing start and end", () => {
      const masked = maskSecret("1234567890123456");
      expect(masked.startsWith("1234")).toBe(true);
      expect(masked.endsWith("3456")).toBe(true);
      expect(masked.includes("*")).toBe(true);
    });

    it("should fully mask very short values", () => {
      expect(maskSecret("1")).toBe("*");
      expect(maskSecret("12")).toBe("**");
    });

    it("should mask middle for intermediate values", () => {
      const masked = maskSecret("12345678");
      expect(masked.startsWith("12")).toBe(true);
      expect(masked.includes("*")).toBe(true);
    });
  });

  describe("formatHealthScore", () => {
    it("should generate valid colored score bar strings", () => {
      const output = formatHealthScore(100);
      expect(output).toContain("100/100");
    });
  });

  describe("formatProviderLink", () => {
    it("should contain name and rotation URL", () => {
      const provider = {
        name: "stripe",
        displayName: "Stripe",
        icon: "💳",
        rotationUrl: "https://dashboard.stripe.com/apikeys",
        docsUrl: "https://stripe.com/docs",
      };
      const output = formatProviderLink(provider);
      expect(output).toContain("Stripe");
      expect(output).toContain("https://dashboard.stripe.com/apikeys");
    });
  });

  describe("formatFinding", () => {
    const mockFinding = {
      id: "env-missing-production",
      file: ".env",
      line: 5,
      severity: "warning" as const,
      category: "env-mismatch" as const,
      message: "STRIPE_KEY missing from .env.production",
      matchedValue: "STRIPE_KEY",
    };

    it("should format standard finding headline", () => {
      const result = formatFinding(mockFinding, "headline");
      expect(result).toContain("STRIPE_KEY missing from .env.production");
    });

    it("should format standard finding detail", () => {
      const result = formatFinding(mockFinding, "detail");
      expect(result).toContain("STRIPE_KEY missing from .env.production");
      expect(result).toContain(".env");
    });

    it("should format verified-live secret", () => {
      const secretFinding = {
        ...mockFinding,
        category: "secret-detected" as const,
        verificationState: "verified-live" as const,
      };
      const result1 = formatFinding(secretFinding, "headline");
      expect(result1).toContain("[verified-live]");

      const result2 = formatFinding(secretFinding, "detail");
      expect(result2).toContain("[verified-live]");
    });

    it("should format unverified secret", () => {
      const secretFinding = {
        ...mockFinding,
        category: "secret-detected" as const,
        verificationState: "unverified" as const,
      };
      const result1 = formatFinding(secretFinding, "headline");
      expect(result1).toContain("[unverified]");

      const result2 = formatFinding(secretFinding, "detail");
      expect(result2).toContain("[unverified]");
    });

    it("should format verified-dead secret", () => {
      const secretFinding = {
        ...mockFinding,
        category: "secret-detected" as const,
        verificationState: "verified-dead" as const,
      };
      const result1 = formatFinding(secretFinding, "headline");
      expect(result1).toContain("[verified-dead]");

      const result2 = formatFinding(secretFinding, "detail");
      expect(result2).toContain("[verified-dead]");
    });
  });
});
