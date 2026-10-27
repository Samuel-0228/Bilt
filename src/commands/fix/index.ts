// ─── Fix Command ─────────────────────────────────────────────────────────────
// Scans for issues, generates fix actions, and applies them interactively.
// ─────────────────────────────────────────────────────────────────────────────

import { colors, glyphs } from "../../ui/theme.js";
import { executeScan } from "../scan.js";
import { reportFixPlan } from "../../ui/reporter.js";
import type { FixOptions } from "../../types/index.js";
import { validateProjectDirectory } from "../../core/safety/index.js";
import { generateFixActions } from "./plan.js";
import { createPreFixSnapshot, runSafeFixes } from "./apply.js";
import { runInteractiveFixes } from "./interactive.js";

export * from "./types.js";
export * from "./plan.js";
export * from "./apply.js";
export * from "./interactive.js";
export * from "./verification.js";

/**
 * Execute the `bilt fix` command.
 *
 * 1. Run scan to find issues
 * 2. Generate fix actions
 * 3. Apply fixes (auto for --safe, preview for --dry-run, interactive otherwise)
 * 4. Create snapshot before applying
 * 5. Report results
 */
export async function executeFix(
  projectDir: string,
  options: FixOptions = {},
): Promise<void> {
  const rootDir = await validateProjectDirectory(projectDir);

  // ── Run scan ────────────────────────────────────────────────────────
  const result = await executeScan(rootDir, {
    silent: true,
    debug: options.debug,
    retainSecrets: true,
  });

  if (result.findings.length === 0) {
    console.log("");
    console.log(colors.mintClear.bold("  " + glyphs.passed + " No issues found \u2014 nothing to fix"));
    console.log("");
    return;
  }

  // ── Generate fix actions ────────────────────────────────────────────
  const actions = await generateFixActions(rootDir, result.findings, options);

  if (actions.length === 0) {
    console.log("");
    console.log(
      colors.amberFlag.apply(
        "  " + glyphs.warning + " Issues found but no automated fixes available. Review manually.",
      ),
    );
    console.log("");
    return;
  }

  // ── Dry-run: preview only ───────────────────────────────────────────
  if (options.dryRun) {
    for (const action of actions) {
      const plan = await action.preview();
      await reportFixPlan(plan);
    }
    console.log(colors.slateDim.dim("  (Dry run \u2014 no changes applied)"));
    console.log("");
    return;
  }

  // ── Create snapshot before modifying files ──────────────────────────
  await createPreFixSnapshot(rootDir, result.findings, actions.length);

  // ── Safe mode: auto-apply safe fixes only ───────────────────────────
  if (options.safe) {
    const safeActions = actions.filter((a) => a.type === "safe");
    await runSafeFixes(safeActions, options);
    return;
  }

  // ── Interactive mode ────────────────────────────────────────────────
  await runInteractiveFixes(actions, options);
}
