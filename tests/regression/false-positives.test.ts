import { describe, it, expect } from "vitest";
import { scanFileForSecrets } from "../../src/core/scan/secrets.js";
import {
  checkClientExposedSecrets,
  detectFramework,
} from "../../src/core/scan/framework.js";
import { parseEnvFile } from "../../src/core/scan/env.js";
import { SECRET_RULES } from "../../src/core/rules/secret-rules.js";
import { DEFAULT_CONFIG } from "../../src/config/config.js";
import { createSnapshot } from "../../src/core/fix/snapshot.js";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Regression Tests — Bug & False Positive Fixes", () => {
  describe("AWS Secret Key Rule Fix", () => {
    it("should not match ordinary assignments using equal sign", () => {
      const codeContent = `
        const someVariable = "some-ordinary-value";
        const anotherVariable = 'another-value';
      `;
      const findings = scanFileForSecrets(
        codeContent,
        "index.js",
        SECRET_RULES,
        DEFAULT_CONFIG.entropyThreshold,
      );
      // Verify no AWS Secret Access Key was incorrectly detected in these ordinary assignments
      const awsSecretFindings = findings.filter(
        (f) => f.ruleId === "aws-secret-key",
      );
      expect(awsSecretFindings.length).toBe(0);
    });
  });

  describe("Supabase ANON_KEY and Client-Exposed Secret Exclusions", () => {
    it("should not flag Supabase public anon keys or Stripe publishable keys in framework check", async () => {
      // Supabase public JWT token format
      const anonKey =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
        "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvbWUtcmVmIn0." +
        "signature";
      const stripePublishableKey = "pk_test_" + "51Nzabc123";

      const envContent = `
        NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${stripePublishableKey}
        NEXT_PUBLIC_SOME_SECRET=sk_live_${"123456789012345678901234"}
      `;

      const parsedEnv = parseEnvFile(envContent, ".env");
      const nextjsFramework = {
        name: "nextjs",
        displayName: "Next.js",
        clientExposedPrefixes: ["NEXT_PUBLIC_"],
        configFiles: [],
      };

      const findings = checkClientExposedSecrets(
        [parsedEnv],
        nextjsFramework,
        SECRET_RULES,
        DEFAULT_CONFIG.entropyThreshold,
      );

      // It should NOT flag public anon key or public publishable key
      const anonKeyFindings = findings.filter((f) =>
        f.message.includes("SUPABASE_ANON_KEY"),
      );
      const stripeKeyFindings = findings.filter((f) =>
        f.message.includes("STRIPE_PUBLISHABLE_KEY"),
      );
      expect(anonKeyFindings.length).toBe(0);
      expect(stripeKeyFindings.length).toBe(0);

      // It SHOULD flag the live secret key NEXT_PUBLIC_SOME_SECRET
      const secretFindings = findings.filter((f) =>
        f.message.includes("NEXT_PUBLIC_SOME_SECRET"),
      );
      expect(secretFindings.length).toBeGreaterThan(0);
    });
  });

  describe("Inline Allow Comments", () => {
    it("should skip findings if bilt:allow or gitleaks:allow is present on the same line", () => {
      const liveKey = "sk_live_" + "4eC39HqLyjWDarjtT1zdp7dc";
      const content = `
        const key1 = "${liveKey}"; // bilt:allow
        const key2 = "${liveKey}"; // gitleaks:allow

        const key3 = "${liveKey}";
      `;

      const findings = scanFileForSecrets(
        content,
        "index.js",
        SECRET_RULES,
        DEFAULT_CONFIG.entropyThreshold,
      );

      // Should only find the third one because the first two are allowed
      expect(findings.length).toBe(1);
    });
  });

  describe("Snapshot Path Windows Backslash Fix", () => {
    it("should use forward slashes for snapshot manifest file paths on all platforms", async () => {
      const tmpDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "bilt-snapshot-slash-test-"),
      );
      try {
        const subDir = path.join(tmpDir, "subdir");
        await fs.mkdir(subDir, { recursive: true });
        const filePath = path.join(subDir, "test.txt");
        await fs.writeFile(filePath, "hello", "utf-8");

        const snapshot = await createSnapshot(
          [filePath],
          "test path formatting",
          tmpDir,
        );

        expect(snapshot.files.length).toBe(1);
        const fileEntry = snapshot.files[0]!;
        // Path should use forward slash (e.g. 'subdir/test.txt') even on Windows
        expect(fileEntry.path).toBe("subdir/test.txt");
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
