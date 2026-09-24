import { simpleGit } from "simple-git";
import path from "node:path";

export interface GitScopeOptions {
  changed?: boolean;
  base?: string;
}

export interface GitDiffScope {
  changedFiles: Set<string>;
  changedLines: Map<string, Set<number>>;
  newFiles: Set<string>;
}

/**
 * Parse unified diff hunk headers: @@ -oldStart,oldCount +newStart,newCount @@
 */
export function parseChangedLinesFromDiff(diffText: string): {
  fileChangedLines: Map<string, Set<number>>;
  newFiles: Set<string>;
} {
  const fileChangedLines = new Map<string, Set<number>>();
  const newFiles = new Set<string>();

  const fileDiffs = diffText.split(/^diff --git /m);

  for (const fileDiff of fileDiffs) {
    if (!fileDiff.trim()) continue;

    // Extract target file path (b/path/to/file)
    const matchFile = fileDiff.match(/^\+\+\+ b\/(.+)$/m);
    if (!matchFile) continue;

    const filePath = matchFile[1]!.trim();
    if (fileDiff.includes("new file mode")) {
      newFiles.add(filePath);
    }

    const changedLinesSet = new Set<number>();
    const hunkHeaderRegex = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm;
    let hunkMatch: RegExpExecArray | null;

    while ((hunkMatch = hunkHeaderRegex.exec(fileDiff)) !== null) {
      const startLine = parseInt(hunkMatch[2]!, 10);
      const count = hunkMatch[3] !== undefined ? parseInt(hunkMatch[3], 10) : 1;

      for (let i = 0; i < count; i++) {
        changedLinesSet.add(startLine + i);
      }
    }

    fileChangedLines.set(filePath, changedLinesSet);
  }

  return { fileChangedLines, newFiles };
}

/**
 * Determine changed files and lines based on working tree vs HEAD or base ref.
 */
export async function getGitScope(
  rootDir: string,
  options: GitScopeOptions,
): Promise<GitDiffScope | null> {
  if (!options.changed && !options.base) {
    return null;
  }

  try {
    const git = simpleGit(rootDir);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) return null;

    let diffText = "";
    if (options.base) {
      diffText = await git.diff([options.base]);
    } else if (options.changed) {
      // Unstaged + staged vs HEAD
      diffText = await git.diff(["HEAD"]);
      // Also get untracked files
      const status = await git.status();
      const untracked = status.not_added;
      const { fileChangedLines, newFiles } =
        parseChangedLinesFromDiff(diffText);

      for (const u of untracked) {
        newFiles.add(u);
        if (!fileChangedLines.has(u)) {
          fileChangedLines.set(u, new Set());
        }
      }

      const changedFiles = new Set([...fileChangedLines.keys(), ...newFiles]);
      return { changedFiles, changedLines: fileChangedLines, newFiles };
    }

    const { fileChangedLines, newFiles } = parseChangedLinesFromDiff(diffText);
    const changedFiles = new Set([...fileChangedLines.keys(), ...newFiles]);

    return { changedFiles, changedLines: fileChangedLines, newFiles };
  } catch {
    return null;
  }
}

/**
 * Check if a finding's location was introduced by the diff scope.
 */
export function isFindingIntroducedByChange(
  findingFile: string,
  findingLine: number,
  scope: GitDiffScope | null,
): boolean {
  if (!scope) return true; // If no scope applied, considered introduced/relevant

  const normPath = findingFile.replace(/\\/g, "/").replace(/^\.\//, "");

  if (scope.newFiles.has(normPath)) {
    return true;
  }

  if (!scope.changedFiles.has(normPath)) {
    return false;
  }

  const lines = scope.changedLines.get(normPath);
  if (!lines || lines.size === 0) {
    return true; // Whole file was changed
  }

  return lines.has(findingLine);
}
