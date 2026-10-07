import {
  readDesignBrief,
  writeDesignBrief,
  clearDesignBrief,
} from "../core/design/brief/storage.js";
import {
  runDesignBriefQuestionnaire,
  parseColorInput,
} from "../core/design/brief/questionnaire.js";
import type {
  DesignBrief,
  DesignBriefAgentOutput,
  DesignConstraintType,
  CreativeFreedom,
  DesignBriefField,
} from "../core/design/brief/types.js";
import { colors, text, divider } from "../ui/theme.js";

export interface ExecuteDesignBriefOptions {
  format?: "human" | "agent";
  nonInteractive?: boolean;
  interactive?: boolean;
  purpose?: string;
  visual?: string;
  colors?: string;
  feeling?: string;
  creativeFreedom?: CreativeFreedom;
  json?: string;
}

export async function executeDesignBrief(
  dir: string,
  subcommand: string | undefined,
  options: ExecuteDesignBriefOptions = {},
): Promise<number> {
  const isAgent = options.format === "agent";
  const normalizedSubcommand = subcommand?.toLowerCase();

  // ─── Subcommand: clear ────────────────────────────────────────────────────
  if (normalizedSubcommand === "clear") {
    await clearDesignBrief(dir);
    if (isAgent) {
      console.log(JSON.stringify(formatAgentOutput(null), null, 2));
    } else {
      console.log(colors.mintClear.apply("  ✓ Cleared Bilt Design Brief (.bilt/design-brief.json)"));
    }
    return 0;
  }

  // ─── Subcommand: questionnaire / questions ─────────────────────────────────
  if (normalizedSubcommand === "questionnaire" || normalizedSubcommand === "questions") {
    const questionsList = [
      {
        id: "purpose",
        number: 1,
        title: "Purpose & Audience",
        question: "What is the main purpose of this product, and who is it for?",
        hint: "E.g. 'A B2B SaaS dashboard for dental clinics to track patient appointments' or 'Surprise me'",
      },
      {
        id: "visual",
        number: 2,
        title: "Visual Direction",
        question: "What visual direction do you prefer? (Minimal, Bold, Technical, Playful, Luxury, Brutalist, 'Surprise me', Custom)",
        hint: "Choose one or more aesthetic styles",
      },
      {
        id: "colors",
        number: 3,
        title: "Brand Colors",
        question: "Do you have specific brand colors or visual references? (Hex codes, color names, or 'Surprise me')",
        hint: "Hex codes, color names, or 'Surprise me' (e.g. '#0f172a, #3b82f6')",
      },
      {
        id: "feeling",
        number: 4,
        title: "Desired Feeling",
        question: "When someone opens this, what should they feel? (Trustworthy, calm, energetic, technical, or 'Surprise me')",
        hint: "The emotional tone the interface should convey",
      },
    ];

    const currentBrief = await readDesignBrief(dir);

    if (isAgent) {
      console.log(
        JSON.stringify(
          {
            schemaVersion: "1",
            configured: currentBrief !== null,
            questions: questionsList,
            agentInstruction:
              "PAUSE execution and present these 4 Design Intent questions to the developer in chat. " +
              "Once they respond, save their answers using: " +
              "npx bilt design-brief set --purpose \"...\" --visual \"...\" --colors \"...\" --feeling \"...\"",
          },
          null,
          2,
        ),
      );
    } else {
      console.log("\n  BILT DESIGN INTENT QUESTIONNAIRE");
      console.log("  ─────────────────────────────────");
      console.log("  Copy and paste these 4 questions into your prompt or chat:\n");
      for (const q of questionsList) {
        console.log(`  ${q.number}. ${q.title}: ${q.question}`);
        console.log(`     Hint: ${q.hint}\n`);
      }
      console.log("  To record answers after getting a response:");
      console.log('  npx bilt design-brief set --purpose "..." --visual "..." --colors "..." --feeling "..."\n');
    }
    return 0;
  }

  // ─── Subcommand: set ──────────────────────────────────────────────────────
  if (normalizedSubcommand === "set") {
    let briefToSave: DesignBrief;

    if (options.json) {
      try {
        const parsed = JSON.parse(options.json);
        const now = new Date().toISOString();
        briefToSave = {
          schemaVersion: "1",
          createdAt: parsed.createdAt || now,
          updatedAt: now,
          purpose: parsed.purpose?.value !== undefined ? parsed.purpose : {
            value: parsed.purpose || null,
            source: parsed.purpose ? "developer" : "not-provided",
          },
          audience: parsed.audience?.value !== undefined ? parsed.audience : {
            value: parsed.audience || null,
            source: parsed.audience ? "developer" : "not-provided",
          },
          visualDirection: parsed.visualDirection?.value !== undefined ? parsed.visualDirection : {
            value: parsed.visualDirection ? (Array.isArray(parsed.visualDirection) ? parsed.visualDirection : [parsed.visualDirection]) : null,
            source: parsed.visualDirection ? "developer" : "not-provided",
          },
          brandColors: parsed.brandColors?.value !== undefined ? parsed.brandColors : {
            value: parsed.brandColors ? (Array.isArray(parsed.brandColors) ? parsed.brandColors : parseColorInput(parsed.brandColors)) : null,
            source: parsed.brandColors ? "developer" : "not-provided",
            type: "requirement",
          },
          desiredFeeling: parsed.desiredFeeling?.value !== undefined ? parsed.desiredFeeling : {
            value: parsed.desiredFeeling ? (Array.isArray(parsed.desiredFeeling) ? parsed.desiredFeeling : [parsed.desiredFeeling]) : null,
            source: parsed.desiredFeeling ? "developer" : "not-provided",
          },
          creativeFreedom: parsed.creativeFreedom || "balanced",
        };
      } catch (err) {
        console.error(colors.pulseCoral.apply("Invalid JSON provided for --json"));
        return 1;
      }
    } else {
      const isSurprise = (val?: string) => {
        if (!val) return false;
        const norm = val.trim().toLowerCase();
        return norm === "surprise me" || norm === "surprise";
      };

      const purposeField: DesignBriefField<string | null> = options.purpose
        ? isSurprise(options.purpose)
          ? { value: null, source: "creative-freedom" }
          : { value: options.purpose.trim(), source: "developer" }
        : { value: null, source: "not-provided" };

      const visualField: DesignBriefField<string[] | null> = options.visual
        ? isSurprise(options.visual)
          ? { value: null, source: "creative-freedom" }
          : { value: options.visual.split(/[\s,]+/).filter(Boolean), source: "developer" }
        : { value: null, source: "not-provided" };

      const colorsField: DesignBriefField<string[] | null> = options.colors
        ? isSurprise(options.colors)
          ? { value: null, source: "creative-freedom" }
          : {
              value: parseColorInput(options.colors),
              source: "developer",
              type: "requirement",
            }
        : { value: null, source: "not-provided" };

      const feelingField: DesignBriefField<string[] | null> = options.feeling
        ? isSurprise(options.feeling)
          ? { value: null, source: "creative-freedom" }
          : { value: options.feeling.split(/[\s,]+/).filter(Boolean), source: "developer" }
        : { value: null, source: "not-provided" };

      const surprises = [purposeField, visualField, colorsField, feelingField].filter(
        (f) => f.source === "creative-freedom",
      ).length;
      const devs = [purposeField, visualField, colorsField, feelingField].filter(
        (f) => f.source === "developer",
      ).length;

      let freedom: CreativeFreedom = options.creativeFreedom || "balanced";
      if (!options.creativeFreedom) {
        if (surprises > devs) freedom = "creative";
        else if (devs > 0) freedom = "guided";
      }

      const now = new Date().toISOString();
      briefToSave = {
        schemaVersion: "1",
        createdAt: now,
        updatedAt: now,
        purpose: purposeField,
        audience: { value: null, source: "not-provided" },
        visualDirection: visualField,
        brandColors: colorsField,
        desiredFeeling: feelingField,
        creativeFreedom: freedom,
      };
    }

    await writeDesignBrief(dir, briefToSave);
    if (isAgent) {
      console.log(JSON.stringify(formatAgentOutput(briefToSave), null, 2));
    } else {
      console.log(colors.mintClear.apply("  ✓ Successfully saved Bilt Design Brief to .bilt/design-brief.json\n"));
      printHumanBrief(briefToSave);
    }
    return 0;
  }

  let brief = await readDesignBrief(dir);

  // ─── Agent Mode ───────────────────────────────────────────────────────────
  // Always non-interactive: output stable JSON immediately
  if (isAgent) {
    console.log(JSON.stringify(formatAgentOutput(brief), null, 2));
    return 0;
  }

  // ─── Explicit Non-Interactive Mode ────────────────────────────────────────
  if (options.nonInteractive) {
    if (brief) {
      printHumanBrief(brief);
    } else {
      console.log("No Bilt Design Brief exists.");
      console.log("To configure design intent: run 'npx bilt design-brief questionnaire' or 'npx bilt design-brief set ...'");
    }
    return 0;
  }

  // ─── Interactive Questionnaire ───────────────────────────────────────────
  if (normalizedSubcommand === "edit" || (!normalizedSubcommand && !brief)) {
    // If not running in an interactive TTY and not forced, do not hang on readline
    if (!process.stdin.isTTY && !options.interactive) {
      if (brief) {
        printHumanBrief(brief);
      } else {
        console.log("No Bilt Design Brief exists.");
        console.log("Interactive questionnaire requires a TTY terminal.");
        console.log("To configure a design brief:");
        console.log("  • In an interactive terminal: run 'npx bilt design-brief'");
        console.log("  • In an AI coding agent: ask the developer in chat, then run 'npx bilt design-brief set ...'");
        console.log("To see the questions: run 'npx bilt design-brief questionnaire'");
      }
      return 0;
    }

    const newBrief = await runDesignBriefQuestionnaire(dir);
    if (newBrief) {
      await writeDesignBrief(dir, newBrief);
      brief = newBrief;
    } else {
      console.log("Brief creation cancelled or failed.");
      return 1;
    }
  }

  // ─── Show Brief ───────────────────────────────────────────────────────────
  if (normalizedSubcommand === "show" || (!normalizedSubcommand && brief)) {
    if (brief) {
      printHumanBrief(brief);
    } else {
      console.log("No Bilt Design Brief exists.");
      console.log("To configure design intent: run 'npx bilt design-brief questionnaire' or 'npx bilt design-brief set ...'");
    }
  }

  return 0;
}

