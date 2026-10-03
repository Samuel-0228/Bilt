import { readDesignBrief, writeDesignBrief } from "../core/design/brief/storage.js";
import { runDesignBriefQuestionnaire } from "../core/design/brief/questionnaire.js";
import type { DesignBriefAgentOutput, DesignConstraintType } from "../core/design/brief/types.js";

export async function executeDesignBrief(
  dir: string,
  subcommand: string | undefined,
  options: { format?: "human" | "agent"; nonInteractive?: boolean }
): Promise<number> {
  const isAgent = options.format === "agent";
  let brief = await readDesignBrief(dir);

  // Agent mode is always non-interactive: output stable JSON immediately
  if (isAgent) {
    console.log(JSON.stringify(formatAgentOutput(brief), null, 2));
    return 0;
  }

  if (options.nonInteractive) {
    if (brief) {
      printHumanBrief(brief);
    } else {
      console.log("No Bilt Design Brief exists.");
      console.log("Design creativity remains agent-controlled.");
    }
    return 0;
  }

  if (subcommand === "edit" || (!subcommand && !brief)) {
    const newBrief = await runDesignBriefQuestionnaire(dir);
    if (newBrief) {
      await writeDesignBrief(dir, newBrief);
      brief = newBrief;
    } else {
      console.log("Brief creation cancelled or failed.");
      return 1;
    }
  }

  if (subcommand === "show" || (!subcommand && brief)) {
    if (isAgent) {
      console.log(JSON.stringify(formatAgentOutput(brief), null, 2));
    } else {
      if (brief) {
        printHumanBrief(brief);
      } else {
        console.log("No Bilt Design Brief exists.");
      }
    }
  }

  return 0;
}

function formatAgentOutput(brief: any): DesignBriefAgentOutput {
  if (!brief) {
    return {
      schemaVersion: "1",
      configured: false,
      creativeFreedom: "balanced",
      purpose: null,
      audience: null,
      visualDirection: null,
      brandColors: null,
      desiredFeeling: null,
      constraints: [],
      agentInstructions: "No Bilt Design Brief exists. You are free to use your own design judgment.\\nAvoid stacking recognizable AI/template patterns unnecessarily.\\nRun bilt design-check before declaring the UI complete.\\nIf bilt design-check produces identical findings across 3 runs, STOP and request developer input."
    };
  }

  const constraints: Array<{ field: string; value: unknown; type: DesignConstraintType }> = [];
  if (brief.brandColors.type === "requirement") {
    constraints.push({ field: "brandColors", value: brief.brandColors.value, type: "requirement" });
  }

  return {
    schemaVersion: "1",
    configured: true,
    creativeFreedom: brief.creativeFreedom,
    purpose: brief.purpose.value,
    audience: brief.audience.value,
    visualDirection: brief.visualDirection.value ? [...brief.visualDirection.value].sort() : null,
    brandColors: brief.brandColors.value ? [...brief.brandColors.value].sort() : null,
    desiredFeeling: brief.desiredFeeling.value ? [...brief.desiredFeeling.value].sort() : null,
    constraints,
    agentInstructions: "Before making major UI decisions, read this design brief.\\nUse it as design direction, not a rigid component specification.\\nPreserve creative freedom where this brief does not specify a preference.\\nDo not blindly copy these preferences into every component.\\nRun bilt design-check after implementation.\\nIf Bilt reports a conflict with this brief, evaluate the evidence before changing the design.\\nIf bilt design-check produces identical findings across 3 runs, STOP and request developer input."
  };
}

function printHumanBrief(brief: any) {
  console.log("BILT DESIGN BRIEF");
  console.log("─────────────────────────────\\n");

  const fmt = (field: any) => {
    if (field.source === "not-provided") return "Not specified";
    if (field.source === "creative-freedom") return "Surprise me (creative freedom)";
    if (Array.isArray(field.value)) return field.value.join(", ");
    return field.value || "Not specified";
  };

  console.log(`Purpose:      ${fmt(brief.purpose)}`);
  console.log(`Audience:     ${fmt(brief.audience)}`);
  console.log(`Visual:       ${fmt(brief.visualDirection)}`);
  console.log(`Colors:       ${fmt(brief.brandColors)}`);
  console.log(`Feeling:      ${fmt(brief.desiredFeeling)}`);
  console.log(`Creative:     ${brief.creativeFreedom}`);
}
