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

  let finalContent =
    templateContent ??
    "# Bilt Agent Security Guidelines\nRun `bilt scan --format agent --changed` before completing changes.\n\n## DESIGN QUALITY REQUIREMENT\n\nDo not default to recognizable AI-generated website patterns.\n\nBefore implementing UI:\n1. inspect the existing product\n2. identify the product's actual domain and users\n3. use real product behavior/data as visual inspiration\n4. avoid stacking generic SaaS patterns\n5. avoid decorative elements without purpose\n6. make loading, empty, error, success, and disabled states intentional\n7. preserve accessibility\n8. run `bilt design-check`\n9. address design findings\n10. rerun Bilt before declaring the task complete\n\nDo not remove or weaken Bilt rules simply to obtain a passing result.\n";

  const { readDesignBrief } = await import("../core/design/brief/storage.js");
  const brief = await readDesignBrief(process.cwd());
  if (brief) {
    const fmt = (field: any) => {
      if (field.source === "creative-freedom") return "Surprise me (creative freedom)";
      if (field.source === "not-provided") return "Not specified";
      if (Array.isArray(field.value)) return field.value.join(", ");
      return field.value || "Not specified";
    };

    finalContent += `\n## DESIGN BRIEF (ACTIVE DIRECTION)\n\nA Bilt Design Brief is configured by the developer (\`configured: true\`):\n- Purpose: ${fmt(brief.purpose)}\n- Visual Direction: ${fmt(brief.visualDirection)}\n- Brand Colors: ${fmt(brief.brandColors)}\n- Desired Feeling: ${fmt(brief.desiredFeeling)}\n- Creative Freedom Mode: ${brief.creativeFreedom}\n\nInstructions for Coding Agent:\n1. Treat the developer's brief as directional intent, not a rigid component specification.\n2. Where fields are marked 'Surprise me' (creative freedom), use your own creative judgment.\n3. Do NOT modify, delete, or overwrite .bilt/design-brief.json autonomously.\n4. Run \`npx bilt design-check\` after UI changes.\n5. If \`bilt design-check\` produces identical findings across 3 runs, STOP and request developer input.\n`;
  } else {
    finalContent += "\n## DESIGN BRIEF & MANDATORY HUMAN-INTENT CHECKPOINT\n\nNo Bilt Design Brief exists (`configured: false`).\n\nCRITICAL RULES FOR CODING AGENTS:\n1. **Never fabricate or invent a design brief**: The design brief captures authentic human intent. Do NOT guess, infer from files, or synthesize fake answers to populate `.bilt/design-brief.json`.\n2. **MANDATORY CHECKPOINT BEFORE UI WORK**: Whenever design quality findings are detected, UI refactoring is needed, or preparing a website for production:\n   - **PAUSE execution immediately** and ask the developer these 4 Design Intent questions in chat:\n     1) Purpose & Audience: What is the main purpose of this product, and who is it for?\n     2) Visual Direction: What visual direction do you prefer? (Minimal, Bold, Technical, Playful, Luxury, Brutalist, 'Surprise me', or Custom)\n     3) Brand Colors: Do you have specific brand colors or visual references? (Hex codes, color names, or 'Surprise me')\n     4) Desired Feeling: When someone opens this, what should they feel? (Trustworthy, calm, energetic, technical, or 'Surprise me')\n   - **DO NOT SKIP THIS QUESTIONNAIRE**. You cannot design authentic product UI without human direction. Never guess or assume.\n   - Once the developer provides their answers, save them using:\n     `npx bilt design-brief set --purpose \"...\" --visual \"...\" --colors \"...\" --feeling \"...\"`\n     (or write to `.bilt/design-brief.json`).\n3. After the design brief is configured, refactor the UI to align with the developer's intent and run `npx bilt design-check` before declaring UI complete.\n";
  }

  console.log(finalContent);
  return finalContent;
}
