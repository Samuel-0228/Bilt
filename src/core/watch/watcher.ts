// ─── File Watcher ────────────────────────────────────────────────────────────
//
// Watches the project directory for file changes and runs incremental
// secret + env scans on modified files.  Uses chokidar for cross-platform
// file watching with 300ms debouncing.
// ─────────────────────────────────────────────────────────────────────────────

import chokidar from "chokidar";
import fs from "node:fs/promises";
import { scanFileForSecrets } from "../scan/secrets.js";
import { SECRET_RULES } from "../rules/secret-rules.js";
import type { BiltConfig, ScanFinding, WatchEvent } from "../../types/index.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WatcherHandle {
  close: () => Promise<void>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Default debounce interval in milliseconds. */
const DEFAULT_DEBOUNCE_MS = 300;

/** Directories and file patterns to always ignore. */
const IGNORED_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/.bilt/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/.svelte-kit/**",
  "**/__pycache__/**",
];

/** Binary file extensions to skip. */
const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".ico",
  ".webp",
  ".svg",
  ".mp3",
  ".mp4",
  ".avi",
  ".mov",
  ".webm",
  ".zip",
  ".tar",
  ".gz",
  ".rar",
  ".7z",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".lock",
  ".map",
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Check if a file path has a binary extension.
 */
function isBinaryFile(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * Create a debounced version of a function that coalesces rapid calls
 * into a single invocation after a quiet period.
 */
function debounce<T extends (...args: never[]) => void>(
  fn: T,
  delayMs: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delayMs);
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Start watching a project directory for file changes.
 *
 * On each change:
 *   1. Read the modified file.
 *   2. Run secret-detection rules against its content.
 *   3. Invoke the `onEvent` callback with the resulting findings.
 *
 * The watcher ignores `node_modules`, `.git`, `.bilt`, `dist`, `build`,
 * and binary files.  Changes are debounced (default 300ms) to avoid
 * flooding the callback during bulk operations like `npm install`.
 *
 * @param projectDir Root directory to watch.
 * @param config     Bilt configuration (used for entropy threshold & ignore patterns).
 * @param onEvent    Callback invoked with watch events.
 * @returns A handle with a `close()` method to stop watching.
 */
export function startWatcher(
  projectDir: string,
  config: BiltConfig,
  onEvent: (event: WatchEvent) => void,
): WatcherHandle {
  // Merge user-configured ignore patterns with defaults
  const ignorePatterns = [...IGNORED_PATTERNS, ...config.ignore];

  // Combine built-in rules with custom rules
  const allRules = [...SECRET_RULES, ...config.customRules];

  const watcher = chokidar.watch(projectDir, {
    ignored: ignorePatterns,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 200,
      pollInterval: 100,
    },
  });

  /**
   * Process a single file event.
   */
  const processFile = async (
    eventType: "add" | "change",
    filePath: string,
  ): Promise<void> => {
    // Skip binary files
    if (isBinaryFile(filePath)) return;

    let content: string;
    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch {
      // File may have been deleted between the event and the read
      return;
    }

    const findings: ScanFinding[] = scanFileForSecrets(
      content,
      filePath,
      allRules,
      config.entropyThreshold,
    );

    const event: WatchEvent = {
      type: eventType,
      file: filePath,
      findings,
      timestamp: new Date(),
    };

    onEvent(event);
  };

  // Create debounced handler
  const debouncedProcess = debounce(
    (eventType: "add" | "change", filePath: string) => {
      void processFile(eventType, filePath);
    },
    DEFAULT_DEBOUNCE_MS,
  );

  // Attach event handlers
  watcher.on("add", (filePath: string) => {
    debouncedProcess("add", filePath);
  });

  watcher.on("change", (filePath: string) => {
    debouncedProcess("change", filePath);
  });

  watcher.on("unlink", (filePath: string) => {
    const event: WatchEvent = {
      type: "unlink",
      file: filePath,
      findings: [],
      timestamp: new Date(),
    };
    onEvent(event);
  });

  return {
    close: async () => {
      await watcher.close();
    },
  };
}

/**
 * Stop a running watcher.
 *
 * @param watcher The watcher handle returned by `startWatcher`.
 */
export async function stopWatcher(watcher: WatcherHandle): Promise<void> {
  await watcher.close();
}
