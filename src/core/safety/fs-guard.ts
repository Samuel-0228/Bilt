import fs from "node:fs/promises";
import path from "node:path";
import { FilesystemError } from "../errors/domain.js";

/**
 * Validates that a given target directory exists and is a directory.
 * Returns the resolved absolute path.
 * Throws a clean, user-friendly FilesystemError if not found or invalid.
 */
export async function validateProjectDirectory(dir: string): Promise<string> {
  const resolved = path.resolve(dir);
  try {
    const stat = await fs.stat(resolved);
    if (!stat.isDirectory()) {
      throw new FilesystemError(`Target path is not a directory: ${dir}`, {
        code: "ERR_FS_NOT_A_DIRECTORY",
        context: { path: dir, resolvedPath: resolved },
      });
    }
  } catch (err: any) {
    if (err instanceof FilesystemError) {
      throw err;
    }
    if (err.code === "ENOENT") {
      throw new FilesystemError(`Directory not found: ${dir}`, {
        code: "ERR_FS_NOT_FOUND",
        cause: err,
        context: { path: dir, resolvedPath: resolved },
      });
    }
    if (err.message && (err.message.includes("not a directory") || err.message.includes("Directory not found"))) {
      throw err;
    }
    throw new FilesystemError(`Unable to access directory "${dir}": ${err.message || String(err)}`, {
      code: "ERR_FS_ACCESS_DENIED",
      cause: err,
      context: { path: dir, resolvedPath: resolved },
    });
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

/**
 * Validates that a file path is safe to access within rootDir.
 * Protects against null-byte injection, path traversal, and directory escape.
 */
export function validateSafePath(targetPath: string, rootDir: string): string {
  if (!targetPath || typeof targetPath !== "string") {
    throw new FilesystemError("Path argument is empty or invalid", {
      code: "ERR_FS_INVALID_PATH",
    });
  }

  if (targetPath.includes("\0")) {
    throw new FilesystemError(`Null byte detected in path: ${targetPath}`, {
      code: "ERR_FS_NULL_BYTE",
      context: { targetPath },
    });
  }

  const resolved = path.resolve(rootDir, targetPath);
  if (!isPathContained(resolved, rootDir)) {
    throw new FilesystemError(`Path traversal attempt detected: ${targetPath}`, {
      code: "ERR_FS_PATH_TRAVERSAL",
      context: { targetPath, rootDir, resolvedPath: resolved },
    });
  }

  return resolved;
}

/**
 * Checks whether a buffer represents binary data (contains null bytes in leading chunk).
 */
export function isBinaryContent(buffer: Buffer): boolean {
  const checkLength = Math.min(buffer.length, 1024);
  for (let i = 0; i < checkLength; i++) {
    if (buffer[i] === 0) {
      return true;
    }
  }
  return false;
}

export interface SafeReadResult {
  content: string | null;
  skippedReason?: "escaping_symlink" | "broken_symlink" | "huge_file" | "binary_file" | "not_a_file" | "permission_denied";
}

/**
 * Safely reads a project file, guarding against path traversal, symlink escapes,
 * huge files (>1MB), binary files, and permission failures.
 */
export async function safeReadProjectFile(
  filePath: string,
  rootDir: string,
  maxSizeBytes: number = 1_048_576,
): Promise<SafeReadResult> {
  try {
    const safePath = validateSafePath(filePath, rootDir);

    const lstat = await fs.lstat(safePath).catch(() => null);
    if (!lstat) {
      return { content: null, skippedReason: "not_a_file" };
    }

    if (lstat.isSymbolicLink()) {
      const escaping = await isSymlinkEscaping(safePath, rootDir);
      if (escaping) {
        return { content: null, skippedReason: "escaping_symlink" };
      }
    }

    const stat = await fs.stat(safePath).catch(() => null);
    if (!stat || !stat.isFile()) {
      return { content: null, skippedReason: "not_a_file" };
    }

    if (stat.size > maxSizeBytes) {
      return { content: null, skippedReason: "huge_file" };
    }

    const rawBuffer = await fs.readFile(safePath);
    if (isBinaryContent(rawBuffer)) {
      return { content: null, skippedReason: "binary_file" };
    }

    return { content: rawBuffer.toString("utf-8") };
  } catch (err: any) {
    if (err?.code === "EACCES" || err?.code === "EPERM") {
      return { content: null, skippedReason: "permission_denied" };
    }
    if (err instanceof FilesystemError) {
      throw err;
    }
    return { content: null, skippedReason: "not_a_file" };
  }
}