function formatAgentOutput(brief: DesignBrief | null): DesignBriefAgentOutput {
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
      agentInstructions:
        "No Bilt Design Brief exists (`configured: false`).\n" +
        "CRITICAL HUMAN-INTENT BOUNDARY & MANDATORY QUESTIONNAIRE:\n" +
        "1. Do NOT autonomously fabricate, guess, or hallucinate answers to populate `.bilt/design-brief.json`.\n" +
        "2. MANDATORY CHECKPOINT BEFORE UI WORK: Whenever design quality or vibecoding issues are detected, you MUST PAUSE execution and ask the developer these 4 Design Intent questions in chat:\n" +
        "   Q1 (Purpose & Audience): What is the main purpose of this product, and who is it for?\n" +
        "   Q2 (Visual Direction): What visual direction do you prefer? (Minimal, Bold, Technical, Playful, Luxury, Brutalist, 'Surprise me', Custom)\n" +
        "   Q3 (Brand Colors): Do you have specific brand colors or visual references? (Hex codes, color names, or 'Surprise me')\n" +
        "   Q4 (Desired Feeling): When someone opens this, what should they feel? (Trustworthy, calm, energetic, technical, or 'Surprise me')\n" +
        "3. DO NOT SKIP OR BYPASS THIS INTERVIEW. Authentic domain UI requires human direction on product purpose and audience.\n" +
        "4. After the developer responds, record their exact answers via `npx bilt design-brief set --purpose ... --visual ... --colors ... --feeling ...` (or write `.bilt/design-brief.json`).\n" +
        "5. Once saved, refactor the UI to align with their brief and run `npx bilt design-check --format agent` to verify.\n" +
        "6. If identical findings persist across 3 runs, STOP and ask the developer.",
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
    agentInstructions:
      "A Bilt Design Brief is configured by the developer (`configured: true`).\n" +
      "1. Before making major UI decisions, read this design brief and follow the developer's authentic design direction.\n" +
      "2. Use it as design direction, not a rigid component specification.\n" +
      "3. Preserve creative freedom where this brief does not specify a preference or indicates 'Surprise me' (`creative-freedom`).\n" +
      "4. Do NOT overwrite or modify `.bilt/design-brief.json` autonomously.\n" +
      "5. Run `bilt design-check` after implementation.\n" +
      "6. If Bilt reports a conflict with this brief, evaluate the evidence before changing the design.\n" +
      "7. If `bilt design-check` produces identical findings across 3 runs, STOP and request developer input.",
  };
}

function printHumanBrief(brief: DesignBrief) {
  console.log("\nBILT DESIGN BRIEF");
  console.log("─────────────────────────────\n");

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
  console.log(`Creative:     ${brief.creativeFreedom}\n`);
}
