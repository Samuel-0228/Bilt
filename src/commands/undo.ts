// ─── Undo Command ────────────────────────────────────────────────────────────
// Restore the latest snapshot to revert changes made by `bilt fix`.

import path from "node:path";
import { colors, glyphs, text } from "../ui/theme.js";
import {
  getLatestSnapshot,
  listSnapshots,
  restoreSnapshot,
} from "../core/fix/snapshot.js";
import { requireSimpleConfirmation } from "../core/fix/confirm.js";
import { reportUndoComplete } from "../ui/reporter.js";
import { formatDiff } from "../ui/format.js";
import { promises as fs } from "node:fs";

/**
 * Execute the `bilt undo` command.
 *
 * 1. List available snapshots
 * 2. Get latest snapshot
 * 3. Show preview of what will be restored
 * 4. Require confirmation
 * 5. Restore snapshot
 * 6. Report success
 */
export async function executeUndo(projectDir: string): Promise<void> {
  const rootDir = path.resolve(projectDir);

  // ── List snapshots ──────────────────────────────────────────────────
  const snapshots = await listSnapshots(rootDir);

  if (snapshots.length === 0) {
    console.log("");
    console.log(colors.amberFlag.apply("  " + glyphs.warning + " No snapshots found. Nothing to undo."));
    console.log(
      colors.slateDim.dim(
        "  Snapshots are created automatically when `bilt fix` or `bilt init` makes changes.",
      ),
    );
    console.log("");
    return;
  }

  // ── Get latest snapshot ─────────────────────────────────────────────
  const snapshot = await getLatestSnapshot(rootDir);

  if (!snapshot) {
    console.log("");
    console.log(colors.amberFlag.apply("  " + glyphs.warning + " Could not load the latest snapshot."));
    console.log("");
    return;
  }

  // ── Preview changes ─────────────────────────────────────────────────
  console.log("");
  console.log(text.bold("  " + glyphs.info + " Snapshot: " + colors.vitalTeal.apply(snapshot.id)));
  console.log(colors.slateDim.dim("  " + snapshot.description));
  console.log(
    colors.slateDim.dim("  Created: " + new Date(snapshot.timestamp).toLocaleString()),
  );
  console.log("");
  console.log(text.bold("  Files to restore:"));

  for (const file of snapshot.files) {
    const fullPath = path.join(rootDir, file.path);
    let currentContent = "";
    try {
      currentContent = await fs.readFile(fullPath, "utf-8");
    } catch {
      currentContent = "";
    }

    const hasChanged = currentContent !== file.content;

    if (hasChanged) {
      console.log(colors.amberFlag.apply("    " + glyphs.warning + " " + file.path));

      // Show brief diff
      const diff = formatDiff(currentContent, file.content);
      const diffLines = diff.split("\n").slice(0, 8);
      for (const line of diffLines) {
        console.log(`      ${line}`);
      }
      if (diff.split("\n").length > 8) {
        console.log(colors.slateDim.dim("      ... and more"));
      }
    } else {
      console.log(colors.slateDim.dim("    " + glyphs.fixed + " " + file.path + " (unchanged)"));
    }
  }

  console.log("");

  // ── Confirm ─────────────────────────────────────────────────────────
  const confirmed = await requireSimpleConfirmation({
    id: "undo",
    description: `Restore ${snapshot.files.length} file(s) from snapshot`,
    type: "destructive",
    findingId: "undo",
    apply: async () => true,
  });

  if (!confirmed) {
    console.log(colors.slateDim.dim("  Undo cancelled."));
    console.log("");
    return;
  }

  // ── Restore ─────────────────────────────────────────────────────────
  await restoreSnapshot(snapshot.id, rootDir);

  reportUndoComplete(snapshot);
}
