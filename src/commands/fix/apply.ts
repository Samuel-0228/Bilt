import path from "node:path";
import { promises as fs } from "node:fs";
import { colors, glyphs } from "../../ui/theme.js";
import { createSnapshot } from "../../core/fix/snapshot.js";
import { reportFixComplete } from "../../ui/reporter.js";
import { logger } from "../../core/logging/index.js";
import type { Fix, FixOptions, ScanFinding } from "../../types/index.js";
import type { FixExecutionResult } from "./types.js";

export async function debugReadFile(
  pathStr: string,
  debug?: boolean,
): Promise<string> {
  try {
    const content = await fs.readFile(pathStr, "utf-8");
    if (debug) {
      logger.debug(`[DEBUG READ] ${pathStr} (${Buffer.byteLength(content, "utf8")} bytes)`);
    }
    return content;
  } catch (err) {
    if (debug) {
      logger.debug(`[DEBUG READ] ${pathStr} (Error: ${(err as Error).message})`);
    }
    throw err;
  }
}

export async function debugWriteFile(
  pathStr: string,
  newContent: string,
  oldContent: string = "",
  debug?: boolean,
): Promise<void> {
  if (debug) {
    logger.debug(`[DEBUG WRITE] ${pathStr}`);
    logger.debug(`  Length Before: ${Buffer.byteLength(oldContent, "utf8")} bytes`);
    logger.debug(`  Length After:  ${Buffer.byteLength(newContent, "utf8")} bytes`);
    if (newContent.length === 0) {
      logger.warn(`  WARNING: Write resulted in an EMPTY file!`);
    } else {
      logger.debug(`    (File modified)`);
    }
  }
  await fs.writeFile(pathStr, newContent, "utf-8");
}

export async function createPreFixSnapshot(
  rootDir: string,
  findings: ScanFinding[],
  actionsCount: number,
): Promise<void> {
  const hasSecretHistoryFix = findings.some((f) => f.category === "secret-detected");
  if (hasSecretHistoryFix) return;

  const affectedFiles = new Set<string>([".gitignore", ".env", ".env.example"]);
  for (const finding of findings) {
    if (finding.file && !finding.file.startsWith("git:")) {
      affectedFiles.add(finding.file);
    }
  }

  try {
    await createSnapshot(
      [...affectedFiles].map((f) => path.join(rootDir, f)),
      `Pre-fix snapshot (${actionsCount} fixes)`,
      rootDir,
    );
  } catch {
    // Snapshot creation failure shouldn't block fixes
  }
}

export async function runSafeFixes(
  safeActions: Fix[],
  options: FixOptions = {},
): Promise<FixExecutionResult> {
  if (safeActions.length === 0) {
    console.log("");
    console.log(
      colors.amberFlag.apply(
        "  " + glyphs.warning + " No safe fixes available. Run without --safe for interactive mode.",
      ),
    );
    console.log("");
    return { applied: 0, skipped: 0 };
  }

  let applied = 0;
  let skipped = 0;

  for (const action of safeActions) {
    try {
      await action.preview();
      const result = await action.apply();
      const verification = await action.verify();
      if (result.success && verification.passed) {
        applied++;
        if (options.verbose) {
          console.log(colors.mintClear.apply("    " + glyphs.fixed + " " + action.description));
        }
      } else {
        skipped++;
      }
    } catch (error) {
      skipped++;
      if (options.verbose) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(
          colors.pulseCoral.apply("    " + glyphs.critical + " Failed: " + action.description + " (" + msg + ")"),
        );
      }
    }
  }

  await reportFixComplete(applied, skipped);
  return { applied, skipped };
}
