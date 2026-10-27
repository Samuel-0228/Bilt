import fs from "node:fs/promises";
import path from "node:path";

/**
 * Validates that a given target directory exists and is a directory.
 * Returns the resolved absolute path.
 * Throws a clean, user-friendly Error if not found or invalid.
 */
export async function validateProjectDirectory(dir: string): Promise<string> {
  const resolved = path.resolve(dir);
  try {
    const stat = await fs.stat(resolved);
    if (!stat.isDirectory()) {
      throw new Error(`Target path is not a directory: ${dir}`);
    }
  } catch (err: any) {
    if (err.code === "ENOENT") {
      throw new Error(`Directory not found: ${dir}`);
    }
    if (err.message && (err.message.includes("not a directory") || err.message.includes("Directory not found"))) {
      throw err;
    }
    throw new Error(`Unable to access directory "${dir}": ${err.message || String(err)}`);
  }
  return resolved;
}

/**
 * Checks whether a relative or absolute target path remains safely contained within rootDir.
 * Protects against path traversal (`../`) escapes.
 */
export function isPathContained(targetPath: string, rootDir: string): boolean {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedTarget = path.resolve(resolvedRoot, targetPath);
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + path.sep);
}

/**
 * Checks if a symlink escapes the intended root directory.
 */
export async function isSymlinkEscaping(linkPath: string, rootDir: string): Promise<boolean> {
  try {
    const lstat = await fs.lstat(linkPath);
    if (!lstat.isSymbolicLink()) {
      return false;
    }
    const real = await fs.realpath(linkPath);
    return !isPathContained(real, rootDir);
  } catch {
    return true; // Broken or inaccessible symlinks are treated as unsafe
  }
}
