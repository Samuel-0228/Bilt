// ─── Snapshot System ─────────────────────────────────────────────────────────
//
// Before applying destructive or irreversible fixes, Bilt creates a
// snapshot of the affected files so the user can roll back.  Snapshots
// are stored under `.bilt/snapshots/<id>/` with a `manifest.json` and
// copies of every affected file.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type {
  Snapshot,
  SnapshotFile,
  SnapshotManifest,
} from "../../types/index.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const SNAPSHOTS_DIR = ".bilt/snapshots";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve the snapshots root directory for a project.
 */
function snapshotsRoot(projectDir: string): string {
  return path.join(projectDir, SNAPSHOTS_DIR);
}

/**
 * Resolve the directory for a specific snapshot.
 */
function snapshotDir(projectDir: string, id: string): string {
  return path.join(snapshotsRoot(projectDir), id);
}

/**
 * Generate a short, unique snapshot ID based on timestamp + random suffix.
 */
function generateId(): string {
  const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14); // YYYYMMDDHHmmss
  const rand = crypto.randomBytes(4).toString("hex");
  return `${ts}-${rand}`;
}

/**
 * Ensure a directory exists, creating it (and parents) if necessary.
 */
async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Read the manifest.json from a snapshot directory.
 * Returns null if the manifest is missing or invalid.
 */
async function readManifest(dir: string): Promise<SnapshotManifest | null> {
  try {
    const raw = await fs.readFile(path.join(dir, "manifest.json"), "utf-8");
    return JSON.parse(raw) as SnapshotManifest;
  } catch {
    return null;
  }
}

/**
 * Convert a manifest + its on-disk files into a full `Snapshot` object.
 */
async function hydrateSnapshot(
  manifest: SnapshotManifest,
  dir: string,
): Promise<Snapshot> {
  const files: SnapshotFile[] = [];

  for (const relativePath of manifest.filePaths) {
    try {
      const content = await fs.readFile(
        path.join(dir, "files", relativePath),
        "utf-8",
      );
      files.push({ path: relativePath, content });
    } catch {
      // File may have been deleted from the snapshot store — skip
    }
  }

  return {
    id: manifest.id,
    timestamp: new Date(manifest.timestamp),
    description: manifest.description,
    files,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a snapshot of the specified files.
 *
 * Copies each file into `.bilt/snapshots/<id>/files/` preserving relative
 * paths, and writes a `manifest.json` describing the snapshot.
 *
 * @param files       Absolute paths of files to snapshot.
 * @param description Human-readable description (e.g. "Before gitignore fix").
 * @param projectDir  Root directory of the project.
 * @returns The created Snapshot.
 */
export async function createSnapshot(
  files: string[],
  description: string,
  projectDir: string,
): Promise<Snapshot> {
  const id = generateId();
  const dir = snapshotDir(projectDir, id);
  const filesDir = path.join(dir, "files");
  await ensureDir(filesDir);

  const snapshotFiles: SnapshotFile[] = [];
  const filePaths: string[] = [];

  for (const absPath of files) {
    const relativePath = path.relative(projectDir, absPath).replace(/\\/g, "/");

    try {
      const content = await fs.readFile(absPath, "utf-8");

      // Preserve directory structure inside the snapshot
      const destPath = path.join(filesDir, relativePath);
      await ensureDir(path.dirname(destPath));
      await fs.writeFile(destPath, content, "utf-8");

      snapshotFiles.push({ path: relativePath, content });
      filePaths.push(relativePath);
    } catch {
      // File might not exist (e.g. about to be created) — skip
    }
  }

  const timestamp = new Date();

  // Write manifest
  const manifest: SnapshotManifest = {
    id,
    timestamp: timestamp.toISOString(),
    description,
    filePaths,
  };

  await fs.writeFile(
    path.join(dir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8",
  );

  return {
    id,
    timestamp,
    description,
    files: snapshotFiles,
  };
}

/**
 * List all existing snapshots, sorted by timestamp (newest first).
 */
export async function listSnapshots(projectDir: string): Promise<Snapshot[]> {
  const root = snapshotsRoot(projectDir);

  let entries: string[];
  try {
    entries = await fs.readdir(root);
  } catch {
    // No snapshots directory — nothing to list
    return [];
  }

  const snapshots: Snapshot[] = [];

  for (const entry of entries) {
    const dir = path.join(root, entry);

    // Skip non-directories
    try {
      const stat = await fs.stat(dir);
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }

    const manifest = await readManifest(dir);
    if (!manifest) continue;

    const snapshot = await hydrateSnapshot(manifest, dir);
    snapshots.push(snapshot);
  }

  // Newest first
  snapshots.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return snapshots;
}

/**
 * Get the most recent snapshot, or `null` if none exist.
 */
export async function getLatestSnapshot(
  projectDir: string,
): Promise<Snapshot | null> {
  const all = await listSnapshots(projectDir);
  return all[0] ?? null;
}

/**
 * Restore files from a snapshot back to their original locations.
 *
 * @param snapshotId  The snapshot ID to restore.
 * @param projectDir  Root directory of the project.
 * @returns `true` if the snapshot was found and restored, `false` otherwise.
 */
export async function restoreSnapshot(
  snapshotId: string,
  projectDir: string,
): Promise<boolean> {
  const dir = snapshotDir(projectDir, snapshotId);
  const manifest = await readManifest(dir);

  if (!manifest) return false;

  const snapshot = await hydrateSnapshot(manifest, dir);

  for (const file of snapshot.files) {
    const destPath = path.join(projectDir, file.path);
    await ensureDir(path.dirname(destPath));
    await fs.writeFile(destPath, file.content, "utf-8");
  }

  return true;
}
