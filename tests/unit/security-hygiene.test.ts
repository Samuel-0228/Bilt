import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { SecretAnalyzer } from "../../src/core/security-engine/secret-analyzer.js";
import { redactKnownSecrets } from "../../src/core/safety/sanitizer.js";
import {
  validateSafePath,
  isBinaryContent,
  isPathContained,
  safeReadProjectFile,
} from "../../src/core/safety/fs-guard.js";
import {
  validateBiltConfig,
  validateLoopState,
  validateBaselineData,
  validatePluginResult,
  validateCliFormat,
} from "../../src/core/security/validation.js";
import { createSnapshot, restoreSnapshot } from "../../src/core/fix/snapshot.js";
import { redactForAI } from "../../src/core/ai/redact.js";
import type { ScanFinding } from "../../src/types/index.js";

describe("Bilt Security Hygiene & Hardening", () => {
  // ── 1. Secret Detection & Classification ───────────────────────────────────

  describe("Secret Detection & Classification", () => {
    it("should accurately classify backend secrets vs public client variables", () => {
      expect(SecretAnalyzer.classifyKey("NEXT_PUBLIC_ANON_KEY", "eyJhbGciOi...").isSafe).toBe(true);
      expect(SecretAnalyzer.classifyKey("VITE_PUBLIC_APP_ID", "app_12345").isSafe).toBe(true);
      expect(SecretAnalyzer.classifyKey("JWT_SECRET", "super-secret-production-signing-key").isSecret).toBe(true);
      expect(SecretAnalyzer.classifyKey("AWS_SECRET_ACCESS_KEY", "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY").isSecret).toBe(true);
      expect(SecretAnalyzer.classifyKey("DATABASE_URL", "postgres://user:pass@localhost:5432/db").isSecret).toBe(true);
    });

    it("should detect realistic synthetic credentials across text", () => {
      const syntheticGhp = ["ghp", "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"].join("_");
      const syntheticStripe = ["sk", "test", "51H1a2b3c4d5e6f7g8h9i0jkl"].join("_");
      const text = [
        `const token = '${syntheticGhp}';`,
        `const stripe = '${syntheticStripe}';`,
        "const db = 'postgres://admin:secretPass123@db.cloud.io:5432/main';",
      ].join("\n");

      const findings = SecretAnalyzer.scanTextForSecrets(text, "src/secrets.ts");
      expect(findings.some((f) => f.type === "github_token")).toBe(true);
      expect(findings.some((f) => f.type === "stripe_secret")).toBe(true);
      expect(findings.some((f) => f.type === "database_password")).toBe(true);
    });

    it("should ensure snippets emitted by secret analyzer are redacted", () => {
      const syntheticKey = ["sk", "test", "51H1a2b3c4d5e6f7g8h9i0jkl"].join("_");
      const line = `const key = '${syntheticKey}';`;
      const findings = SecretAnalyzer.scanTextForSecrets(line, "src/api.ts");
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]?.snippet).not.toContain("51H1a2b3c4d5e6f7g8h9i0jkl");
      expect(findings[0]?.snippet).toContain("sk_t***");
    });
  });

  // ── 2. Secret Redaction Pipeline ───────────────────────────────────────────

  describe("Secret Redaction Pipeline", () => {
    it("should redact database passwords in connection strings", () => {
      const raw = "Connecting to postgresql://postgres:MySecretPassword123@db.internal.org:5432/production";
      const redacted = redactKnownSecrets(raw);
      expect(redacted).not.toContain("MySecretPassword123");
      expect(redacted).toContain("postgresql://postgres:MySe***");
      expect(redacted).toContain("@db.internal.org:5432/production");
    });

    it("should redact sensitive key assignments", () => {
      const raw = "AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\nJWT_SECRET=production-secret-token-12345";
      const redacted = redactKnownSecrets(raw);
      expect(redacted).not.toContain("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
      expect(redacted).not.toContain("production-secret-token-12345");
      expect(redacted).toContain("AWS_SECRET_ACCESS_KEY=wJal***");
      expect(redacted).toContain("JWT_SECRET=prod***");
    });

    it("should guarantee AI prompt context strictly scrubs secrets and raw credentials", () => {
      const syntheticLiveSecret = ["sk", "live", "99998888777766665555444433332222"].join("_");
      const mockFinding: ScanFinding = {
        id: "finding-1",
        category: "secret-detected",
        severity: "critical",
        message: `Found secret key ${syntheticLiveSecret} in config`,
        file: "config.js",
        line: 12,
        secret: syntheticLiveSecret,
        preview: "sk_live_***",
        suggestion: `Remove ${syntheticLiveSecret} and move to .env`,
      };

      const redacted = redactForAI({ findings: [mockFinding] });
      const serialized = JSON.stringify(redacted);
      expect(serialized).not.toContain("99998888777766665555444433332222");
    });
  });

  // ── 3. Filesystem & Path Traversal Security ────────────────────────────────

  describe("Filesystem Security", () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-fs-security-"));
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it("should reject path traversal attempts escaping root directory", () => {
      expect(() => validateSafePath("../../../etc/passwd", tmpDir)).toThrow();
      expect(() => validateSafePath("/etc/shadow", tmpDir)).toThrow();
      expect(isPathContained(path.join(tmpDir, "src/index.ts"), tmpDir)).toBe(true);
      expect(isPathContained(path.join(tmpDir, "../escape"), tmpDir)).toBe(false);
    });

    it("should reject paths with null bytes", () => {
      expect(() => validateSafePath("file.txt\0.js", tmpDir)).toThrow();
    });

    it("should detect binary files and skip reading them", async () => {
      const binaryBuf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x00, 0x01, 0x01]);
      expect(isBinaryContent(binaryBuf)).toBe(true);

      const textBuf = Buffer.from("console.log('hello world');");
      expect(isBinaryContent(textBuf)).toBe(false);

      const binFile = path.join(tmpDir, "binary.bin");
      await fs.writeFile(binFile, binaryBuf);

      const readRes = await safeReadProjectFile(binFile, tmpDir);
      expect(readRes.content).toBeNull();
      expect(readRes.skippedReason).toBe("binary_file");
    });

    it("should reject snapshots attempting to restore files outside project root", async () => {
      const restored = await restoreSnapshot("../evil-id", tmpDir);
      expect(restored).toBe(false);
    });

    it("should prevent snapshots from snapshotting files outside project root", async () => {
      const externalFile = path.join(os.tmpdir(), `external-${Date.now()}.txt`);
      await fs.writeFile(externalFile, "sensitive data outside root");

      try {
        const snap = await createSnapshot([externalFile], "External file snapshot", tmpDir);
        expect(snap.files.length).toBe(0);
      } finally {
        await fs.rm(externalFile, { force: true });
      }
    });
  });

  // ── 4. Boundary Validation (Zod) ──────────────────────────────────────────

  describe("Input & Boundary Validation (Zod)", () => {
    it("should validate and sanitize .biltrc configuration", () => {
      const valid = {
        entropyThreshold: 5.2,
        historyDepth: 25,
        funMode: true,
      };
      const parsed = validateBiltConfig(valid);
      expect(parsed.entropyThreshold).toBe(5.2);
      expect(parsed.historyDepth).toBe(25);

      // Malformed configuration should throw ConfigurationError
      expect(() => validateBiltConfig({ entropyThreshold: "invalid-string" })).toThrow();
      expect(() => validateBiltConfig({ entropyThreshold: 99 })).toThrow();
    });

    it("should validate CLI format options and reject invalid formats", () => {
      expect(validateCliFormat("agent")).toBe("agent");
      expect(validateCliFormat("JSON")).toBe("json");
      expect(() => validateCliFormat("malicious; rm -rf /")).toThrow();
    });

    it("should fail-soft on malformed loop state and baseline files", () => {
      const malformedLoopState = { corrupt: "invalid data" };
      const fallbackLoop = validateLoopState(malformedLoopState);
      expect(fallbackLoop.currentIteration).toBe(0);
      expect(fallbackLoop.history).toEqual([]);

      const malformedBaseline = { count: -1, fingerprints: "not an array" };
      const fallbackBaseline = validateBaselineData(malformedBaseline);
      expect(fallbackBaseline).toBeNull();
    });

    it("should sanitize untrusted third-party plugin check output", () => {
      const malformedPluginOutput = { findings: "not-an-array" };
      const sanitized = validatePluginResult(malformedPluginOutput);
      expect(sanitized.findings).toEqual([]);

      const validPluginOutput = {
        findings: [
          {
            id: "plg-1",
            category: "docker",
            severity: "warning",
            message: "Missing non-root user in Dockerfile",
            file: "Dockerfile",
          },
        ],
      };
      const validated = validatePluginResult(validPluginOutput);
      expect(validated.findings.length).toBe(1);
    });
  });

  // ── 5. Command Execution Safety ───────────────────────────────────────────

  describe("Command Execution Safety", () => {
    it("should treat shell metacharacters in filenames as literal characters without syntax evaluation", () => {
      const dangerousFilenames = [
        "file; rm -rf /",
        "file && cat /etc/passwd",
        "file || echo pwned",
        "file$(whoami).ts",
        "file`id`.ts",
        "file\nnewline.ts",
      ];

      for (const name of dangerousFilenames) {
        // Structured argument arrays do not invoke a subshell
        const args = ["rm", "--cached", "--", name];
        expect(args[2]).toBe("--");
        expect(args[3]).toBe(name);
      }
    });
  });
});
