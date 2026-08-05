import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkAndRunFirstTimeOnboarding } from "../../src/core/onboarding/first-run.js";
import { isFirstRun, markFirstRunCompleted, setAIConfig } from "../../src/core/ai/config.js";

describe("First-Run Developer Onboarding", () => {
  beforeEach(() => {
    setAIConfig({ firstRunCompleted: false });
  });

  afterEach(() => {
    markFirstRunCompleted();
  });

  it("should bypass interactive onboarding when bypassInteractive is true", async () => {
    expect(isFirstRun()).toBe(true);

    const ran = await checkAndRunFirstTimeOnboarding({ bypassInteractive: true });
    expect(ran).toBe(false);
    expect(isFirstRun()).toBe(false);
  });

  it("should bypass interactive onboarding in plain or json mode", async () => {
    setAIConfig({ firstRunCompleted: false });
    const ranPlain = await checkAndRunFirstTimeOnboarding({ plain: true });
    expect(ranPlain).toBe(false);
    expect(isFirstRun()).toBe(false);
  });
});
