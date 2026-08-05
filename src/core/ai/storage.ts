// ─── Key Storage Engine ────────────────────────────────────────────────────────
// Secure credential management: Env vars -> OS Keyring -> AES-256-GCM encrypted fallback file

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import type { AIProviderId } from "./types.js";

const BILT_DIR = path.join(os.homedir(), ".bilt");
const CREDENTIALS_FILE = path.join(BILT_DIR, "credentials");
const SECRET_KEY_FILE = path.join(BILT_DIR, ".key");

export interface StoredKeyResult {
  key: string | null;
  source: "env" | "keyring" | "encrypted-file" | "none";
}

export interface SaveKeyResult {
  success: boolean;
  storageMethod: "keyring" | "encrypted-file";
  error?: string;
}

const ENV_VAR_MAP: Record<AIProviderId, string> = {
  anthropic: "BILT_ANTHROPIC_API_KEY",
  openai: "BILT_OPENAI_API_KEY",
  gemini: "BILT_GEMINI_API_KEY",
  openrouter: "BILT_OPENROUTER_API_KEY",
  groq: "BILT_GROQ_API_KEY",
};

/**
 * Mask an API key for safe display (e.g. sk-...a91f)
 */
export function maskApiKey(key: string): string {
  if (!key) return "";
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "********";
  const prefix = trimmed.slice(0, 3);
  const suffix = trimmed.slice(-4);
  return `${prefix}...${suffix}`;
}

/**
 * Retrieve API key for a provider based on precedence hierarchy:
 * 1. Environment variable override
 * 2. OS-native credential store (Keyring)
 * 3. AES-256-GCM encrypted fallback file (~/.bilt/credentials)
 */
export async function getApiKey(provider: AIProviderId): Promise<StoredKeyResult> {
  // 1. Check environment variable override
  const envVarName = ENV_VAR_MAP[provider];
  if (envVarName && process.env[envVarName] && process.env[envVarName]!.trim() !== "") {
    return { key: process.env[envVarName]!.trim(), source: "env" };
  }

  // 2. Try OS Keyring
  try {
    // @ts-ignore
    const keyringModule = await import("@napi-rs/keyring").catch(() => null);
    if (keyringModule && keyringModule.Entry) {
      const entry = new keyringModule.Entry("bilt-cli", provider);
      const secret = entry.getPassword();
      if (secret && secret.trim() !== "") {
        return { key: secret.trim(), source: "keyring" };
      }
    }
  } catch {
    // OS Keyring unavailable or errored
  }

  // 3. Try AES-256-GCM encrypted file fallback
  try {
    const encryptedStore = readEncryptedCredentialsStore();
    if (encryptedStore[provider] && encryptedStore[provider].trim() !== "") {
      return { key: encryptedStore[provider].trim(), source: "encrypted-file" };
    }
  } catch {
    // Encrypted file missing or unreadable
  }

  return { key: null, source: "none" };
}

/**
 * Save API key using OS Keyring or AES-256-GCM encrypted file fallback
 */
export async function saveApiKey(provider: AIProviderId, key: string): Promise<SaveKeyResult> {
  const cleanKey = key.trim();

  // Try OS Keyring first
  try {
    // @ts-ignore
    const keyringModule = await import("@napi-rs/keyring").catch(() => null);
    if (keyringModule && keyringModule.Entry) {
      const entry = new keyringModule.Entry("bilt-cli", provider);
      entry.setPassword(cleanKey);
      return { success: true, storageMethod: "keyring" };
    }
  } catch {
    // OS Keyring failed, proceed to fallback
  }

  // Fallback: Encrypted file
  try {
    const store = readEncryptedCredentialsStore();
    store[provider] = cleanKey;
    writeEncryptedCredentialsStore(store);
    return { success: true, storageMethod: "encrypted-file" };
  } catch (err: any) {
    return {
      success: false,
      storageMethod: "encrypted-file",
      error: err?.message || String(err),
    };
  }
}

/**
 * Remove stored API key for a provider
 */
export async function deleteApiKey(provider: AIProviderId): Promise<boolean> {
  let removed = false;

  // Keyring
  try {
    // @ts-ignore
    const keyringModule = await import("@napi-rs/keyring").catch(() => null);
    if (keyringModule && keyringModule.Entry) {
      const entry = new keyringModule.Entry("bilt-cli", provider);
      entry.deletePassword();
      removed = true;
    }
  } catch {
    // Ignore
  }

  // Encrypted file
  try {
    const store = readEncryptedCredentialsStore();
    if (store[provider]) {
      delete store[provider];
      writeEncryptedCredentialsStore(store);
      removed = true;
    }
  } catch {
    // Ignore
  }

  return removed;
}

// ─── AES-256-GCM Helpers ──────────────────────────────────────────────────────

function ensureBiltDirExists(): void {
  if (!fs.existsSync(BILT_DIR)) {
    fs.mkdirSync(BILT_DIR, { recursive: true, mode: 0o700 });
  }
}

function getOrCreateMachineKey(): Buffer {
  ensureBiltDirExists();
  if (fs.existsSync(SECRET_KEY_FILE)) {
    return fs.readFileSync(SECRET_KEY_FILE);
  }

  // Generate 256-bit machine key
  const randomSecret = crypto.randomBytes(32);
  fs.writeFileSync(SECRET_KEY_FILE, randomSecret, { mode: 0o600 });
  return randomSecret;
}

function readEncryptedCredentialsStore(): Record<string, string> {
  ensureBiltDirExists();
  if (!fs.existsSync(CREDENTIALS_FILE)) return {};

  const fileContent = fs.readFileSync(CREDENTIALS_FILE, "utf8");
  if (!fileContent.trim()) return {};

  const { iv, authTag, data } = JSON.parse(fileContent);
  const secretKey = getOrCreateMachineKey();

  const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  let decrypted = decipher.update(data, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return JSON.parse(decrypted);
}

function writeEncryptedCredentialsStore(store: Record<string, string>): void {
  ensureBiltDirExists();
  const secretKey = getOrCreateMachineKey();
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey, iv);
  let encrypted = cipher.update(JSON.stringify(store), "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  const payload = JSON.stringify({
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    data: encrypted,
  });

  fs.writeFileSync(CREDENTIALS_FILE, payload, { mode: 0o600 });
}
