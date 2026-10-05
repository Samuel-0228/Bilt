// ─── Agent Session Identity ───────────────────────────────────────────────────
// Manages agent session identity across multiple CLI runs in the same workspace.
// Stored under `.bilt/state/session.json`.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export type SessionStatus = "active" | "passed" | "failed" | "escalated";

export interface AgentSession {
  id: string;
  startedAt: string;
  projectRoot: string;
  agent?: string;
  iteration: number;
  previousFingerprints: string[];
  status: SessionStatus;
  lastUpdated: string;
}

export function getSessionStatePath(rootDir: string): string {
  return path.join(rootDir, ".bilt", "state", "session.json");
}

/**
 * Get or initialize an active agent session for the project root.
 * Respects `BILT_SESSION_ID` environment variable if set.
 */
export async function getOrStartSession(
  rootDir: string,
  agentName?: string,
): Promise<AgentSession> {
  const absoluteRoot = path.resolve(rootDir);
  const sessionPath = getSessionStatePath(absoluteRoot);

  const envSessionId = process.env.BILT_SESSION_ID;

  try {
    const raw = await fs.readFile(sessionPath, "utf-8");
    const session = JSON.parse(raw) as AgentSession;

    // If environment specifies session ID and it matches or if current session is active, reuse
    if (!envSessionId || session.id === envSessionId) {
      if (session.status === "active") {
        return session;
      }
    }
  } catch {
    // Session file missing or invalid
  }

  // Create new session
  const newSession: AgentSession = {
    id: envSessionId || crypto.randomBytes(8).toString("hex"),
    startedAt: new Date().toISOString(),
    projectRoot: absoluteRoot,
    agent: agentName || process.env.BILT_AGENT_NAME || "ai-agent",
    iteration: 0,
    previousFingerprints: [],
    status: "active",
    lastUpdated: new Date().toISOString(),
  };

  await saveSession(absoluteRoot, newSession);
  return newSession;
}

/**
 * Save current agent session.
 */
export async function saveSession(
  rootDir: string,
  session: AgentSession,
): Promise<void> {
  const stateDir = path.join(rootDir, ".bilt", "state");
  await fs.mkdir(stateDir, { recursive: true });

  const payload: AgentSession = {
    ...session,
    lastUpdated: new Date().toISOString(),
  };

  await fs.writeFile(getSessionStatePath(rootDir), JSON.stringify(payload, null, 2), "utf-8");
}

/**
 * Update agent session iteration with latest fingerprints and status.
 */
export async function updateSessionState(
  rootDir: string,
  fingerprints: string[],
  status: SessionStatus = "active",
): Promise<AgentSession> {
  const session = await getOrStartSession(rootDir);
  session.iteration += 1;
  session.previousFingerprints = fingerprints;
  session.status = status;
  await saveSession(rootDir, session);
  return session;
}
