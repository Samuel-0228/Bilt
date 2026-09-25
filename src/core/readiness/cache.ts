// ─── File-Hash Based Caching & Performance Guard (Section 16B) ────────────────
// Caches findings tied to unchanged file content (by SHA-256 hash).
// Provides size limit guards and timeout protection for deterministic analysis.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { BiltCheckFinding } from "./finding.js";

const CACHE_FILE = ".bilt/cache/readiness-cache.json";
export const MAX_FILE_SIZE = 1024 * 1024; // 1 MB limit per source file

export interface FileCacheEntry {
  hash: string;
  timestamp: string;
  findings: BiltCheckFinding[];
}

export interface ReadinessCacheManifest {
  version: "1.0.0";
  files: Record<string, FileCacheEntry>;
}

export function computeContentHash(content: string): string {
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
}

export async function loadReadinessCache(rootDir: string): Promise<ReadinessCacheManifest> {
  const fullPath = path.join(rootDir, CACHE_FILE);
  try {
    const raw = await fs.readFile(fullPath, "utf-8");
    return JSON.parse(raw) as ReadinessCacheManifest;
  } catch {
    return { version: "1.0.0", files: {} };
  }
}

export async function saveReadinessCache(
  rootDir: string,
  cache: ReadinessCacheManifest,
): Promise<void> {
  const fullPath = path.join(rootDir, CACHE_FILE);
  try {
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, JSON.stringify(cache, null, 2), "utf-8");
  } catch {
    // Non-fatal if cache saving fails
  }
}
