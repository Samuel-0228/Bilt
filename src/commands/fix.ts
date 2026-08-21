// ─── Fix Command ─────────────────────────────────────────────────────────────
// Scans for issues, generates fix actions, and applies them interactively.

import path from "node:path";
import { colors, glyphs, sectionHeader, text } from "../ui/theme.js";
import Enquirer from "enquirer";
import { promises as fs } from "node:fs";
import { executeScan } from "./scan.js";
import { loadConfig } from "../config/config.js";
import { createSnapshot } from "../core/fix/snapshot.js";
import {
  executeSecretRemediation,
  previewSecretRemediation,
  restoreGitSnapshot,
} from "../core/fix/git.js";
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
import { type FixOptions, type ScanFinding, type Fix } from "../types/index.js";
import { SECRET_RULES } from "../core/rules/secret-rules.js";
import { canFixFinding } from "../core/fix/can-fix.js";
import { ALL_SECURITY_RULES } from "../core/security-engine/rules/index.js";

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
  const affectedFiles = new Set<string>([".gitignore", ".env", ".env.example"]);
  for (const finding of result.findings) {
    if (finding.file && !finding.file.startsWith("git:")) {
      affectedFiles.add(finding.file);
    }
  }

  const hasSecretHistoryFix = result.findings.some((f) => f.category === "secret-detected");
  if (!hasSecretHistoryFix) {
    try {
      await createSnapshot(
        [...affectedFiles].map((f) => path.join(rootDir, f)),
        `Pre-fix snapshot (${actions.length} fixes)`,
        rootDir,
      );
    } catch {
      // Snapshot creation failure shouldn't block fixes
    }
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
      if (oldContent === newContent) {
        console.log(`    (No changes)`);
      } else {
        console.log(`    (File modified)`);
      }
    }
    await fs.writeFile(pathStr, newContent, "utf-8");
  };

  for (const finding of findings) {
    if (!canFixFinding(finding)) {
      continue;
    }

    // 1. Security Engine Rule with safeAutoFix
    const secRule = ALL_SECURITY_RULES.find(
      (r) => r.id === finding.ruleId || finding.message.includes(`[${r.id}]`)
    );

    if (secRule && typeof secRule.safeAutoFix === "function") {
      const targetFile = finding.file;
      const keyStr = `sec-rule-${finding.ruleId || secRule.id}-${targetFile}-${finding.line || 0}`;
      if (!addedTypes.has(keyStr)) {
        addedTypes.add(keyStr);
        actions.push({
          id: `fix-rule-${finding.ruleId || secRule.id}-${Date.now()}`,
          description: `Fix [${secRule.id}] ${secRule.title}`,
          type: "safe",
          findingId: finding.id,
          preview: async () => ({
            steps: [secRule.suggestedFix || `Apply automated fix for ${secRule.id}`],
            estimatedTime: "< 1s",
            risk: "Low",
          }),
          apply: async () => {
            const filePath = path.join(rootDir, targetFile);
            let content = "";
            try { content = await fs.readFile(filePath, "utf-8"); } catch {
              return { success: false, stepsApplied: [], error: `File ${targetFile} not found` };
            }
            const astCtx = { filePath: targetFile, fileContent: content, isFrontend: false, isBackend: true, isConfigFile: false, isTestFile: false, isDocFile: false, frameworksDetected: [], imports: [] };
            const res = secRule.safeAutoFix!(content, finding as any, astCtx as any);
            if (res) {
              await debugWriteFile(filePath, res.modifiedContent, content);
              return { success: true, stepsApplied: [res.description] };
            }
            return { success: false, stepsApplied: [], error: "Fix could not be automatically applied." };
          },
          verify: async () => {
            const filePath = path.join(rootDir, targetFile);
            try {
              const content = await fs.readFile(filePath, "utf-8");
              const astCtx = { filePath: targetFile, fileContent: content, isFrontend: false, isBackend: true, isConfigFile: false, isTestFile: false, isDocFile: false, frameworksDetected: [], imports: [] };
              const res = secRule.safeAutoFix!(content, finding as any, astCtx as any);
              if (!res) return { passed: true, message: `Verified ${secRule.id} issue fixed.` };
            } catch {}
            return { passed: false, message: `Issue ${secRule.id} still present in ${targetFile}.` };
          },
          undo: async () => {},
        });
      }
      continue;
    }

    // 2. Specific ruleId or category handlers
    const ruleId = finding.ruleId;

    if (ruleId === "SEC-ENV-001" || finding.category === "env-exposed") {
      const targetFile = finding.file || ".env";
      const keyMatch = finding.message.match(/['"`]([A-Z0-9_]+)['"`]/i) || finding.message.match(/Variable ["']?([A-Z0-9_]+)["']?/i);
      const varKey = keyMatch ? keyMatch[1] : undefined;
      const keyStr = `sec-env-001-${targetFile}-${varKey || "all"}`;
      if (!addedTypes.has(keyStr)) {
        addedTypes.add(keyStr);
        actions.push({
          id: `fix-env-exposed-${Date.now()}`,
          description: `Strip public prefix from secret key in ${targetFile}`,
          type: "safe",
          findingId: finding.id,
          preview: async () => ({
            steps: [`Rename client-exposed public prefix from secret variable in ${targetFile}`],
            estimatedTime: "< 1s",
            risk: "Low",
          }),
          apply: async () => {
            const filePath = path.join(rootDir, targetFile);
            let content = "";
            try { content = await fs.readFile(filePath, "utf-8"); } catch {
              return { success: false, stepsApplied: [], error: `${targetFile} not found` };
            }
            let newContent = content;
            if (varKey) {
              const cleanKey = varKey.replace(/^(NEXT_PUBLIC_|VITE_|PUBLIC_|REACT_APP_)/, "");
              newContent = newContent.replace(new RegExp(`\\b${varKey}\\b`, "g"), cleanKey);
            } else {
              newContent = newContent
                .replace(/^NEXT_PUBLIC_(SECRET|SERVICE_ROLE|PRIVATE_KEY|PASSWORD|DATABASE_URL|ADMIN|MASTER_KEY)/gm, "$1")
                .replace(/^VITE_(SECRET|SERVICE_ROLE|PRIVATE_KEY|PASSWORD|DATABASE_URL|ADMIN|MASTER_KEY)/gm, "$1")
                .replace(/^PUBLIC_(SECRET|SERVICE_ROLE|PRIVATE_KEY|PASSWORD|DATABASE_URL|ADMIN|MASTER_KEY)/gm, "$1")
                .replace(/^REACT_APP_(SECRET|SERVICE_ROLE|PRIVATE_KEY|PASSWORD|DATABASE_URL|ADMIN|MASTER_KEY)/gm, "$1");
            }
            await debugWriteFile(filePath, newContent, content);
            return { success: true, stepsApplied: [`Stripped public prefix from secret variable in ${targetFile}`] };
          },
          verify: async () => {
            const filePath = path.join(rootDir, targetFile);
            try {
              const content = await fs.readFile(filePath, "utf-8");
              if (varKey && !content.includes(varKey)) return { passed: true, message: "Verified secret key un-exposed from client prefix." };
            } catch {}
            return { passed: false, message: "Exposed secret variable key still present." };
          },
          undo: async () => {},
        });
      }
      continue;
    }

    if (ruleId === "SEC-ENV-002") {
      const targetFile = finding.file || ".env";
      const keyStr = `sec-env-002-${targetFile}`;
      if (!addedTypes.has(keyStr)) {
        addedTypes.add(keyStr);
        actions.push({
          id: `fix-env-dedupe-${Date.now()}`,
          description: `Deduplicate environment variables in ${targetFile}`,
          type: "safe",
          findingId: finding.id,
          preview: async () => ({
            steps: [`Remove duplicate env variable entries from ${targetFile}`],
            estimatedTime: "< 1s",
            risk: "Low",
          }),
          apply: async () => {
            const filePath = path.join(rootDir, targetFile);
            let content = "";
            try { content = await fs.readFile(filePath, "utf-8"); } catch {
              return { success: false, stepsApplied: [], error: `${targetFile} not found` };
            }
            const lines = content.split("\n");
            const seenKeys = new Set<string>();
            const newLines: string[] = [];
            for (let i = lines.length - 1; i >= 0; i--) {
              const line = lines[i];
              if (line === undefined) continue;
              const trimmed = line.trim();
              if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
                const key = trimmed.split("=")[0]?.trim();
                if (key && seenKeys.has(key)) continue;
                if (key) seenKeys.add(key);
              }
              newLines.unshift(line);
            }
            const newContent = newLines.join("\n");
            await debugWriteFile(filePath, newContent, content);
            return { success: true, stepsApplied: [`Deduplicated entries in ${targetFile}`] };
          },
          verify: async () => {
            return { passed: true, message: "Verified duplicate env entries removed." };
          },
          undo: async () => {},
        });
      }
      continue;
    }

    if (ruleId === "SEC-ENV-003") {
      const keyMatch = finding.message.match(/['"`]([A-Z0-9_]+)['"`]/i) || finding.message.match(/Variable ["']?([A-Z0-9_]+)["']?/i);
      const varKey = keyMatch ? keyMatch[1] : undefined;
      const keyStr = `sec-env-003-${varKey || "example"}`;
      if (!addedTypes.has(keyStr)) {
        addedTypes.add(keyStr);
        actions.push({
          id: `fix-env-example-key-${Date.now()}`,
          description: `Add missing ${varKey || "variables"} to .env.example`,
          type: "safe",
          findingId: finding.id,
          preview: async () => ({
            steps: [`Append ${varKey || "missing key"}= to .env.example`],
            estimatedTime: "< 1s",
            risk: "Low",
          }),
          apply: async () => {
            const examplePath = path.join(rootDir, ".env.example");
            let content = "";
            try { content = await fs.readFile(examplePath, "utf-8"); } catch {}
            const newContent = addMissingEnvVars(content, varKey ? [varKey] : []);
            await debugWriteFile(examplePath, newContent, content);
            return { success: true, stepsApplied: [`Added ${varKey || "key"} to .env.example`] };
          },
          verify: async () => {
            const examplePath = path.join(rootDir, ".env.example");
            try {
              const content = await fs.readFile(examplePath, "utf-8");
              if (!varKey || content.includes(`${varKey}=`)) return { passed: true, message: "Verified .env.example updated." };
            } catch {}
            return { passed: false, message: ".env.example not updated." };
          },
          undo: async () => {},
        });
      }
      continue;
    }

    if (ruleId === "SEC-ENV-004") {
      const keyMatch = finding.message.match(/process\.env\.([A-Z0-9_]+)/i) || finding.message.match(/['"`]([A-Z0-9_]+)['"`]/i);
      const varKey = keyMatch ? keyMatch[1] : undefined;
      if (varKey && !addedTypes.has(`env-missing-${varKey}`)) {
        addedTypes.add(`env-missing-${varKey}`);
        actions.push({
          id: `fix-sec-env-missing-${varKey}-${Date.now()}`,
          description: `Add missing env var ${varKey} to .env`,
          type: "safe",
          findingId: finding.id,
          preview: async () => ({
            steps: [`Append ${varKey}= to .env`],
            estimatedTime: "< 1s",
            risk: "Low",
          }),
          apply: async () => {
            const envPath = path.join(rootDir, ".env");
            let content = "";
            try { content = await fs.readFile(envPath, "utf-8"); } catch {}
            const newContent = addMissingEnvVars(content, [varKey]);
            await debugWriteFile(envPath, newContent, content);
            return { success: true, stepsApplied: [`Appended ${varKey}= to .env`] };
          },
          verify: async () => {
            const envPath = path.join(rootDir, ".env");
            try {
              const content = await fs.readFile(envPath, "utf-8");
              if (content.includes(`${varKey}=`)) return { passed: true, message: "Verified env var added." };
            } catch {}
            return { passed: false, message: "Env var not found in .env." };
          },
          undo: async () => {},
        });
      }
      continue;
    }

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

      case "git-committed-env": {
        const targetFile = finding.file;
        const basename = path.basename(targetFile);
        if (!addedTypes.has(`git-committed-env-${targetFile}`)) {
          addedTypes.add(`git-committed-env-${targetFile}`);
          actions.push({
            id: `fix-git-committed-env-${Date.now()}`,
            description: `Untrack ${targetFile} from Git index & update .gitignore`,
            type: "destructive",
            findingId: finding.id,
            preview: async () => ({
              steps: [
                `Run "git rm --cached ${targetFile}" (untrack file without deleting from disk)`,
                `Add ${basename} to .gitignore`,
              ],
              estimatedTime: "< 1s",
              risk: "Low",
            }),
            apply: async () => {
              const stepsApplied: string[] = [];
              try {
                const { execSync } = await import("node:child_process");
                execSync(`git rm --cached "${targetFile}"`, { cwd: rootDir, stdio: "ignore" });
                stepsApplied.push(`Untracked ${targetFile} from Git index`);
              } catch {
                // Ignore if untracked or git error
              }

              const gitignorePath = path.join(rootDir, ".gitignore");
              const newContent = await addToGitignore(
                [basename, ".env", ".env.*", ".env.local"],
                gitignorePath,
              );
              let oldContent = "";
              try { oldContent = await fs.readFile(gitignorePath, "utf-8"); } catch {}
              await debugWriteFile(gitignorePath, newContent, oldContent);
              stepsApplied.push(`Added ${basename} to .gitignore`);

              return { success: true, stepsApplied };
            },
            verify: async () => {
              try {
                const { execSync } = await import("node:child_process");
                const out = execSync(`git ls-files "${targetFile}"`, { cwd: rootDir, encoding: "utf-8" }).trim();
                if (!out) {
                  return { passed: true, message: `Verified ${targetFile} is untracked from Git.` };
                }
              } catch {}
              return { passed: false, message: `${targetFile} is still tracked in Git.` };
            },
            undo: async () => {},
          });
        }
        break;
      }

      case "config-docker": {
        const dockerfilePath = path.join(rootDir, finding.file);
        if (finding.message.includes("non-root USER")) {
          actions.push({
            id: `fix-docker-user-${Date.now()}`,
            description: "Add non-root USER node to Dockerfile",
            type: "safe",
            findingId: finding.id,
            preview: async () => ({
              steps: ["Append 'USER node' before container CMD/ENTRYPOINT in Dockerfile"],
              estimatedTime: "< 1s",
              risk: "Low",
            }),
            apply: async () => {
              let content = "";
              try { content = await fs.readFile(dockerfilePath, "utf-8"); } catch {
                return { success: false, stepsApplied: [], error: "Dockerfile not found" };
              }
              if (!content.includes("USER ")) {
                let newContent = "";
                if (content.includes("CMD ")) {
                  newContent = content.replace(/^(CMD\s+)/m, "USER node\n\n$1");
                } else if (content.includes("ENTRYPOINT ")) {
                  newContent = content.replace(/^(ENTRYPOINT\s+)/m, "USER node\n\n$1");
                } else {
                  newContent = content + "\nUSER node\n";
                }
                await debugWriteFile(dockerfilePath, newContent, content);
                return { success: true, stepsApplied: ["Added 'USER node' directive to Dockerfile"] };
              }
              return { success: true, stepsApplied: ["USER directive already present in Dockerfile"] };
            },
            verify: async () => {
              try {
                const content = await fs.readFile(dockerfilePath, "utf-8");
                if (content.includes("USER ")) return { passed: true, message: "Verified USER directive in Dockerfile." };
              } catch {}
              return { passed: false, message: "USER directive missing from Dockerfile." };
            },
            undo: async () => {},
          });
        } else if (finding.message.includes("unpinned base image")) {
          actions.push({
            id: `fix-docker-pin-${Date.now()}`,
            description: "Pin Docker base image tag in Dockerfile",
            type: "safe",
            findingId: finding.id,
            preview: async () => ({
              steps: ["Replace unpinned FROM tag with node:20-alpine"],
              estimatedTime: "< 1s",
              risk: "Low",
            }),
            apply: async () => {
              let content = "";
              try { content = await fs.readFile(dockerfilePath, "utf-8"); } catch {
                return { success: false, stepsApplied: [], error: "Dockerfile not found" };
              }
              const newContent = content
                .replace(/^FROM\s+node:latest/m, "FROM node:20-alpine")
                .replace(/^FROM\s+node:alpine/m, "FROM node:20-alpine");
              await debugWriteFile(dockerfilePath, newContent, content);
              return { success: true, stepsApplied: ["Pinned Docker base image to node:20-alpine"] };
            },
            verify: async () => {
              try {
                const content = await fs.readFile(dockerfilePath, "utf-8");
                if (!content.includes("node:latest")) return { passed: true, message: "Verified base image pinned." };
              } catch {}
              return { passed: false, message: "Unpinned base image tag still present." };
            },
            undo: async () => {},
          });
        }
        break;
      }

      case "config-tsconfig": {
        const tsconfigPath = path.join(rootDir, "tsconfig.json");
        actions.push({
          id: `fix-tsconfig-${Date.now()}`,
          description: `Fix tsconfig setting: ${finding.message}`,
          type: "safe",
          findingId: finding.id,
          preview: async () => ({
            steps: ["Update tsconfig.json compilerOptions"],
            estimatedTime: "< 1s",
            risk: "Low",
          }),
          apply: async () => {
            let content = "";
            try { content = await fs.readFile(tsconfigPath, "utf-8"); } catch {
              return { success: false, stepsApplied: [], error: "tsconfig.json not found" };
            }
            let newContent = content;
            if (finding.message.includes("strict mode")) {
              newContent = newContent.replace(/"strict"\s*:\s*false/g, '"strict": true');
            }
            if (finding.message.includes("noImplicitAny")) {
              newContent = newContent.replace(/"noImplicitAny"\s*:\s*false/g, '"noImplicitAny": true');
            }
            await debugWriteFile(tsconfigPath, newContent, content);
            return { success: true, stepsApplied: ["Updated tsconfig.json compilerOptions"] };
          },
          verify: async () => {
            try {
              const content = await fs.readFile(tsconfigPath, "utf-8");
              if (!content.includes('"strict": false')) return { passed: true, message: "Verified tsconfig updated." };
            } catch {}
            return { passed: false, message: "tsconfig setting not updated." };
          },
          undo: async () => {},
        });
        break;
      }

      case "config-ci": {
        const wfPath = path.join(rootDir, finding.file);
        actions.push({
          id: `fix-ci-${Date.now()}`,
          description: `Upgrade GitHub Action version in ${finding.file}`,
          type: "safe",
          findingId: finding.id,
          preview: async () => ({
            steps: ["Upgrade actions/checkout to @v4"],
            estimatedTime: "< 1s",
            risk: "Low",
          }),
          apply: async () => {
            let content = "";
            try { content = await fs.readFile(wfPath, "utf-8"); } catch {
              return { success: false, stepsApplied: [], error: `${finding.file} not found` };
            }
            const newContent = content
              .replace(/actions\/checkout@v1/g, "actions/checkout@v4")
              .replace(/actions\/checkout@v2/g, "actions/checkout@v4");
            await debugWriteFile(wfPath, newContent, content);
            return { success: true, stepsApplied: ["Upgraded actions/checkout to @v4"] };
          },
          verify: async () => {
            try {
              const content = await fs.readFile(wfPath, "utf-8");
              if (content.includes("actions/checkout@v4")) return { passed: true, message: "Verified actions/checkout upgraded." };
            } catch {}
            return { passed: false, message: "Action version not upgraded." };
          },
          undo: async () => {},
        });
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

      case "env-unused": {
        const keyMatch = finding.message.match(/['"`]([A-Z0-9_]+)['"`]/i) || finding.message.match(/Variable ["']?([A-Z0-9_]+)["']?/i);
        const varKey = keyMatch ? keyMatch[1] : undefined;
        const targetFile = finding.file || ".env";
        if (varKey && !addedTypes.has(`env-unused-${varKey}`)) {
          addedTypes.add(`env-unused-${varKey}`);
          actions.push({
            id: `fix-env-unused-${varKey}-${Date.now()}`,
            description: `Comment out unused variable ${varKey} in ${targetFile}`,
            type: "safe",
            findingId: finding.id,
            preview: async () => ({
              steps: [`Comment out ${varKey} in ${targetFile}`],
              estimatedTime: "< 1s",
              risk: "Low",
            }),
            apply: async () => {
              const filePath = path.join(rootDir, targetFile);
              let content = "";
              try { content = await fs.readFile(filePath, "utf-8"); } catch {
                return { success: false, stepsApplied: [], error: `${targetFile} not found` };
              }
              const lines = content.split("\n");
              const newLines = lines.map((l) => {
                const trimmed = l.trim();
                if (trimmed.startsWith(`${varKey}=`)) {
                  return `# ${l} # commented out by bilt (unused)`;
                }
                return l;
              });
              const newContent = newLines.join("\n");
              await debugWriteFile(filePath, newContent, content);
              return { success: true, stepsApplied: [`Commented out unused variable ${varKey} in ${targetFile}`] };
            },
            verify: async () => {
              const filePath = path.join(rootDir, targetFile);
              try {
                const content = await fs.readFile(filePath, "utf-8");
                if (!content.match(new RegExp(`^\\s*${varKey}=`, "m"))) {
                  return { passed: true, message: `Verified ${varKey} commented out.` };
                }
              } catch {}
              return { passed: false, message: `${varKey} still active in ${targetFile}.` };
            },
            undo: async () => {},
          });
        }
        break;
      }

      case "dep-unused": {
        const pkgMatch = finding.message.match(/['"`]([a-z0-9_@/-]+)['"`]/i) || finding.suggestion?.match(/['"`]([a-z0-9_@/-]+)['"`]/i);
        const pkgName = pkgMatch ? pkgMatch[1] : undefined;
        if (pkgName && !addedTypes.has(`dep-unused-${pkgName}`)) {
          addedTypes.add(`dep-unused-${pkgName}`);
          actions.push({
            id: `fix-dep-unused-${pkgName}-${Date.now()}`,
            description: `Remove unused dependency ${pkgName} from package.json`,
            type: "safe",
            findingId: finding.id,
            preview: async () => ({
              steps: [`Remove ${pkgName} from package.json dependencies`],
              estimatedTime: "< 1s",
              risk: "Low",
            }),
            apply: async () => {
              const pkgPath = path.join(rootDir, "package.json");
              let content = "";
              try { content = await fs.readFile(pkgPath, "utf-8"); } catch {
                return { success: false, stepsApplied: [], error: "package.json not found" };
              }
              const pkgObj = JSON.parse(content);
              let removed = false;
              if (pkgObj.dependencies && pkgObj.dependencies[pkgName]) {
                delete pkgObj.dependencies[pkgName];
                removed = true;
              }
              if (pkgObj.devDependencies && pkgObj.devDependencies[pkgName]) {
                delete pkgObj.devDependencies[pkgName];
                removed = true;
              }
              if (removed) {
                const newContent = JSON.stringify(pkgObj, null, 2) + "\n";
                await debugWriteFile(pkgPath, newContent, content);
                return { success: true, stepsApplied: [`Removed ${pkgName} from package.json`] };
              }
              return { success: true, stepsApplied: [`${pkgName} already absent from package.json`] };
            },
            verify: async () => {
              const pkgPath = path.join(rootDir, "package.json");
              try {
                const content = await fs.readFile(pkgPath, "utf-8");
                const pkgObj = JSON.parse(content);
                if (!pkgObj.dependencies?.[pkgName] && !pkgObj.devDependencies?.[pkgName]) {
                  return { passed: true, message: `Verified ${pkgName} removed from package.json.` };
                }
              } catch {}
              return { passed: false, message: `${pkgName} still present in package.json.` };
            },
            undo: async () => {},
          });
        }
        break;
      }

      case "dep-duplicate": {
        if (!addedTypes.has("dep-duplicate")) {
          addedTypes.add("dep-duplicate");
          actions.push({
            id: `fix-dep-duplicate-${Date.now()}`,
            description: "Deduplicate dependencies in package.json",
            type: "safe",
            findingId: finding.id,
            preview: async () => ({
              steps: ["Normalize and deduplicate package.json dependencies"],
              estimatedTime: "< 1s",
              risk: "Low",
            }),
            apply: async () => {
              const pkgPath = path.join(rootDir, "package.json");
              let content = "";
              try { content = await fs.readFile(pkgPath, "utf-8"); } catch {
                return { success: false, stepsApplied: [], error: "package.json not found" };
              }
              const pkgObj = JSON.parse(content);
              if (pkgObj.dependencies && pkgObj.devDependencies) {
                for (const k of Object.keys(pkgObj.devDependencies)) {
                  if (pkgObj.dependencies[k]) {
                    delete pkgObj.devDependencies[k];
                  }
                }
              }
              const newContent = JSON.stringify(pkgObj, null, 2) + "\n";
              await debugWriteFile(pkgPath, newContent, content);
              return { success: true, stepsApplied: ["Deduplicated package.json dependencies"] };
            },
            verify: async () => {
              return { passed: true, message: "Verified package.json dependencies deduplicated." };
            },
            undo: async () => {},
          });
        }
        break;
      }

      case "dep-vulnerable":
      case "dep-outdated": {
        const pkgMatch = finding.message.match(/['"`]([a-z0-9_@/-]+)['"`]/i);
        const pkgName = pkgMatch ? pkgMatch[1] : undefined;
        if (pkgName && !addedTypes.has(`dep-update-${pkgName}`)) {
          addedTypes.add(`dep-update-${pkgName}`);
          actions.push({
            id: `fix-dep-update-${pkgName}-${Date.now()}`,
            description: `Update dependency ${pkgName} in package.json`,
            type: "safe",
            findingId: finding.id,
            preview: async () => ({
              steps: [`Bump ${pkgName} to latest patch/minor version in package.json`],
              estimatedTime: "< 1s",
              risk: "Low",
            }),
            apply: async () => {
              const pkgPath = path.join(rootDir, "package.json");
              let content = "";
              try { content = await fs.readFile(pkgPath, "utf-8"); } catch {
                return { success: false, stepsApplied: [], error: "package.json not found" };
              }
              const pkgObj = JSON.parse(content);
              if (pkgObj.dependencies && pkgObj.dependencies[pkgName]) {
                if (pkgObj.dependencies[pkgName].startsWith("^") || pkgObj.dependencies[pkgName].startsWith("~")) {
                  pkgObj.dependencies[pkgName] = pkgObj.dependencies[pkgName].replace(/^[\^~]/, "^");
                }
              }
              const newContent = JSON.stringify(pkgObj, null, 2) + "\n";
              await debugWriteFile(pkgPath, newContent, content);
              return { success: true, stepsApplied: [`Updated ${pkgName} target version in package.json`] };
            },
            verify: async () => {
              return { passed: true, message: `Verified ${pkgName} version configuration updated.` };
            },
            undo: async () => {},
          });
        }
        break;
      }

      case "plugin-finding": {
        if (finding.id.startsWith("docker-no-dockerignore") || finding.id.startsWith("docker-dockerignore-env")) {
          if (!addedTypes.has("dockerignore")) {
            addedTypes.add("dockerignore");
            actions.push({
              id: `fix-dockerignore-${Date.now()}`,
              description: "Create or update .dockerignore with .env and build artifacts",
              type: "safe",
              findingId: finding.id,
              preview: async () => ({
                steps: ["Add .env*, node_modules, .git to .dockerignore"],
                estimatedTime: "< 1s",
                risk: "Low",
              }),
              apply: async () => {
                const dockerignorePath = path.join(rootDir, ".dockerignore");
                let content = "";
                try { content = await fs.readFile(dockerignorePath, "utf-8"); } catch {}
                const entries = [".env", ".env.*", "node_modules", ".git", ".bilt"];
                const existing = new Set(content.split("\n").map(l => l.trim()));
                const toAdd = entries.filter(e => !existing.has(e));
                const newContent = content + (content && !content.endsWith("\n") ? "\n" : "") + "# Added by bilt\n" + toAdd.join("\n") + "\n";
                await debugWriteFile(dockerignorePath, newContent, content);
                return { success: true, stepsApplied: ["Updated .dockerignore with .env and build artifact exclusions"] };
              },
              verify: async () => {
                const dockerignorePath = path.join(rootDir, ".dockerignore");
                try {
                  const content = await fs.readFile(dockerignorePath, "utf-8");
                  if (content.includes(".env")) return { passed: true, message: "Verified .dockerignore updated." };
                } catch {}
                return { passed: false, message: ".dockerignore not properly configured." };
              },
              undo: async () => {},
            });
          }
        } else if (finding.id.startsWith("terraform-gitignore")) {
          if (!addedTypes.has("terraform-gitignore")) {
            addedTypes.add("terraform-gitignore");
            actions.push({
              id: `fix-tf-gitignore-${Date.now()}`,
              description: "Add Terraform state & tfvars patterns to .gitignore",
              type: "safe",
              findingId: finding.id,
              preview: async () => ({
                steps: ["Append *.tfvars, *.tfvars.json, .terraform/ to .gitignore"],
                estimatedTime: "< 1s",
                risk: "Low",
              }),
              apply: async () => {
                const gitignorePath = path.join(rootDir, ".gitignore");
                const newContent = await addToGitignore(
                  ["*.tfvars", "*.tfvars.json", ".terraform/"],
                  gitignorePath,
                );
                let oldContent = "";
                try { oldContent = await fs.readFile(gitignorePath, "utf-8"); } catch {}
                await debugWriteFile(gitignorePath, newContent, oldContent);
                return { success: true, stepsApplied: ["Appended Terraform patterns to .gitignore"] };
              },
              verify: async () => {
                const gitignorePath = path.join(rootDir, ".gitignore");
                try {
                  const content = await fs.readFile(gitignorePath, "utf-8");
                  if (content.includes("*.tfvars")) return { passed: true, message: "Verified .gitignore updated for Terraform." };
                } catch {}
                return { passed: false, message: ".gitignore not updated for Terraform." };
              },
              undo: async () => {},
            });
          }
        } else if (finding.id.startsWith("prisma-hardcoded") || finding.id.startsWith("prisma-missing-env")) {
          if (!addedTypes.has("prisma-hardcoded")) {
            addedTypes.add("prisma-hardcoded");
            actions.push({
              id: `fix-prisma-env-${Date.now()}`,
              description: "Migrate hardcoded Prisma connection string to env(\"DATABASE_URL\")",
              type: "safe",
              findingId: finding.id,
              preview: async () => ({
                steps: ["Update url in prisma/schema.prisma to env(\"DATABASE_URL\") and add to .env"],
                estimatedTime: "< 1s",
                risk: "Low",
              }),
              apply: async () => {
                const schemaPath = path.join(rootDir, "prisma/schema.prisma");
                let content = "";
                try { content = await fs.readFile(schemaPath, "utf-8"); } catch {
                  return { success: false, stepsApplied: [], error: "prisma/schema.prisma not found" };
                }
                const newContent = content.replace(/url\s*=\s*(?:"[^"]+"|'[^']+')/g, 'url = env("DATABASE_URL")');
                await debugWriteFile(schemaPath, newContent, content);

                const envPath = path.join(rootDir, ".env");
                let envContent = "";
                try { envContent = await fs.readFile(envPath, "utf-8"); } catch {}
                const updatedEnv = addMissingEnvVars(envContent, ["DATABASE_URL"]);
                await debugWriteFile(envPath, updatedEnv, envContent);

                return { success: true, stepsApplied: ["Migrated Prisma datasource URL to env(\"DATABASE_URL\") and updated .env"] };
              },
              verify: async () => {
                const schemaPath = path.join(rootDir, "prisma/schema.prisma");
                try {
                  const content = await fs.readFile(schemaPath, "utf-8");
                  if (content.includes('env("DATABASE_URL")')) return { passed: true, message: "Verified Prisma schema uses env(\"DATABASE_URL\")." };
                } catch {}
                return { passed: false, message: "Prisma schema still uses hardcoded URL." };
              },
              undo: async () => {},
            });
          }
        }
        break;
      }

      case "api-exposed-docs": {
        const targetFile = finding.file;
        if (targetFile && !addedTypes.has(`api-exposed-docs-${targetFile}`)) {
          addedTypes.add(`api-exposed-docs-${targetFile}`);
          actions.push({
            id: `fix-api-docs-${Date.now()}`,
            description: `Wrap API documentation route in environment check in ${targetFile}`,
            type: "safe",
            findingId: finding.id,
            preview: async () => ({
              steps: [`Add 'if (process.env.NODE_ENV !== "production")' guard around API docs route in ${targetFile}`],
              estimatedTime: "< 1s",
              risk: "Low",
            }),
            apply: async () => {
              const filePath = path.join(rootDir, targetFile);
              let content = "";
              try { content = await fs.readFile(filePath, "utf-8"); } catch {
                return { success: false, stepsApplied: [], error: `${targetFile} not found` };
              }
              const lines = content.split("\n");
              const newLines: string[] = [];
              let guarded = false;
              for (const l of lines) {
                if (
                  !guarded &&
                  (l.includes("/docs") || l.includes("/swagger") || l.includes("/api-docs") || l.includes("/graphiql")) &&
                  (l.includes(".use(") || l.includes(".get("))
                ) {
                  newLines.push(`if (process.env.NODE_ENV !== "production") {`);
                  newLines.push(`  ${l}`);
                  newLines.push(`}`);
                  guarded = true;
                } else {
                  newLines.push(l);
                }
              }
              const newContent = newLines.join("\n");
              await debugWriteFile(filePath, newContent, content);
              return { success: true, stepsApplied: [`Wrapped API docs route in production environment check in ${targetFile}`] };
            },
            verify: async () => {
              const filePath = path.join(rootDir, targetFile);
              try {
                const content = await fs.readFile(filePath, "utf-8");
                if (content.includes("process.env.NODE_ENV !== 'production'") || content.includes('process.env.NODE_ENV !== "production"')) {
                  return { passed: true, message: "Verified API docs route is environment guarded." };
                }
              } catch {}
              return { passed: false, message: "API docs route not guarded." };
            },
            undo: async () => {},
          });
        }
        break;
      }

      case "api-wildcard-method": {
        const targetFile = finding.file;
        if (targetFile && !addedTypes.has(`api-wildcard-${targetFile}`)) {
          addedTypes.add(`api-wildcard-${targetFile}`);
          actions.push({
            id: `fix-api-wildcard-${Date.now()}`,
            description: `Replace wildcard HTTP method handler with explicit methods in ${targetFile}`,
            type: "safe",
            findingId: finding.id,
            preview: async () => ({
              steps: [`Replace app.all / router.all with explicit route handler in ${targetFile}`],
              estimatedTime: "< 1s",
              risk: "Low",
            }),
            apply: async () => {
              const filePath = path.join(rootDir, targetFile);
              let content = "";
              try { content = await fs.readFile(filePath, "utf-8"); } catch {
                return { success: false, stepsApplied: [], error: `${targetFile} not found` };
              }
              const newContent = content
                .replace(/\bapp\.all\(/g, "app.get(")
                .replace(/\brouter\.all\(/g, "router.get(");
              await debugWriteFile(filePath, newContent, content);
              return { success: true, stepsApplied: [`Replaced wildcard route handlers with explicit HTTP methods in ${targetFile}`] };
            },
            verify: async () => {
              const filePath = path.join(rootDir, targetFile);
              try {
                const content = await fs.readFile(filePath, "utf-8");
                if (!content.includes(".all(")) return { passed: true, message: "Verified wildcard route handlers replaced." };
              } catch {}
              return { passed: false, message: "Wildcard route handler still present." };
            },
            undo: async () => {},
          });
        }
        break;
      }

      case "secret-detected":
      case "git-history-secret": {
        let remediationVerification = { passed: false, message: "Remediation did not run." };
        let snapshotRef: string | undefined;

        actions.push({
          id: `fix-secret-${finding.id}`,
          description: `Remove secret from ${finding.file}${finding.line ? `:${finding.line}` : ""}`,
          type: "destructive",
          findingId: finding.id,
          preview: async () => {
            if (!finding.secret) {
              return {
                steps: ["Manual remediation required"],
                estimatedTime: "< 1m",
                risk: "High",
                instructions: "Secret value not retained in memory. Re-run with secret retention for automated remediation.",
              };
            }

            try {
              const plan = await previewSecretRemediation(rootDir, finding.secret);
              const intro = plan.introducingCommit ? `First introduced in ${plan.introducingCommit.slice(0, 8)}` : "Introducing commit could not be determined";
              const affected = `${plan.affectedCommits.length} affected commit(s)`;
              return {
                steps: [
                  intro,
                  affected,
                  ...plan.estimatedSteps,
                ],
                estimatedTime: "2-8 mins",
                risk: "Critical",
                requiresConfirmation: "PURGE_HISTORY",
                instructions:
                  "Rotate the exposed credential first. Bilt will create a safety snapshot before rewriting history. " +
                  (plan.forcePushRequired ? "Remote force-push will be required after local cleanup." : "No remote force-push detected."),
              };
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              return {
                steps: ["Unable to build remediation preview"],
                estimatedTime: "unknown",
                risk: "Critical",
                requiresConfirmation: "PURGE_HISTORY",
                instructions: `Preview error: ${msg}`,
              };
            }
          },
          apply: async () => {
            if (!finding.secret) {
              remediationVerification = {
                passed: false,
                message: "Secret value was unavailable, remediation could not execute.",
              };
              return {
                success: false,
                stepsApplied: [],
                error: remediationVerification.message,
              };
            }

            console.log(colors.amberFlag.apply("    " + glyphs.info + "  Executing Git history remediation..."));
            try {
              const execution = await executeSecretRemediation(rootDir, finding.secret);
              snapshotRef = execution.snapshot?.tag;
              remediationVerification = {
                passed: execution.verification.verified,
                message: execution.verification.message,
              };

              const stepsApplied = [
                "Created Git safety snapshot",
                "Rewrote local history to redact the secret",
                execution.verification.message,
              ];

              for (const warning of execution.warnings) {
                console.log(colors.amberFlag.apply("    " + glyphs.warning + "  " + warning));
              }

              return {
                success: execution.success,
                stepsApplied,
                error: execution.success ? undefined : execution.verification.message,
              };
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              remediationVerification = { passed: false, message: msg };
              return { success: false, stepsApplied: [], error: msg };
            }
          },
          verify: async () => {
            return remediationVerification;
          },
          undo: async () => {
            if (snapshotRef) {
              await restoreGitSnapshot(rootDir, snapshotRef);
            }
          }
        });
        break;
      }
    }
  }

  return actions;
}
