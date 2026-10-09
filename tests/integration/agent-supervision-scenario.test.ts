// ─── Agent Engineering Supervision Scenario Integration Test ─────────────────
// Verifies the end-to-end product scenario:
// 1. Developer asks agent to add authentication.
// 2. Agent implements authentication (with insecure session, missing authz, etc.).
// 3. Bilt check --format agent returns structured machine-readable instructions.
// 4. Agent fixes issues.
// 5. Bilt verifies changes and records resolution in session.
// 6. Agent introduces a regression.
// 7. Bilt detects regression and commands agent to fix it.
// 8. Agent repeatedly fails to make progress.
// 9. Bilt returns status: "escalate", allowedToContinue: false, exit code 4.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { executeCheck } from "../../src/commands/check.js";
import { readLoopState } from "../../src/core/loop/state.js";
import { getOrStartSession } from "../../src/core/agent/session.js";

describe("Agent Supervision Workflow Scenario", () => {
  let tmpDir: string;
  let originalEnvSession: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bilt-agent-scenario-"));
    originalEnvSession = process.env.BILT_SESSION_ID;
    delete process.env.BILT_SESSION_ID;

    // Create a base project
    await fs.writeFile(
      path.join(tmpDir, "package.json"),
      JSON.stringify({
        name: "test-auth-app",
        version: "1.0.0",
        dependencies: {
          express: "^4.18.2",
          jsonwebtoken: "^9.0.0",
        },
      }),
    );
  });

  afterEach(async () => {
    if (originalEnvSession) {
      process.env.BILT_SESSION_ID = originalEnvSession;
    } else {
      delete process.env.BILT_SESSION_ID;
    }
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("governs agent loop through implementation, fixes, regressions, and escalation", async () => {
    // ── STEP 1 & 2: Agent implements initial authentication ──────────────────────
    // Introduces JWT decode without verify, insecure cookie, and missing validation
    await fs.writeFile(
      path.join(tmpDir, "auth.ts"),
      `
import express from 'express';
const app = express();

app.post('/api/login', (req, res) => {
  // Insecure cookie handling (missing httpOnly, secure)
  res.cookie('token', 'xyz123', { maxAge: 900000 });
  res.json({ success: true });
});

app.get('/api/profile', (req, res) => {
  const token = req.headers.authorization;
  // Insecure jwt.decode without verify
  const user = jwt.decode(token);
  res.json({ user });
});
      `.trim(),
    );

    // Capture console.log outputs
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => {
      logs.push(args.join(" "));
    };

    try {
      // ── STEP 3: Bilt checks implementation ─────────────────────────────────────
      const exitCode1 = await executeCheck(tmpDir, { format: "agent" });
      expect(exitCode1).toBe(1); // Fails due to critical security issues

      const response1 = JSON.parse(logs[logs.length - 1]!);
      expect(response1.status).toBe("fail");
      expect(response1.allowedToContinue).toBe(false); // Agent NOT allowed to continue
      expect(response1.summary.blocking).toBeGreaterThan(0);
      expect(response1.nextAction.type).toBe("fix");
      expect(response1.nextAction.findingIds.length).toBeGreaterThan(0);

      // Verify findings have structured remediation contracts
      const jwtFinding = response1.findings.find((f: any) => f.ruleId === "CHECK-AUTH-001");
      expect(jwtFinding).toBeDefined();
      expect(jwtFinding.objective).toBeDefined();
      expect(jwtFinding.allowedChanges).toBeDefined();
      expect(jwtFinding.forbiddenChanges).toBeDefined();
      expect(jwtFinding.verification).toBeDefined();

      // Session tracking iteration 1
      expect(response1.session.iteration).toBe(1);
      expect(response1.session.status).toBe("failed");

      // ── STEP 4 & 5: Agent fixes the issues ─────────────────────────────────────
      // Replaces jwt.decode with jwt.verify and fixes cookie options
      await fs.writeFile(
        path.join(tmpDir, "auth.ts"),
        `
import express from 'express';
const app = express();

app.post('/api/login', (req, res) => {
  res.cookie('token', 'xyz123', { httpOnly: true, secure: true, sameSite: 'strict' });
  res.json({ success: true });
});

app.get('/api/profile', (req, res) => {
  const token = req.headers.authorization;
  const user = jwt.verify(token, process.env.JWT_SECRET || 'secret');
  res.json({ user });
});
        `.trim(),
      );

      logs.length = 0;
      const exitCode2 = await executeCheck(tmpDir, { format: "agent" });
      const response2 = JSON.parse(logs[logs.length - 1]!);

      // Bilt verifies the changes
      expect(response2.session.iteration).toBe(2);
      expect(response2.session.resolvedFindings.length).toBeGreaterThan(0);
      expect(response2.session.regressions).toHaveLength(0);

      // ── STEP 6 & 7: Agent introduces a regression ──────────────────────────────
      // Reverts jwt.verify back to jwt.decode (or reintroduces insecure cookies)
      await fs.writeFile(
        path.join(tmpDir, "auth.ts"),
        `
import express from 'express';
const app = express();

app.post('/api/login', (req, res) => {
  res.cookie('token', 'xyz123', { httpOnly: true, secure: true, sameSite: 'strict' });
  res.json({ success: true });
});

app.get('/api/profile', (req, res) => {
  const token = req.headers.authorization;
  // REGRESSION: Re-introduced jwt.decode without verify
  const user = jwt.decode(token);
  res.json({ user });
});
        `.trim(),
      );

      logs.length = 0;
      const exitCode3 = await executeCheck(tmpDir, { format: "agent" });
      expect(exitCode3).toBe(1);

      const response3 = JSON.parse(logs[logs.length - 1]!);
      expect(response3.status).toBe("fail");
      expect(response3.allowedToContinue).toBe(false);

      // Bilt detects the regression!
      expect(response3.session.regressions.length).toBeGreaterThan(0);
      expect(response3.nextAction.instruction).toContain("REGRESSION DETECTED");

      // ── STEP 8 & 9: Agent repeatedly fails to make progress ─────────────────────
      // Agent runs 2 more times without fixing the issues (3 identical runs total)
      logs.length = 0;
      const exitCode4 = await executeCheck(tmpDir, { format: "agent", noProgressThreshold: 3 });
      expect(exitCode4).toBe(1);

      logs.length = 0;
      // 3rd consecutive run with identical findings triggers loop escalation!
      const exitCode5 = await executeCheck(tmpDir, { format: "agent", noProgressThreshold: 3 });
      expect(exitCode5).toBe(4); // Exit code 4 is ESCALATE

      const response5 = JSON.parse(logs[logs.length - 1]!);
      expect(response5.status).toBe("escalate");
      expect(response5.allowedToContinue).toBe(false);
      expect(response5.nextAction.type).toBe("escalate");
      expect(response5.escalation.reason).toBe("no-progress");
      expect(response5.nextAction.instruction).toContain("HALT automated retries");
    } finally {
      console.log = origLog;
    }
  });
});
