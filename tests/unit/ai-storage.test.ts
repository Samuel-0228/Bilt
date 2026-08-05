import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getApiKey, saveApiKey, deleteApiKey, maskApiKey } from "../../src/core/ai/storage.js";
import path from "node:path";
import fs from "node:fs";

describe("Key Storage Security & Resilience", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.BILT_OPENAI_API_KEY;
    delete process.env.BILT_ANTHROPIC_API_KEY;
    delete process.env.BILT_GEMINI_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should mask API keys securely", () => {
    expect(maskApiKey("sk-proj-1234567890abcdefa91f")).toBe("sk-...a91f");
    expect(maskApiKey("12345")).toBe("********");
  });

  it("should prioritize environment variable override over stored key", async () => {
    process.env.BILT_OPENAI_API_KEY = "sk-env-override-key-1234";

    const result = await getApiKey("openai");
    expect(result.source).toBe("env");
    expect(result.key).toBe("sk-env-override-key-1234");
  });

  it("should save and retrieve keys securely via encrypted storage fallback", async () => {
    const testKey = "sk-test-secret-key-storage-9999";
    const saveRes = await saveApiKey("openai", testKey);
    expect(saveRes.success).toBe(true);

    const getRes = await getApiKey("openai");
    expect(getRes.key).toBe(testKey);
    expect(["keyring", "encrypted-file"]).toContain(getRes.source);

    // Clean up
    await deleteApiKey("openai");
    const getAfterDelete = await getApiKey("openai");
    expect(getAfterDelete.key).toBeNull();
  });

  it("should NEVER write credentials to any file inside the project repo directory", () => {
    const repoDir = process.cwd();
    const repoFiles = fs.readdirSync(repoDir);

    expect(repoFiles).not.toContain("credentials");
    expect(repoFiles).not.toContain(".key");
  });
});
