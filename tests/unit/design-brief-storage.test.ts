import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { readDesignBrief, writeDesignBrief, clearDesignBrief } from "../../src/core/design/brief/storage.js";

describe("Design Brief Storage", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-brief-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns null if brief does not exist", async () => {
    const brief = await readDesignBrief(tmpDir);
    expect(brief).toBeNull();
  });

  it("writes and reads a brief successfully", async () => {
    const brief = {
      schemaVersion: "1" as const,
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z",
      purpose: { value: "test", source: "developer" as const },
      audience: { value: null, source: "not-provided" as const },
      visualDirection: { value: null, source: "creative-freedom" as const },
      brandColors: { value: ["#ff0000"], source: "developer" as const, type: "requirement" as const },
      desiredFeeling: { value: null, source: "not-provided" as const },
      creativeFreedom: "guided" as const,
    };

    await writeDesignBrief(tmpDir, brief);
    const read = await readDesignBrief(tmpDir);
    
    expect(read).toEqual(brief);
  });

  it("clears brief correctly", async () => {
    const brief = {
      schemaVersion: "1" as const,
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z",
      purpose: { value: "test", source: "developer" as const },
      audience: { value: null, source: "not-provided" as const },
      visualDirection: { value: null, source: "creative-freedom" as const },
      brandColors: { value: ["#ff0000"], source: "developer" as const, type: "requirement" as const },
      desiredFeeling: { value: null, source: "not-provided" as const },
      creativeFreedom: "guided" as const,
    };
    await writeDesignBrief(tmpDir, brief);
    await clearDesignBrief(tmpDir);
    
    const read = await readDesignBrief(tmpDir);
    expect(read).toBeNull();
  });

  it("returns null on invalid JSON", async () => {
    const biltDir = path.join(tmpDir, ".bilt");
    await fs.mkdir(biltDir);
    await fs.writeFile(path.join(biltDir, "design-brief.json"), "{ invalid json ");

    const read = await readDesignBrief(tmpDir);
    expect(read).toBeNull();
  });
});
