// ─── Agent Supervision Layer Contract Tests ─────────────────────────────────
// Tests the full Bilt Agent Supervision architecture:
// 1. Unified ProjectModel Aggregator
// 2. Project Requirements Contract (.bilt/requirements.json)
// 3. Change Ledger & Regression Engine
// 4. Agent Session Identity (.bilt/state/session.json)
// 5. BiltSupervisor State Machine & bilt watch --format agent
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { buildProjectModel } from "../../src/core/model/project-model.js";
import {
  loadRequirementsContract,
  upsertRequirement,
  removeRequirement,
} from "../../src/core/contract/requirements.js";
import {
  recordChangeIteration,
  loadSessionLedger,
  computeChangeRecord,
} from "../../src/core/loop/ledger.js";
import {
  getOrStartSession,
  saveSession,
  updateSessionState,
} from "../../src/core/agent/session.js";
import { BiltSupervisor } from "../../src/core/watch/supervisor.js";

describe("Agent Supervision Layer", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-supervision-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // ── 1. Unified ProjectModel ──────────────────────────────────────────────────

  it("builds a unified ProjectModel across files, dependencies, routes, and requirements", async () => {
    await fs.writeFile(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { express: "^4.18.0" } }),
    );
    await fs.writeFile(
      path.join(tmpDir, "index.ts"),
      "import jwt from 'jsonwebtoken'; const app = express();",
    );

    const model = await buildProjectModel(tmpDir);

    expect(model.rootDir).toBe(path.resolve(tmpDir));
    expect(model.files.length).toBeGreaterThan(0);
    expect(model.dependencies.some((d) => d.name === "express")).toBe(true);
    expect(model.auth.detected).toBe(true);
  });

  // ── 2. Project Requirements Contract ─────────────────────────────────────────

  it("manages structured project requirements in .bilt/requirements.json", async () => {
    const emptyContract = await loadRequirementsContract(tmpDir);
    expect(emptyContract.requirements).toHaveLength(0);

    await upsertRequirement(tmpDir, {
      id: "REQ-AUTH-001",
      description: "Users must authenticate before accessing dashboard",
      type: "authentication",
      priority: "critical",
      source: "developer",
      targetFiles: ["src/auth.ts"],
    });

    const loaded = await loadRequirementsContract(tmpDir);
    expect(loaded.requirements).toHaveLength(1);
    expect(loaded.requirements[0]!.id).toBe("REQ-AUTH-001");
    expect(loaded.requirements[0]!.priority).toBe("critical");

    await removeRequirement(tmpDir, "REQ-AUTH-001");
    const afterRemove = await loadRequirementsContract(tmpDir);
    expect(afterRemove.requirements).toHaveLength(0);
  });

  // ── 3. Change Ledger & Regression Engine ─────────────────────────────────────

  it("tracks change history and flags regressions when resolved findings re-appear", () => {
    const historicalResolved = ["fp-auth-001"];

    // Scenario: Agent previously resolved fp-auth-001. Now introduces it back in afterFingerprints
    const { record } = computeChangeRecord(
      "session-123",
      2,
      ["fp-other"],
      ["fp-other", "fp-auth-001"],
      ["src/routes.ts"],
      historicalResolved,
    );

    expect(record.state).toBe("regressed");
    expect(record.regressions).toContain("fp-auth-001");
    expect(record.introduced).toContain("fp-auth-001");
  });

  it("persists change iterations in .bilt/history/", async () => {
    const rec1 = await recordChangeIteration(
      tmpDir,
      "sess-99",
      1,
      ["fp-1", "fp-2"],
      ["fp-1"], // 1 resolved
      ["src/app.ts"],
    );

    expect(rec1.resolved).toContain("fp-2");
    expect(rec1.state).toBe("progress");

    const ledger = await loadSessionLedger(tmpDir, "sess-99");
    expect(ledger.records).toHaveLength(1);
    expect(ledger.allHistoricalResolved).toContain("fp-2");
  });

  // ── 4. Agent Session Identity ────────────────────────────────────────────────

  it("tracks session identity and iteration state across runs", async () => {
    const session1 = await getOrStartSession(tmpDir, "test-agent");
    expect(session1.id).toBeDefined();
    expect(session1.status).toBe("active");

    const updated = await updateSessionState(tmpDir, ["fp-100"], "active");
    expect(updated.iteration).toBe(1);
    expect(updated.previousFingerprints).toContain("fp-100");

    const reloaded = await getOrStartSession(tmpDir);
    expect(reloaded.id).toBe(session1.id);
  });

  // ── 5. BiltSupervisor State Machine ───────────────────────────────────────────

  it("executes supervisor state machine transitions (OBSERVING -> PASS / FINDINGS)", async () => {
    const supervisor = new BiltSupervisor(tmpDir);
    const session = await supervisor.initialize();

    expect(session.id).toBeDefined();
    expect(supervisor.getState()).toBe("OBSERVING");

    // Clean dir should transition to PASS
    const payload = await supervisor.handleFileChanges([]);
    expect(payload.supervisorState).toBe("PASS");
    expect(payload.response.status).toBe("pass");
    expect(payload.response.nextAction.type).toBe("stop");
  });

  it("detects findings and state changes on file edits", async () => {
    const supervisor = new BiltSupervisor(tmpDir);
    await supervisor.initialize();

    // Create file with hardcoded secret
    await fs.writeFile(
      path.join(tmpDir, "server.ts"),
      "const stripe_key = 'sk_test_51MzXYZ1234567890abcdef';",
    );

    const payload = await supervisor.handleFileChanges(["server.ts"]);
    expect(payload.response.status).toBe("fail");
    expect(payload.response.nextAction.type).toBe("fix");
    expect(payload.response.summary.total).toBeGreaterThan(0);
  });
});
