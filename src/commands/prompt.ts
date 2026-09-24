import path from "node:path";
import { promises as fs } from "node:fs";

export interface PromptOptions {
  agent?: string;
}

/**
 * Render agent prompt instructions from modular template files.
 * Core engine contains zero vendor-specific hardcoding.
 */
export async function executePrompt(
  options: PromptOptions = {},
): Promise<string> {
  const agentName = (options.agent || "default")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  const candidateDirs = [
    path.resolve(process.cwd(), "templates"),
    path.resolve(__dirname, "../../templates"),
    path.resolve(__dirname, "../templates"),
  ];

  let templateContent: string | null = null;

  for (const dir of candidateDirs) {
    try {
      const file = path.join(dir, `${agentName}.md`);
      templateContent = await fs.readFile(file, "utf-8");
      break;
    } catch {
      // Try next or fallback
    }
  }

  if (!templateContent) {
    for (const dir of candidateDirs) {
      try {
        const defaultFile = path.join(dir, "default.md");
        templateContent = await fs.readFile(defaultFile, "utf-8");
        break;
      } catch {
        // Try next
      }
    }
  }

  const finalContent =
    templateContent ??
    "# Bilt Agent Security Guidelines\nRun `bilt scan --format agent --changed` before completing changes.\n";

  console.log(finalContent);
  return finalContent;
}
