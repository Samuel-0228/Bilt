// ─── Bilt Project Contract & Requirements Model ────────────────────────────────
// Defines structured project requirements that AI coding agents must satisfy.
// Stored in `.bilt/requirements.json`.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import path from "node:path";

export type RequirementType =
  | "functional"
  | "security"
  | "authentication"
  | "authorization"
  | "privacy"
  | "performance"
  | "accessibility"
  | "ux"
  | "design"
  | "deployment"
  | "data"
  | "api"
  | "business";

export type RequirementPriority = "critical" | "high" | "medium" | "low";

export type RequirementSource = "developer" | "agent" | "inherited";

export interface Requirement {
  /** Unique ID, e.g. "REQ-AUTH-001" */
  id: string;
  /** Human-readable description of what must be built / satisfied */
  description: string;
  type: RequirementType;
  priority: RequirementPriority;
  source: RequirementSource;
  /** File paths or globs where this requirement is implemented */
  targetFiles?: string[];
  /** Optional automated test or verification command */
  verificationCommand?: string;
  /** ISO date when requirement was created */
  createdAt?: string;
}

export interface ProjectRequirementsContract {
  schemaVersion: "1";
  requirements: Requirement[];
  lastUpdated?: string;
}

export function getRequirementsFilePath(rootDir: string): string {
  return path.join(rootDir, ".bilt", "requirements.json");
}

/**
 * Load project requirements from `.bilt/requirements.json`.
 * Returns an empty contract if the file does not exist.
 */
export async function loadRequirementsContract(
  rootDir: string,
): Promise<ProjectRequirementsContract> {
  const filePath = getRequirementsFilePath(rootDir);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(content);
    return {
      schemaVersion: "1",
      requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
      lastUpdated: parsed.lastUpdated,
    };
  } catch {
    return {
      schemaVersion: "1",
      requirements: [],
    };
  }
}

/**
 * Save project requirements to `.bilt/requirements.json`.
 */
export async function saveRequirementsContract(
  rootDir: string,
  contract: ProjectRequirementsContract,
): Promise<void> {
  const biltDir = path.join(rootDir, ".bilt");
  await fs.mkdir(biltDir, { recursive: true });
  const filePath = getRequirementsFilePath(rootDir);

  const payload: ProjectRequirementsContract = {
    schemaVersion: "1",
    requirements: contract.requirements,
    lastUpdated: new Date().toISOString(),
  };

  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
}

/**
 * Add or update a requirement in the contract.
 */
export async function upsertRequirement(
  rootDir: string,
  req: Requirement,
): Promise<ProjectRequirementsContract> {
  const contract = await loadRequirementsContract(rootDir);
  const existingIdx = contract.requirements.findIndex((r) => r.id === req.id);

  const reqWithMeta: Requirement = {
    ...req,
    createdAt: req.createdAt || new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    contract.requirements[existingIdx] = reqWithMeta;
  } else {
    contract.requirements.push(reqWithMeta);
  }

  await saveRequirementsContract(rootDir, contract);
  return contract;
}

/**
 * Remove a requirement by ID.
 */
export async function removeRequirement(
  rootDir: string,
  requirementId: string,
): Promise<ProjectRequirementsContract> {
  const contract = await loadRequirementsContract(rootDir);
  contract.requirements = contract.requirements.filter((r) => r.id !== requirementId);
  await saveRequirementsContract(rootDir, contract);
  return contract;
}
