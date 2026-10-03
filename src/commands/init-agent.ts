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
