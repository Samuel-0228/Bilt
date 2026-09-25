// ─── Risk Acceptance Mechanism (Section 8B) ──────────────────────────────────
// Distinct from suppression: "this finding is correct and we are shipping anyway."
// Mandatory categories (secrets-and-env, auth, authorization, input-validation,
// api-abuse-and-cost, database) CANNOT bypass the gate via risk-acceptance.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import path from "node:path";
import type { ReadinessCategory } from "./taxonomy.js";
import { isMandatoryCategory } from "./taxonomy.js";
import type { BiltCheckFinding } from "./finding.js";

export interface AcceptedRiskEntry {
  findingId: string;
  fingerprint?: string;
  category: ReadinessCategory;
  reason: string;
  owner: string;
  expires?: string;
  createdAt: string;
}

export interface RiskAcceptanceManifest {
  version: "1.0.0";
  acceptedRisks: AcceptedRiskEntry[];
}

const MANIFEST_PATH = ".bilt/accepted-risk.json";

export async function loadAcceptedRisks(rootDir: string): Promise<AcceptedRiskEntry[]> {
  const fullPath = path.join(rootDir, MANIFEST_PATH);
  try {
    const raw = await fs.readFile(fullPath, "utf-8");
    const parsed = JSON.parse(raw) as RiskAcceptanceManifest;
    const now = new Date();

    // Filter out expired entries (surface as active findings)
    return (parsed.acceptedRisks || []).filter((entry) => {
      if (!entry.expires) return true;
      const expiryDate = new Date(entry.expires);
      return expiryDate > now;
    });
  } catch {
    return [];
  }
}

export async function loadAllAcceptedRisksRaw(rootDir: string): Promise<AcceptedRiskEntry[]> {
  const fullPath = path.join(rootDir, MANIFEST_PATH);
  try {
    const raw = await fs.readFile(fullPath, "utf-8");
    const parsed = JSON.parse(raw) as RiskAcceptanceManifest;
    return parsed.acceptedRisks || [];
  } catch {
    return [];
  }
}

export async function saveAcceptedRisk(
  rootDir: string,
  entry: Omit<AcceptedRiskEntry, "createdAt">,
): Promise<{ success: boolean; error?: string }> {
  // Check mandatory categories
  if (isMandatoryCategory(entry.category)) {
    return {
      success: false,
      error:
        `Category '${entry.category}' is a mandatory production readiness category. ` +
        "Risk acceptance is prohibited for mandatory categories (secrets-and-env, auth, authorization, " +
        "input-validation, api-abuse-and-cost, database). Issues must be resolved or suppressed with reason.",
    };
  }

  const fullPath = path.join(rootDir, MANIFEST_PATH);
  const dirPath = path.dirname(fullPath);

  try {
    await fs.mkdir(dirPath, { recursive: true });
    const existing = await loadAllAcceptedRisksRaw(rootDir);

    // Remove any existing entry for this findingId / fingerprint
    const updated = existing.filter(
      (e) => e.findingId !== entry.findingId && (!entry.fingerprint || e.fingerprint !== entry.fingerprint),
    );

    updated.push({
      ...entry,
      createdAt: new Date().toISOString(),
    });

    const manifest: RiskAcceptanceManifest = {
      version: "1.0.0",
      acceptedRisks: updated,
    };

    await fs.writeFile(fullPath, JSON.stringify(manifest, null, 2), "utf-8");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function isRiskAccepted(
  finding: BiltCheckFinding,
  acceptedRisks: AcceptedRiskEntry[],
): { accepted: boolean; entry?: AcceptedRiskEntry } {
  // Never allow risk acceptance for mandatory categories
  if (isMandatoryCategory(finding.category)) {
    return { accepted: false };
  }

  const match = acceptedRisks.find(
    (e) => e.findingId === finding.ruleId || (e.fingerprint && e.fingerprint === finding.fingerprint),
  );

  if (match) {
    return { accepted: true, entry: match };
  }

  return { accepted: false };
}
