import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    "# Bilt Agent Security Guidelines\nRun `bilt scan --format agent --changed` before completing changes.\n\n## DESIGN QUALITY REQUIREMENT\n\nDo not default to recognizable AI-generated website patterns.\n\nBefore implementing UI:\n1. inspect the existing product\n2. identify the product's actual domain and users\n3. use real product behavior/data as visual inspiration\n4. avoid stacking generic SaaS patterns\n5. avoid decorative elements without purpose\n6. make loading, empty, error, success, and disabled states intentional\n7. preserve accessibility\n8. run `bilt design-check`\n9. address design findings\n10. rerun Bilt before declaring the task complete\n\nDo not remove or weaken Bilt rules simply to obtain a passing result.\n";

  console.log(finalContent);
  return finalContent;
}
