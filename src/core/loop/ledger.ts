// ─── Change Ledger & Regression Detection ──────────────────────────────────────
// Persists structured history of changes, fingerprint diffs, and regressions.
// Stored under `.bilt/history/`.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import path from "node:path";

export interface ChangeRecord {
  sessionId: string;
  iteration: number;
  timestamp: string;
  beforeFingerprints: string[];
  afterFingerprints: string[];
  changedFiles: string[];
  resolved: string[];
  introduced: string[];
  unchanged: string[];
  regressions: string[];
  state: "progress" | "no-progress" | "regressed";
}

export interface LedgerHistory {
  sessionId: string;
  records: ChangeRecord[];
  allHistoricalResolved: string[]; // Set of fingerprints that were resolved in past iterations
}

export function getLedgerDir(rootDir: string): string {
  return path.join(rootDir, ".bilt", "history");
}

export function getSessionLedgerPath(rootDir: string, sessionId: string): string {
  return path.join(getLedgerDir(rootDir), `session-${sessionId}.json`);
}

/**
 * Load change ledger for a session.
 */
export async function loadSessionLedger(
  rootDir: string,
  sessionId: string,
): Promise<LedgerHistory> {
  const filePath = getSessionLedgerPath(rootDir, sessionId);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as LedgerHistory;
  } catch {
    return {
      sessionId,
      records: [],
      allHistoricalResolved: [],
    };
  }
}

/**
 * Save change ledger for a session.
 */
export async function saveSessionLedger(
  rootDir: string,
  ledger: LedgerHistory,
): Promise<void> {
  const ledgerDir = getLedgerDir(rootDir);
  await fs.mkdir(ledgerDir, { recursive: true });
  const filePath = getSessionLedgerPath(rootDir, ledger.sessionId);
  await fs.writeFile(filePath, JSON.stringify(ledger, null, 2), "utf-8");
}

/**
 * Calculate change delta between before and after fingerprint sets,
 * detecting regressions (fingerprints that were previously resolved but re-appeared).
 */
export function computeChangeRecord(
  sessionId: string,
  iteration: number,
  beforeFingerprints: string[],
  afterFingerprints: string[],
  changedFiles: string[],
  historicalResolved: string[] = [],
): { record: ChangeRecord; newHistoricalResolved: string[] } {
  const beforeSet = new Set(beforeFingerprints);
  const afterSet = new Set(afterFingerprints);
  const historicalResolvedSet = new Set(historicalResolved);

  const resolved = beforeFingerprints.filter((fp) => !afterSet.has(fp));
  const introduced = afterFingerprints.filter((fp) => !beforeSet.has(fp));
  const unchanged = afterFingerprints.filter((fp) => beforeSet.has(fp));

  // Regressions: finding re-appeared after being resolved in a prior iteration
  const regressions = introduced.filter((fp) => historicalResolvedSet.has(fp));

  let state: "progress" | "no-progress" | "regressed" = "no-progress";
  if (regressions.length > 0) {
    state = "regressed";
  } else if (resolved.length > introduced.length) {
    state = "progress";
  } else if (introduced.length > resolved.length) {
    state = "regressed";
  }

  // Update set of all historical resolved fingerprints
  const updatedHistoricalSet = new Set(historicalResolved);
  for (const fp of resolved) {
    updatedHistoricalSet.add(fp);
  }

  const record: ChangeRecord = {
    sessionId,
    iteration,
    timestamp: new Date().toISOString(),
    beforeFingerprints,
    afterFingerprints,
    changedFiles,
    resolved,
    introduced,
    unchanged,
    regressions,
    state,
  };

  return {
    record,
    newHistoricalResolved: Array.from(updatedHistoricalSet),
  };
}

/**
 * Record a new change iteration into the session ledger.
 */
export async function recordChangeIteration(
  rootDir: string,
  sessionId: string,
  iteration: number,
  beforeFingerprints: string[],
  afterFingerprints: string[],
  changedFiles: string[],
): Promise<ChangeRecord> {
  const ledger = await loadSessionLedger(rootDir, sessionId);
  const { record, newHistoricalResolved } = computeChangeRecord(
    sessionId,
    iteration,
    beforeFingerprints,
    afterFingerprints,
    changedFiles,
    ledger.allHistoricalResolved,
  );

  ledger.records.push(record);
  ledger.allHistoricalResolved = newHistoricalResolved;

  await saveSessionLedger(rootDir, ledger);
  return record;
}
