// ─── Git Intelligence Scanner ──────────────────────────────────────────────
// Analyzes local Git repository, commits, tracked files, and large binaries.
// ─────────────────────────────────────────────────────────────────────────────

import { simpleGit } from "simple-git";
import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";
import type { ScanFinding } from "../../types/index.js";

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}

export async function scanGitRepository(
  rootDir: string,
  options: { historyDepth?: number } = {},
): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = [];
  const git = simpleGit(rootDir);

  let isRepo = false;
  try {
    isRepo = await git.checkIsRepo();
  } catch {
    return findings;
  }

  if (!isRepo) return findings;

  // 1. Check for accidentally committed .env files in Git index
  try {
    const trackedFilesRaw = await git.raw(["ls-files"]);
    const trackedFiles = trackedFilesRaw.split("\n").map((f) => f.trim()).filter(Boolean);

    for (const file of trackedFiles) {
      const basename = path.basename(file).toLowerCase();
      if (
        basename.startsWith(".env") &&
        basename !== ".env.example" &&
        basename !== ".env.template" &&
        basename !== ".env.sample"
      ) {
        findings.push({
          id: nextId("git-committed-env"),
          severity: "critical",
          category: "git-committed-env",
          message: `${file} is tracked in Git! Secret environment files must not be committed.`,
          file,
          suggestion: `Run "git rm --cached ${file}" and add "${basename}" to .gitignore`,
        });
      }
    }
  } catch {
    // Skip
  }

  // 2. Check for large binary files (>5MB)
  try {
    const files = await fg(["**/*"], {
      cwd: rootDir,
      ignore: ["node_modules/**", ".git/**", "dist/**", "build/**"],
      onlyFiles: true,
    });

    for (const file of files) {
      const fullPath = path.join(rootDir, file);
      try {
        const stat = await fs.stat(fullPath);
        const sizeMb = stat.size / (1024 * 1024);
        if (sizeMb > 5) {
          findings.push({
            id: nextId("git-large-file"),
            severity: "warning",
            category: "git-large-file",
            message: `Large file (${sizeMb.toFixed(1)}MB) detected: ${file}`,
            file,
            suggestion: "Use Git LFS (Large File Storage) or store large binaries in Cloud Storage.",
          });
        }
      } catch {
        // Skip
      }
    }
  } catch {
    // Skip
  }

  // 3. Commit hygiene analysis (recent commit messages & WIP commits)
  try {
    const depth = options.historyDepth || 10;
    const log = await git.log({ maxCount: depth });
    for (const commit of log.all) {
      const subject = (commit.message || "").split("\n")[0]?.trim() || "";
      if (
        subject.toLowerCase().startsWith("wip") ||
        subject.toLowerCase().includes("fixup") ||
        subject.toLowerCase() === "temp" ||
        subject.toLowerCase() === "test"
      ) {
        findings.push({
          id: nextId("git-hygiene"),
          severity: "info",
          category: "git-hygiene",
          message: `Unclean commit message in history (${commit.hash.slice(0, 7)}): "${subject}"`,
          file: ".git",
          suggestion: "Squash or rebase WIP commit messages before pushing to production.",
        });
        break;
      }
    }
  } catch {
    // Skip
  }

  return findings;
}
