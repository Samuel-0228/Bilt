import path from "node:path";
import { promises as fs } from "node:fs";

export interface InitAgentOptions {
  agent?: string;
  dryRun?: boolean;
  force?: boolean;
}

export interface FileChangePreview {
  filePath: string;
  relative: string;
  status: "create" | "skip" | "overwrite";
  diff: string;
}

export interface InitAgentResult {
  files: FileChangePreview[];
}

function generateSimpleDiff(
  oldContent: string | null,
  newContent: string,
  relPath: string,
): string {
  const lines: string[] = [];
  if (oldContent === null) {
    lines.push(`--- /dev/null`);
    lines.push(`+++ b/${relPath}`);
    for (const line of newContent.split("\n")) {
      lines.push(`+ ${line}`);
    }
  } else {
    lines.push(`--- a/${relPath}`);
    lines.push(`+++ b/${relPath}`);
    const oldLines = oldContent.split("\n");
    const newLines = newContent.split("\n");
    for (const line of oldLines) {
      lines.push(`- ${line}`);
    }
    for (const line of newLines) {
      lines.push(`+ ${line}`);
    }
  }
  return lines.join("\n");
}

export async function executeInitAgent(
  projectDir: string = process.cwd(),
  options: InitAgentOptions = {},
): Promise<InitAgentResult> {
  const rootDir = path.resolve(projectDir);
  const agent = (options.agent || "default").toLowerCase();
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;

  const results: FileChangePreview[] = [];

  // 1. Determine agent markdown file (AGENTS.md and/or CLAUDE.md)
  const agentTargetFilename = agent === "claude" ? "CLAUDE.md" : "AGENTS.md";
  const agentDocPath = path.join(rootDir, agentTargetFilename);

  const agentDocContent = [
    `# Agent Verification & Production Readiness Guidelines`,
    ``,
    `You are working on a project protected by Bilt production-readiness gates.`,
    ``,
    `Before declaring any task complete, producing git commits, or submitting PRs:`,
    `1. Run Bilt production-readiness checks:`,
    `   \`\`\`bash`,
    `   bilt scan --format agent --changed`,
    `   npx bilt check --format agent`,
    `   \`\`\``,
    `   (Or for working tree changes: \`npx bilt check --format agent --changed\`)`,
    ``,
    `2. Review every HIGH and CRITICAL finding.`,
    `3. Complete every required guided procedure with real, verifiable evidence.`,
    `4. Never fabricate evidence or duplicate evidence locations across distinct routes.`,
    `5. Never weaken or disable a Bilt rule or tamper with configuration to obtain PASS.`,
    `6. Fix issues introduced by your changes.`,
    `7. Run Bilt again after fixes to verify resolution.`,
    `8. If a finding requires human judgment or risk acceptance, stop and escalate it clearly.`,
    `9. Never output, print, or log raw credentials or secrets.`,
    ``,
    `## AUTONOMOUS REMEDIATION PROTOCOL (DO NOT MERELY REPORT AND HALT)`,
    ``,
    `CRITICAL INSTRUCTION FOR CODING AGENTS:`,
    `Do NOT merely print a summary of findings and stop. A result of NOT READY or NEEDS REVIEW is a call to action.`,
    `When Bilt reports findings, you MUST execute the following remediation loop:`,
    ``,
    `1. Auto-Fix Immediate Issues:`,
    `   Before manual changes, immediately run:`,
    `   \`\`\`bash`,
    `   npx bilt design-check --fix`,
    `   npx bilt fix --safe`,
    `   \`\`\``,
    `   This automatically repairs focus rings (outline-none), missing aria-label, missing alt attributes, and .env drift.`,
    ``,
    `2. Handle Pre-Existing Codebase Debt (Baselining):`,
    `   If you were asked to onboard Bilt to an existing codebase and findings belong to pre-existing architecture (e.g. database backup strategy, Sentry monitoring, PII policies):`,
    `   \`\`\`bash`,
    `   npx bilt baseline create`,
    `   \`\`\``,
    `   This captures existing debt into .bilt/baseline.json so you and future agents focus solely on diffs introduced by current tasks (introduced_by_change: true).`,
    ``,
    `3. Follow the Design Brief for UI Changes:`,
    `   If design quality issues are flagged (design-genericity, uniform card grids, typography):`,
    `   - Check \`npx bilt design-brief --format agent\`.`,
    `   - If configured: false, PAUSE and ask the developer the 4 Design Intent questions.`,
    `   - Refactor repetitive generic AI tropes into intentional, distinctive UI.`,
    `   - Run \`npx bilt design-check\` until clean.`,
    ``,
    `4. Investigate Guided Requirements:`,
    `   For architectural findings (authorization, error monitoring, database recovery):`,
    `   - Run \`npx bilt explain <category>\` (e.g. \`npx bilt explain monitoring-rollback\`) for implementation guides and code snippets.`,
    `   - Implement the required pattern, or if the user intentionally defers it, guide the user to run \`npx bilt accept-risk <ruleId> --reason "..." --owner "..."\`.`,
    ``,
    `5. Re-Verify Before Declaring Completion:`,
    `   Always re-run:`,
    `   \`\`\`bash`,
    `   npx bilt check --format agent`,
    `   \`\`\``,
    `   Do not declare the task complete until the status reaches production-ready (exit code 0) or all remaining issues have been addressed with the user.`,
    ``,
    `## DESIGN QUALITY REQUIREMENT`,
    ``,
    `Do not default to recognizable AI-generated website patterns.`,
    ``,
    `Before implementing UI:`,
    `1. inspect the existing product`,
    `2. identify the product's actual domain and users`,
    `3. use real product behavior/data as visual inspiration`,
    `4. avoid stacking generic SaaS patterns`,
    `5. avoid decorative elements without purpose`,
    `6. make loading, empty, error, success, and disabled states intentional`,
    `7. preserve accessibility`,
    `8. run \`bilt design-check\``,
    `9. address design findings`,
    `10. rerun Bilt before declaring the task complete`,
    ``,
    `Do not remove or weaken Bilt rules simply to obtain a passing result.`,
    ``,
    `## DESIGN BRIEF & MANDATORY HUMAN-INTENT CHECKPOINT`,
    ``,
    `Bilt uses a Design Brief (\`.bilt/design-brief.json\`) to capture authentic human design intent before UI implementation.`,
    ``,
    `1. Explicit Human-in-the-Loop Checkpoint: The design brief represents authentic human intent. NEVER guess, infer from files, or autonomously synthesize fake design choices to create \`.bilt/design-brief.json\`.`,
    `2. MANDATORY CHECKPOINT WHEN UNCONFIGURED (\`configured: false\`):`,
    `   - Query: \`npx bilt design-brief --format agent\``,
    `   - Whenever design quality findings are detected, UI refactoring is needed, or preparing a website for production:`,
    `     YOU MUST PAUSE EXECUTION IMMEDIATELY AND ASK THE DEVELOPER THESE 4 DESIGN INTENT QUESTIONS IN CHAT:`,
    `     1) Purpose & Audience: What is the main purpose of this product, and who is it for?`,
    `     2) Visual Direction: What visual direction do you prefer? (Minimal, Bold, Technical, Playful, Luxury, Brutalist, 'Surprise me', or Custom)`,
    `     3) Brand Colors: Do you have specific brand colors or visual references? (Hex codes, color names, or 'Surprise me')`,
    `     4) Desired Feeling: When someone opens this, what should they feel? (Trustworthy, calm, energetic, technical, or 'Surprise me')`,
    `   - DO NOT SKIP THIS INTERVIEW. Never guess or fabricate answers.`,
    `   - After the developer responds, record their authentic answers via \`npx bilt design-brief set --purpose ... --visual ... --colors ... --feeling ...\` (or write \`.bilt/design-brief.json\`).`,
    `3. When \`.bilt/design-brief.json\` is configured (\`configured: true\`):`,
    `   - Query: \`npx bilt design-brief --format agent\` to read the developer's authentic constraints.`,
    `   - Respect creative freedom where fields are marked 'Surprise me' (\`creative-freedom\`).`,
    `   - Refactor generic templates into authentic domain UI matching the brief.`,
    `   - Run \`npx bilt design-check\` after UI changes.`,
    ``,
  ].join("\n");

  // 2. Claude hook snippet in .claude/hooks.json
  const hookFilePath = path.join(rootDir, ".claude", "hooks.json");
  const hookContent =
    JSON.stringify(
      {
        $schema: "https://json.schemastore.org/claude-code-hooks.json",
        hooks: {
          Stop: [
            {
              type: "command",
              command: "bilt scan --format agent --changed",
            },
          ],
        },
      },
      null,
      2,
    ) + "\n";

  const targets = [
    { absPath: agentDocPath, content: agentDocContent },
    { absPath: hookFilePath, content: hookContent },
  ];

  console.log(`\nAgent Configuration Setup${dryRun ? " [DRY-RUN]" : ""}:`);

  for (const target of targets) {
    const rel = path.relative(rootDir, target.absPath);
    let existingContent: string | null = null;
    let exists = false;

    try {
      existingContent = await fs.readFile(target.absPath, "utf-8");
      exists = true;
    } catch {
      exists = false;
    }

    if (exists && !force) {
      console.log(`\n[SKIP] ${rel} already exists. Use --force to overwrite.`);
      const diff = generateSimpleDiff(existingContent, target.content, rel);
      console.log(diff);
      results.push({
        filePath: target.absPath,
        relative: rel,
        status: "skip",
        diff,
      });
      continue;
    }

    const action: "create" | "overwrite" = exists ? "overwrite" : "create";
    const diff = generateSimpleDiff(existingContent, target.content, rel);

    console.log(`\n[${action.toUpperCase()}] ${rel}:`);
    console.log(diff);

    if (!dryRun) {
      await fs.mkdir(path.dirname(target.absPath), { recursive: true });
      await fs.writeFile(target.absPath, target.content, "utf-8");
      console.log(`Successfully wrote ${rel}`);
    } else {
      console.log(`[DRY-RUN] Skipped writing ${rel}`);
    }

    results.push({
      filePath: target.absPath,
      relative: rel,
      status: action,
      diff,
    });
  }

  return { files: results };
}
