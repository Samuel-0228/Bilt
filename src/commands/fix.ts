// ─── Fix Command ─────────────────────────────────────────────────────────────
// Scans for issues, generates fix actions, and applies them interactively.

import path from "node:path";
import { colors, glyphs, sectionHeader, text } from "../ui/theme.js";
import Enquirer from "enquirer";
import { promises as fs } from "node:fs";
import type { FixOptions, FixAction, ScanFinding } from "../types/index.js";
import { executeScan } from "./scan.js";
import { loadConfig } from "../config/config.js";
import { createSnapshot } from "../core/fix/snapshot.js";
import {
  addToGitignore,
  generateEnvExample,
  addMissingEnvVars,
} from "../core/fix/env-fix.js";
import {
  requireTypedConfirmation,
  requireSimpleConfirmation,
} from "../core/fix/confirm.js";
import { reportFixPreview, reportFixComplete } from "../ui/reporter.js";
import { parseEnvFile } from "../core/scan/env.js";
import { SECRET_RULES } from "../core/rules/secret-rules.js";

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
  const rootDir = path.resolve(projectDir);
  const config = await loadConfig(rootDir);

  // ── Run scan ────────────────────────────────────────────────────────
  const result = await executeScan(rootDir, {
    quiet: true,
  });

  if (result.findings.length === 0) {
    console.log("");
    console.log(colors.mintClear.bold("  " + glyphs.passed + " No issues found \u2014 nothing to fix"));
    console.log("");
    return;
  }

  // ── Generate fix actions ────────────────────────────────────────────
  const actions = await generateFixActions(rootDir, result.findings);

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
    await reportFixPreview(actions);
    console.log(colors.slateDim.dim("  (Dry run \u2014 no changes applied)"));
    console.log("");
    return;
  }

  // ── Create snapshot before modifying files ──────────────────────────
  const affectedFiles = new Set<string>();
  for (const action of actions) {
    // Extract file from finding ID heuristic
    affectedFiles.add(".gitignore");
    affectedFiles.add(".env");
    affectedFiles.add(".env.example");
  }

  try {
    await createSnapshot(
      [...affectedFiles].map((f) => path.join(rootDir, f)),
      `Pre-fix snapshot (${actions.length} fixes)`,
      rootDir,
    );
  } catch {
    // Snapshot creation failure shouldn't block fixes
  }

  // ── Safe mode: auto-apply safe fixes only ───────────────────────────
  if (options.safe) {
    const safeActions = actions.filter((a) => a.type === "safe");
    if (safeActions.length === 0) {
      console.log("");
      console.log(
        colors.amberFlag.apply(
          "  " + glyphs.warning + " No safe fixes available. Run without --safe for interactive mode.",
        ),
      );
      console.log("");
      return;
    }

    await reportFixPreview(safeActions);

    let applied = 0;
    let skipped = 0;

    for (const action of safeActions) {
      try {
        const success = await action.apply();
        if (success) {
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
    return;
  }

  // ── Interactive mode ────────────────────────────────────────────────
  await reportFixPreview(actions);

  let applied = 0;
  let skipped = 0;

  for (const action of actions) {
    console.log("");
    console.log(text.bold("  " + action.description));
    if (action.preview) {
      console.log(colors.slateDim.dim("  " + action.preview));
    }

    let shouldApply = false;

    if (action.type === "safe") {
      shouldApply = await requireSimpleConfirmation(action);
    } else if (action.type === "destructive") {
      shouldApply = await requireSimpleConfirmation(action);
    } else {
      // Irreversible — require typed confirmation
      shouldApply = await requireTypedConfirmation(action, "confirm");
    }

    if (shouldApply) {
      try {
        const success = await action.apply();
        if (success) {
          applied++;
          console.log(colors.mintClear.apply("    " + glyphs.fixed + " Applied"));
        } else {
          skipped++;
          console.log(colors.amberFlag.apply("    " + glyphs.info + " Skipped (failed to apply)"));
        }
      } catch (error) {
        skipped++;
        const msg = error instanceof Error ? error.message : String(error);
        console.log(colors.pulseCoral.apply("    " + glyphs.critical + " Error: " + msg));
      }
    } else {
      skipped++;
      console.log(colors.slateDim.dim("    " + glyphs.info + " Skipped"));
    }
  }

  await reportFixComplete(applied, skipped);
}

// ─── Fix Action Generator ────────────────────────────────────────────────────

/**
 * Generate fix actions from scan findings.
 */
async function generateFixActions(
  rootDir: string,
  findings: ScanFinding[],
): Promise<FixAction[]> {
  const actions: FixAction[] = [];
  const addedTypes = new Set<string>();
  const config = await loadConfig(rootDir);

  for (const finding of findings) {
    switch (finding.category) {
      case "gitignore-missing": {
        if (!addedTypes.has("gitignore")) {
          addedTypes.add("gitignore");
          actions.push({
            id: `fix-gitignore-${Date.now()}`,
            description: "Add .env patterns to .gitignore",
            type: "safe",
            findingId: finding.id,
            preview: "Will append .env, .env.*, .env.local to .gitignore",
            apply: async () => {
              const gitignorePath = path.join(rootDir, ".gitignore");
              const newContent = await addToGitignore(
                [".env", ".env.*", ".env.local", ".env.*.local", ".bilt/"],
                gitignorePath,
              );
              await fs.writeFile(gitignorePath, newContent, "utf-8");
              return true;
            },
          });
        }
        break;
      }

      case "env-missing": {
        const key =
          finding.message.match(/["']([^"']+)["']/)?.[1] ??
          finding.message.match(/`([^`]+)`/)?.[1] ??
          finding.message.match(/(\w+)/)?.[1];

        if (key && !addedTypes.has(`env-missing-${key}`)) {
          addedTypes.add(`env-missing-${key}`);
          actions.push({
            id: `fix-env-missing-${key}-${Date.now()}`,
            description: `Add missing env var ${key} to ${finding.file}`,
            type: "safe",
            findingId: finding.id,
            preview: `Will append ${key}= to ${finding.file}`,
            apply: async () => {
              const envFilePath = path.join(rootDir, finding.file);
              let content = "";
              try {
                content = await fs.readFile(envFilePath, "utf-8");
              } catch {}
              const newContent = addMissingEnvVars(content, [key]);
              await fs.writeFile(envFilePath, newContent, "utf-8");
              return true;
            },
          });
        }
        break;
      }

      case "env-mismatch": {
        if (!addedTypes.has("env-example")) {
          addedTypes.add("env-example");
          actions.push({
            id: `fix-env-example-${Date.now()}`,
            description: "Generate .env.example with all required keys",
            type: "safe",
            findingId: finding.id,
            preview: "Will create .env.example with placeholder values",
            apply: async () => {
              const envFilePath = path.join(rootDir, ".env");
              let content = "";
              try {
                content = await fs.readFile(envFilePath, "utf-8");
              } catch {
                return false;
              }
              const parsed = parseEnvFile(content, envFilePath);
              const exampleContent = generateEnvExample(
                parsed,
                SECRET_RULES,
                config.entropyThreshold,
              );
              await fs.writeFile(
                path.join(rootDir, ".env.example"),
                exampleContent,
                "utf-8",
              );
              return true;
            },
          });
        }
        break;
      }

      case "secret-detected": {
        // Secrets can't be auto-fixed — provide guidance
        actions.push({
          id: `fix-secret-${finding.id}`,
          description: `Remove secret from ${finding.file}${finding.line ? `:${finding.line}` : ""}`,
          type: "destructive",
          findingId: finding.id,
          preview:
            finding.suggestion ??
            "Move secret to env var and add to .gitignore",
          apply: async () => {
            // We can't auto-remove secrets safely — this needs manual review
            // But we can offer to add the file to .gitignore
            console.log(
              colors.amberFlag.apply(
                "    " + glyphs.info + "  Please manually remove the secret from " + finding.file,
              ),
            );
            console.log(
              colors.slateDim.dim(
                "    Move the value to a .env file and reference it via an environment variable.",
              ),
            );
            return true;
          },
        });
        break;
      }

      case "framework-warning":
      case "env-exposed": {
        actions.push({
          id: `fix-exposed-${finding.id}`,
          description: `Review client-exposed secret in ${finding.file}`,
          type: "destructive",
          findingId: finding.id,
          preview:
            finding.suggestion ??
            "Ensure this env var should be exposed to the client bundle",
          apply: async () => {
            console.log(
              colors.amberFlag.apply(
                "    " + glyphs.info + "  Review " + finding.file + " \u2014 this value is exposed to the client.",
              ),
            );
            return true;
          },
        });
        break;
      }

      default:
        // No auto-fix available for this category
        break;
    }
  }

  return actions;
}
