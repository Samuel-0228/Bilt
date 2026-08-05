import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { executeAIStatus, executeAIRemove, executeAITest } from "../../src/commands/ai.js";
import { executeAsk } from "../../src/commands/ask.js";
import { setAIConfig } from "../../src/core/ai/config.js";
import { saveApiKey, deleteApiKey } from "../../src/core/ai/storage.js";

describe("AI Commands Integration", () => {
  beforeEach(async () => {
    await deleteApiKey("openai");
    setAIConfig({ activeProvider: undefined });
  });

  afterEach(async () => {
    await deleteApiKey("openai");
    setAIConfig({ activeProvider: undefined });
  });

  it("should handle status gracefully when no provider is configured", async () => {
    await expect(executeAIStatus()).resolves.not.toThrow();
  });

  it("should handle ask command when no provider is configured", async () => {
    await expect(executeAsk("How do I fix issues?")).resolves.not.toThrow();
  });

  it("should support status, test, and remove workflows", async () => {
    await saveApiKey("openai", "sk-proj-test1234567890abcdefa91f");
    setAIConfig({ activeProvider: "openai" });

    await expect(executeAIStatus()).resolves.not.toThrow();
    await expect(executeAIRemove()).resolves.not.toThrow();
  });
});
