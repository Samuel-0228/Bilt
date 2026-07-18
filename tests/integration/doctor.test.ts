import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { executeDoctor } from "../../src/commands/doctor.js";
import { createLeakyFixtureProject } from "../fixtures/helper.js";

describe("Doctor Integration Tests", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "bilt-doctor-integration-"),
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should run doctor and print detailed report card", async () => {
    await createLeakyFixtureProject(tmpDir);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await executeDoctor(tmpDir, {});

    expect(logSpy).toHaveBeenCalled();
    const calls = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(calls).toContain("BILT DOCTOR");
    expect(calls).toContain("Secret Detection");
    expect(calls).toContain("Category Breakdown");

    logSpy.mockRestore();
  });

  it("should run doctor with --card and generate a PNG card", async () => {
    await createLeakyFixtureProject(tmpDir);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await executeDoctor(tmpDir, { card: true });

    expect(logSpy).toHaveBeenCalled();
    const calls = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(calls).toContain("Generated card:");
    expect(calls).toContain("Score:");
    expect(calls).toContain("scanned with bilt");

    const cardPath = path.join(tmpDir, "bilt-health-card.png");
    const exists = await fs.stat(cardPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    logSpy.mockRestore();
  });
});
