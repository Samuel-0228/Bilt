import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { executeInit } from "../../src/commands/init.js";
import { createLeakyFixtureProject } from "../fixtures/helper.js";

describe("Init Integration Tests", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-init-integration-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should initialize a project, update gitignore, generate env.example, and build snapshot", async () => {
    await createLeakyFixtureProject(tmpDir);

    // Run init command
    await executeInit(tmpDir);

    // 1. Verify .gitignore was created and updated
    const gitignoreExists = await fs
      .stat(path.join(tmpDir, ".gitignore"))
      .then(() => true)
      .catch(() => false);
    expect(gitignoreExists).toBe(true);
    const gitignoreContent = await fs.readFile(
      path.join(tmpDir, ".gitignore"),
      "utf-8",
    );
    expect(gitignoreContent).toContain(".env");
    expect(gitignoreContent).toContain(".bilt/");

    // 2. Verify .env.example was generated
    const exampleExists = await fs
      .stat(path.join(tmpDir, ".env.example"))
      .then(() => true)
      .catch(() => false);
    expect(exampleExists).toBe(true);

    // 3. Verify snapshot was created
    const biltDirExists = await fs
      .stat(path.join(tmpDir, ".bilt"))
      .then(() => true)
      .catch(() => false);
    expect(biltDirExists).toBe(true);
    const manifests = await fs.readdir(path.join(tmpDir, ".bilt/snapshots"));
    expect(manifests.length).toBeGreaterThan(0);
  });
});
