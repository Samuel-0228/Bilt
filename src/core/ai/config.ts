// ─── AI Global Configuration Engine ──────────────────────────────────────────
// Manages ~/.bilt/config.json and ~/.bilt/last-request.json

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { AIConfig, AIProviderId } from "./types.js";
import { getDefaultModel } from "./models.js";

const BILT_DIR = path.join(os.homedir(), ".bilt");
const CONFIG_FILE = path.join(BILT_DIR, "config.json");
const LAST_REQUEST_FILE = path.join(BILT_DIR, "last-request.json");

function ensureBiltDirExists(): void {
  if (!fs.existsSync(BILT_DIR)) {
    fs.mkdirSync(BILT_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Get global AI & onboarding configuration
 */
export function getAIConfig(): AIConfig {
  ensureBiltDirExists();
  if (!fs.existsSync(CONFIG_FILE)) {
    return {
      providerModels: {},
      lastValidated: {},
      firstRunCompleted: false,
    };
  }

  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw) as AIConfig;
    return {
      activeProvider: parsed.activeProvider,
      providerModels: parsed.providerModels || {},
      lastValidated: parsed.lastValidated || {},
      firstRunCompleted: Boolean(parsed.firstRunCompleted),
    };
  } catch {
    return {
      providerModels: {},
      lastValidated: {},
      firstRunCompleted: false,
    };
  }
}

/**
 * Update global AI configuration
 */
export function setAIConfig(update: Partial<AIConfig>): AIConfig {
  ensureBiltDirExists();
  const current = getAIConfig();
  const updated: AIConfig = {
    ...current,
    ...update,
    providerModels: {
      ...current.providerModels,
      ...(update.providerModels || {}),
    },
    lastValidated: {
      ...current.lastValidated,
      ...(update.lastValidated || {}),
    },
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), { mode: 0o600 });
  return updated;
}

/**
 * Get configured active model for a provider, falling back to default
 */
export function getActiveModel(providerId: AIProviderId): string {
  const config = getAIConfig();
  const chosenModel = config.providerModels[providerId];
  if (chosenModel && chosenModel.trim() !== "") {
    return chosenModel.trim();
  }
  return getDefaultModel(providerId);
}

/**
 * Set configured active model for a provider
 */
export function setActiveModel(providerId: AIProviderId, model: string): void {
  const current = getAIConfig();
  setAIConfig({
    providerModels: {
      ...current.providerModels,
      [providerId]: model.trim(),
    },
  });
}

/**
 * Check if this is the first time Bilt is running on this machine
 */
export function isFirstRun(): boolean {
  const config = getAIConfig();
  return !config.firstRunCompleted;
}

/**
 * Mark first-run onboarding as completed
 */
export function markFirstRunCompleted(): void {
  setAIConfig({ firstRunCompleted: true });
}

/**
 * Record last validated timestamp for provider
 */
export function recordValidation(provider: AIProviderId): void {
  const current = getAIConfig();
  setAIConfig({
    lastValidated: {
      ...current.lastValidated,
      [provider]: new Date().toISOString(),
    },
  });
}

/**
 * Save redacted payload sent to AI for user inspection via `bilt ai last-request --debug`
 */
export function saveLastRequestPayload(payload: any): void {
  ensureBiltDirExists();
  try {
    fs.writeFileSync(LAST_REQUEST_FILE, JSON.stringify(payload, null, 2), { mode: 0o600 });
  } catch {
    // Non-critical local debug log
  }
}

/**
 * Retrieve last saved redacted AI request payload
 */
export function getLastRequestPayload(): any {
  ensureBiltDirExists();
  if (!fs.existsSync(LAST_REQUEST_FILE)) return null;

  try {
    const raw = fs.readFileSync(LAST_REQUEST_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
