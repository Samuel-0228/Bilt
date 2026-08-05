import { describe, it, expect } from "vitest";
import { isReasoningModel, getDefaultModel, getRecommendedModels } from "../../src/core/ai/models.js";
import { getActiveModel, setActiveModel } from "../../src/core/ai/config.js";

describe("Multi-Model Registry & Safe Resolution", () => {
  it("should identify reasoning models correctly", () => {
    expect(isReasoningModel("o1-mini")).toBe(true);
    expect(isReasoningModel("o3-mini")).toBe(true);
    expect(isReasoningModel("gpt-4o-mini")).toBe(false);
    expect(isReasoningModel("claude-3-5-sonnet")).toBe(false);
  });

  it("should return recommended models list for all providers", () => {
    const openaiModels = getRecommendedModels("openai");
    expect(openaiModels.length).toBeGreaterThan(0);
    expect(openaiModels.some((m) => m.id === "gpt-4o-mini")).toBe(true);

    const anthropicModels = getRecommendedModels("anthropic");
    expect(anthropicModels.some((m) => m.id === "claude-3-5-sonnet-20241022")).toBe(true);
  });

  it("should persist custom model choices in global config", () => {
    setActiveModel("openai", "gpt-4o");
    expect(getActiveModel("openai")).toBe("gpt-4o");

    // Reset to default
    setActiveModel("openai", "gpt-4o-mini");
    expect(getActiveModel("openai")).toBe("gpt-4o-mini");
  });
});
