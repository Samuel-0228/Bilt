import { describe, it, expect } from "vitest";
import { redactForAI } from "../../src/core/ai/redact.js";
import type { ScanFinding } from "../../src/types/index.js";

describe("AI Redaction Engine", () => {
  it("should replace secret values with classification only and never include raw secret", () => {
    const rawSecret = "sk_live_" + "51NxXxXxXxXxXxXxXxXxXxXxX";
    const findings: ScanFinding[] = [
      {
        id: "finding-1",
        severity: "critical",
        category: "secret-detected",
        message: 'Stripe Secret Key detected STRIPE_KEY = "' + rawSecret + '"',
        file: "src/config.ts",
        line: 12,
        secret: rawSecret,
        preview: "sk_live_" + "...XxX",
        ruleId: "stripe-secret-key",
        provider: {
          name: "stripe",
          displayName: "Stripe",
          icon: "stripe",
          rotationUrl: "https://dashboard.stripe.com",
          docsUrl: "https://stripe.com/docs",
        },
      },
    ];

    const redacted = redactForAI({ findings });
    const jsonString = JSON.stringify(redacted);

    expect(jsonString).not.toContain(rawSecret);
    expect(redacted.findings[0].classification.type).toBe("stripe-secret-key");
    expect(redacted.findings[0].classification.context).toBe("hardcoded literal");
  });

  it("should strip emails, author comments, and IP addresses (PII) from snippets", () => {
    const findings: ScanFinding[] = [
      {
        id: "finding-2",
        severity: "warning",
        category: "env-exposed",
        message: "Exposed API key in client bundle",
        file: "src/utils/api.ts",
        line: 5,
        suggestion: "Author: Jane Doe (jane.doe@company.com)\nServer IP: 192.168.1.100\nAPI_KEY = secret123",
        secret: "secret123",
      },
    ];

    const redacted = redactForAI({ findings });
    const snippet = redacted.findings[0].snippet;

    expect(snippet).not.toContain("jane.doe@company.com");
    expect(snippet).not.toContain("Jane Doe");
    expect(snippet).not.toContain("192.168.1.100");
    expect(snippet).not.toContain("secret123");
    expect(snippet).toContain("[EMAIL_REDACTED]");
    expect(snippet).toContain("[NAME_REDACTED]");
    expect(snippet).toContain("[IP_REDACTED]");
    expect(snippet).toContain("[SECRET_VALUE_REDACTED]");
  });

  it("should limit snippets to line +- 1 (maximum 3 lines)", () => {
    const multiLineSnippet = [
      "line 1: import fs from 'fs';",
      "line 2: import path from 'path';",
      "line 3: const secret = 'abc';",
      "line 4: console.log('hello');",
      "line 5: console.log('world');",
      "line 6: export default secret;",
    ].join("\n");

    const findings: ScanFinding[] = [
      {
        id: "finding-3",
        severity: "critical",
        category: "secret-detected",
        message: "Secret on line 3",
        file: "src/index.ts",
        line: 3,
        suggestion: multiLineSnippet,
      },
    ];

    const redacted = redactForAI({ findings });
    const snippet = redacted.findings[0].snippet;
    const lineCount = snippet?.split("\n").length;

    expect(lineCount).toBeLessThanOrEqual(3);
    expect(snippet).not.toContain("line 5");
    expect(snippet).not.toContain("line 6");
  });
});
