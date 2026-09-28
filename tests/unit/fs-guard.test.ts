import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  validateProjectDirectory,
  isPathContained,
  isSymlinkEscaping,
} from "../../src/core/safety/fs-guard.js";

describe("Filesystem Guard & Security Controls", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-fs-guard-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should validate an existing directory successfully", async () => {
    const validated = await validateProjectDirectory(tmpDir);
    expect(validated).toBe(path.resolve(tmpDir));
  });

  it("should reject a non-existent directory with a clear error", async () => {
    const nonExistent = path.join(tmpDir, "does-not-exist");
    await expect(validateProjectDirectory(nonExistent)).rejects.toThrow(
      /Directory not found/i,
    );
  });

  it("should reject a regular file when a directory is expected", async () => {
    const filePath = path.join(tmpDir, "file.txt");
    await fs.writeFile(filePath, "sample content", "utf-8");

    await expect(validateProjectDirectory(filePath)).rejects.toThrow(
      /Target path is not a directory/i,
    );
  });

  it("should correctly detect whether paths remain contained within rootDir", () => {
    expect(isPathContained("sub/dir/file.txt", tmpDir)).toBe(true);
    expect(isPathContained("./file.txt", tmpDir)).toBe(true);
    expect(isPathContained("../outside.txt", tmpDir)).toBe(false);
    expect(isPathContained("../../etc/passwd", tmpDir)).toBe(false);
    expect(isPathContained(tmpDir, tmpDir)).toBe(true);
  });

  it("should detect symlink escapes pointing outside rootDir", async () => {
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-outside-"));
    const outsideFile = path.join(outsideDir, "secret.txt");
    await fs.writeFile(outsideFile, "confidential", "utf-8");

    const insideLink = path.join(tmpDir, "symlink-outside");
    try {
      await fs.symlink(outsideFile, insideLink);
      const isEscaping = await isSymlinkEscaping(insideLink, tmpDir);
      expect(isEscaping).toBe(true);
    } finally {
      await fs.rm(outsideDir, { recursive: true, force: true });
    }
  });

  it("should permit safe internal symlinks contained within rootDir", async () => {
    const insideFile = path.join(tmpDir, "local-target.txt");
    await fs.writeFile(insideFile, "safe", "utf-8");

    const insideLink = path.join(tmpDir, "local-symlink");
    await fs.symlink(insideFile, insideLink);

    const isEscaping = await isSymlinkEscaping(insideLink, tmpDir);
    expect(isEscaping).toBe(false);
  });
});
