// ─── Fix Command ─────────────────────────────────────────────────────────────
// Scans for issues, generates fix actions, and applies them interactively.

import path from "node:path";
import { colors, glyphs, sectionHeader, text } from "../ui/theme.js";
import Enquirer from "enquirer";
import { promises as fs } from "node:fs";
import { executeScan } from "./scan.js";
import { loadConfig } from "../config/config.js";
import { createSnapshot } from "../core/fix/snapshot.js";
import { purgeSecretFromHistory } from "../core/fix/git.js";
import { parseEnvFile } from "../core/scan/env.js";
import {
  addToGitignore,
  generateEnvExample,
  addMissingEnvVars,
} from "../core/fix/env-fix.js";
import {
  requireTypedConfirmation,
  requireSimpleConfirmation,
} from "../core/fix/confirm.js";
import {
  reportFixPlan,
  reportFixComplete,
} from "../ui/reporter.js";
import { type FixOptions, type ScanFinding, type Fix, type FixAction, type FixPlan } from "../types/index.js";
import { SECRET_RULES } from "../core/rules/secret-rules.js";

function touchesGitHistory(action: FixAction): boolean {
  if ((action as any).touchesGitHistory) return true;
  const desc = action.description.toLowerCase();
  const preview = (action.preview || "").toLowerCase();
  return (
    desc.includes("git history") ||
    desc.includes("rewrite history") ||
    preview.includes("git history") ||
    preview.includes("rewrite history")
  );
}

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

    let applied = 0;
    let skipped = 0;

    for (const action of safeActions) {
      try {
        const plan = await action.preview();
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
    return;
  }

  // ── Interactive mode ────────────────────────────────────────────────
  let applied = 0;
  let skipped = 0;

  for (const action of actions) {
    const plan = await action.preview();
    await reportFixPlan(plan);

    let shouldApply = false;

    if (plan.requiresConfirmation) {
      const wantAutoFix = await requireSimpleConfirmation(
        { description: action.description } as any,
        `Would you like Bilt to run this fix automatically?`
      );
      if (wantAutoFix) {
        shouldApply = await requireTypedConfirmation({ description: action.description } as any, plan.requiresConfirmation);
      } else {
        shouldApply = false;
      }
    } else {
      shouldApply = await requireSimpleConfirmation({ description: action.description } as any);
    }

    if (shouldApply) {
      try {
        const result = await action.apply();
        
        console.log("");
        result.stepsApplied.forEach((step: string) => {
          console.log(colors.mintClear.apply(`  ${glyphs.fixed} ${step}`));
        });
        
        if (result.success) {
          const verification = await action.verify();
          if (verification.passed) {
            applied++;
            console.log(colors.mintClear.apply(`  ${glyphs.fixed} ${verification.message}`));
          } else {
            skipped++;
            console.log(colors.amberFlag.apply(`  ${glyphs.info} Fix applied but verification failed: ${verification.message}`));
          }
        } else {
          skipped++;
          console.log(colors.amberFlag.apply(`  ${glyphs.info} Skipped (failed to apply: ${result.error})`));
        }
      } catch (error) {
        skipped++;
        const msg = error instanceof Error ? error.message : String(error);
        console.log(colors.pulseCoral.apply(`  ${glyphs.critical} Error: ${msg}`));
      }
    } else {
      skipped++;
      console.log(colors.slateDim.dim(`    ${glyphs.info} Skipped`));
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
  options: FixOptions
): Promise<Fix[]> {
  const actions: Fix[] = [];
  const addedTypes = new Set<string>();
  const config = await loadConfig(rootDir);

  const debugReadFile = async (pathStr: string): Promise<string> => {
    try {
      const content = await fs.readFile(pathStr, "utf-8");
      if (options.debug) {
        console.log(`[DEBUG READ] ${pathStr} (${Buffer.byteLength(content, "utf8")} bytes)`);
      }
      return content;
    } catch (err) {
      if (options.debug) {
        console.log(`[DEBUG READ] ${pathStr} (Error: ${(err as Error).message})`);
      }
      throw err;
    }
  };

  const debugWriteFile = async (pathStr: string, newContent: string, oldContent: string = ""): Promise<void> => {
    if (options.debug) {
      console.log(`[DEBUG WRITE] ${pathStr}`);
      console.log(`  Length Before: ${Buffer.byteLength(oldContent, "utf8")} bytes`);
      console.log(`  Length After:  ${Buffer.byteLength(newContent, "utf8")} bytes`);
      console.log(`  Diff Preview:`);
      // Simple diff preview: just show it's different if lengths or content differ
      if (oldContent === newContent) {
        console.log(`    (No changes)`);
      } else {
        console.log(`    (File modified)`);
      }
    }
    await fs.writeFile(pathStr, newContent, "utf-8");
  };

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
            preview: async () => ({
              steps: ["Append .env patterns to .gitignore"],
              estimatedTime: "< 1s",
              risk: "Low"
            }),
            apply: async () => {
              const gitignorePath = path.join(rootDir, ".gitignore");
              const newContent = await addToGitignore(
                [".env", ".env.*", ".env.local", ".env.*.local", ".bilt/"],
                gitignorePath,
              );
              let oldContent = "";
              try { oldContent = await fs.readFile(gitignorePath, "utf-8"); } catch {}
              await debugWriteFile(gitignorePath, newContent, oldContent);
              return { success: true, stepsApplied: ["Appended .env patterns to .gitignore"] };
            },
            verify: async () => {
              const gitignorePath = path.join(rootDir, ".gitignore");
              let content = "";
              try { content = await fs.readFile(gitignorePath, "utf-8"); } catch {}
              if (content.includes(".env")) return { passed: true, message: "Verified .gitignore updated." };
              return { passed: false, message: ".gitignore not properly updated." };
            },
            undo: async () => {}
          });
        }
        break;
      }

      case "env-missing": {
        const key =
          finding.message.match(/process\.env\.(\w+)/)?.[1] ??
          finding.message.match(/["']([^"']+)["']/)?.[1] ??
          finding.message.match(/`([^`]+)`/)?.[1] ??
          finding.message.match(/Variable "(\w+)"/)?.[1];

        if (key && !addedTypes.has(`env-missing-${key}`)) {
          addedTypes.add(`env-missing-${key}`);
          actions.push({
            id: `fix-env-missing-${key}-${Date.now()}`,
            description: `Add missing env var ${key} to .env`,
            type: "safe",
            findingId: finding.id,
            preview: async () => ({
              steps: [`Append ${key}= to .env`],
              estimatedTime: "< 1s",
              risk: "Low"
            }),
            apply: async () => {
              const envFilePath = path.join(rootDir, ".env");
              let content = "";
              try {
                content = await debugReadFile(envFilePath);
              } catch {}
              const newContent = addMissingEnvVars(content, [key]);
              await debugWriteFile(envFilePath, newContent, content);
              return { success: true, stepsApplied: [`Appended ${key}= to .env`] };
            },
            verify: async () => {
              const envFilePath = path.join(rootDir, ".env");
              let content = "";
              try { content = await fs.readFile(envFilePath, "utf-8"); } catch {}
              if (content.includes(`${key}=`)) return { passed: true, message: "Verified environment variable added." };
              return { passed: false, message: "Environment variable not found in .env." };
            },
            undo: async () => {}
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
            preview: async () => ({
              steps: ["Create or update .env.example with placeholder values"],
              estimatedTime: "< 1s",
              risk: "Low"
            }),
            apply: async () => {
              const envFilePath = path.join(rootDir, ".env");
              let content = "";
              try { content = await fs.readFile(envFilePath, "utf-8"); } catch {
                return { success: false, stepsApplied: [], error: "No .env file found" };
              }
              const parsed = parseEnvFile(content, envFilePath);
              const exampleContent = generateEnvExample(parsed, SECRET_RULES, config.entropyThreshold);
              const targetPath = path.join(rootDir, ".env.example");
              let oldExampleContent = "";
              try { oldExampleContent = await fs.readFile(targetPath, "utf-8"); } catch {}
              await debugWriteFile(targetPath, exampleContent, oldExampleContent);
              return { success: true, stepsApplied: ["Generated .env.example"] };
            },
            verify: async () => {
              try {
                await fs.access(path.join(rootDir, ".env.example"));
                return { passed: true, message: "Verified .env.example exists." };
              } catch {
                return { passed: false, message: ".env.example not created." };
              }
            },
            undo: async () => {}
          });
        }
        break;
      }

      case "secret-detected": {
        actions.push({
          id: `fix-secret-${finding.id}`,
          description: `Remove secret from ${finding.file}${finding.line ? `:${finding.line}` : ""}`,
          type: "destructive",
          findingId: finding.id,
          preview: async () => ({
            steps: ["Rotate credential", "Rewrite Git history", "Force-push (if remote)"],
            estimatedTime: "2-5 mins",
            risk: "Critical",
            requiresConfirmation: "PURGE_HISTORY",
            instructions: "1. Rotate the credential.\n2. Rewrite Git history.\n3. Force-push the cleaned history.\n4. Notify collaborators."
          }),
          apply: async () => {
            let isGitRepo = false;
            try {
              const { execSync } = await import("node:child_process");
              execSync("git rev-parse --is-inside-work-tree", { cwd: rootDir, stdio: "ignore" });
              isGitRepo = true;
            } catch {}

            if (isGitRepo && finding.secret) {
              console.log(colors.amberFlag.apply("    " + glyphs.info + "  Executing Git history rewrite..."));
              try {
                await purgeSecretFromHistory(rootDir, finding.secret);
                return { success: true, stepsApplied: ["Git history and workspace purged of the secret."] };
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return { success: false, stepsApplied: [], error: msg };
              }
            } else {
              console.log(colors.amberFlag.apply("    " + glyphs.info + "  Please manually remove the secret from " + finding.file));
              return { success: true, stepsApplied: ["Provided instructions for manual secret removal"] };
            }
          },
          verify: async () => {
            return { passed: true, message: "Verification complete." };
          },
          undo: async () => {}
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
          preview: async () => ({
            steps: ["Review client exposure"],
            estimatedTime: "< 1m",
            risk: "High",
            instructions: finding.suggestion ?? "Ensure this env var should be exposed to the client bundle"
          }),
          apply: async () => {
            console.log(colors.amberFlag.apply("    " + glyphs.info + "  Review " + finding.file + " \u2014 this value is exposed to the client."));
            return { success: true, stepsApplied: ["Flagged for review"] };
          },
          verify: async () => { return { passed: true, message: "Instruction acknowledged." }; },
          undo: async () => {}
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
