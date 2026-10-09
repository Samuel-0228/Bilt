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
    `# Bilt Agent Security Guidelines\n\nYou are operating under active Bilt engineering supervision.\nBilt is an active verification layer inside your development loop. Treat Bilt's structured machine-readable output as authoritative project feedback.\n\nFollow these 10 mandatory operating principles:\n1. Use Bilt during implementation: run \`npx bilt check --changed --format agent\` (or \`bilt scan --format agent --changed\`).\n2. Verify before completion: run Bilt checks before considering tasks complete.\n3. Treat structured output as authoritative: check \`status\` and \`allowedToContinue\`. Follow \`nextAction\`.\n4. Fix blocking/high findings: address issues in \`nextAction.findingIds\`.\n5. Follow exact remediation constraints: adhere to \`objective\`, \`allowedChanges\`, and \`forbiddenChanges\`.\n6. Strict non-evasion invariant: never weaken config or suppress rules without approval.\n7. Re-run Bilt after changes: execute the \`verification\` command.\n8. Watch for regressions: if a resolved finding re-appears, fix it immediately.\n9. Stop when Bilt reports escalate: halt immediately on status \`escalate\` (exit code 4).\n10. Ask the developer when human decision is needed: consult user on \`needs-review\`.\n`;

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
