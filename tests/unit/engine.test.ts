import { describe, it, expect } from "vitest";
import {
  EngineRegistry,
  defaultEngineRegistry,
} from "../../src/core/engine/index.js";
import type { Engine, EngineContext } from "../../src/core/engine/types.js";
import { DEFAULT_CONFIG } from "../../src/config/config.js";

describe("Engine Contract & Registry", () => {
  it("should have all real default engines registered", () => {
    const engines = defaultEngineRegistry.list();
    const ids = engines.map((e) => e.id);

    expect(ids).toContain("secrets");
    expect(ids).toContain("security-rules");
    expect(ids).toContain("api-scan");
    expect(ids).toContain("env-gitignore");
    expect(engines.length).toBe(4);
  });

  it("should allow registering and looking up custom engines", () => {
    const registry = new EngineRegistry();
    const customEngine: Engine = {
      id: "custom-test",
      version: "0.1.0",
      description: "Test engine",
      analyze: async () => [],
    };

    registry.register(customEngine);
    expect(registry.get("custom-test")).toBe(customEngine);
  });

  it("should execute engines via runAll without crashing", async () => {
    const registry = new EngineRegistry();
    const mockContext: EngineContext = {
      rootDir: process.cwd(),
      config: DEFAULT_CONFIG,
      files: [{ path: "test.ts", content: "const x = 1;" }],
    };

    const findings = await registry.runAll(mockContext, ["security-rules"]);
    expect(Array.isArray(findings)).toBe(true);
  });
});
