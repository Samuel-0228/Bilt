import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import {
  parseChangedLinesFromDiff,
  isFindingIntroducedByChange,
  type GitDiffScope,
} from "../../src/core/scoping/git-scope.js";
import {
  createBaseline,
  loadBaseline,
  isFingerprintInBaseline,
} from "../../src/core/scoping/baseline.js";

describe("Scoping & Diff Analysis", () => {
  it("should parse changed lines and new files from unified diff text", () => {
    const sampleDiff = `diff --git a/src/app.ts b/src/app.ts
index 1234567..89abcdef 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -10,3 +10,4 @@
  existing line 1
  existing line 2
+ added line 12
+ added line 13
@@ -50,2 +52,3 @@
  foo
+ added line 53
diff --git a/src/new-file.ts b/src/new-file.ts
new file mode 100644
--- /dev/null
+++ b/src/new-file.ts
@@ -0,0 +1,5 @@
+new line 1
`;

    const { fileChangedLines, newFiles } =
      parseChangedLinesFromDiff(sampleDiff);

    expect(newFiles.has("src/new-file.ts")).toBe(true);
    expect(fileChangedLines.has("src/app.ts")).toBe(true);

    const appLines = fileChangedLines.get("src/app.ts")!;
    expect(appLines.has(10)).toBe(true);
    expect(appLines.has(11)).toBe(true);
    expect(appLines.has(12)).toBe(true);
    expect(appLines.has(13)).toBe(true);
    expect(appLines.has(52)).toBe(true);
    expect(appLines.has(53)).toBe(true);
    expect(appLines.has(100)).toBe(false);
  });

  it("should accurately determine if a finding was introduced by changes", () => {
    const scope: GitDiffScope = {
      changedFiles: new Set(["src/service.ts", "src/created.ts"]),
      changedLines: new Map([
        ["src/service.ts", new Set([25, 26, 27])],
        ["src/created.ts", new Set([1, 2, 3])],
      ]),
      newFiles: new Set(["src/created.ts"]),
    };

    // Finding on an edited line
    expect(isFindingIntroducedByChange("src/service.ts", 26, scope)).toBe(true);

    // Finding on an unedited line in an edited file
    expect(isFindingIntroducedByChange("src/service.ts", 10, scope)).toBe(
      false,
    );

    // Finding in an untouched file
    expect(isFindingIntroducedByChange("src/other.ts", 5, scope)).toBe(false);

    // Finding in a brand new file
    expect(isFindingIntroducedByChange("src/created.ts", 99, scope)).toBe(true);
  });
});

describe("Baseline Management", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-baseline-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("should create and load a baseline file containing unique fingerprints", async () => {
    const fingerprints = ["fp-alpha", "fp-beta", "fp-alpha", "fp-gamma"];
    const baselineFile = await createBaseline(tempDir, fingerprints);

    expect(baselineFile).toContain("baseline.json");

    const loaded = await loadBaseline(tempDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.size).toBe(3); // Deduplicated
    expect(loaded!.has("fp-alpha")).toBe(true);
    expect(loaded!.has("fp-beta")).toBe(true);
    expect(loaded!.has("fp-gamma")).toBe(true);
    expect(loaded!.has("fp-delta")).toBe(false);

    expect(isFingerprintInBaseline("fp-alpha", loaded)).toBe(true);
    expect(isFingerprintInBaseline("fp-unknown", loaded)).toBe(false);
  });
});
