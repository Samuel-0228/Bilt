import readline from "node:readline";
import type { DesignBrief, CreativeFreedom } from "./types.js";
import { colors, glyphs, text, divider } from "../../../ui/theme.js";

export function parseColorInput(input: string): string[] {
  if (!input || input.trim() === "") return [];
  const words = input.split(/[\s,]+/);
  return words.filter((w) => w.length > 0);
}

function askQuestion(rl: readline.Interface, promptText: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(promptText, (answer) => {
      resolve(answer.trim());
    });
  });
}

function isSkip(answer: string): boolean {
  const normalized = answer.toLowerCase().trim();
  return normalized === "" || normalized === "s" || normalized === "skip";
}

function isSurprise(answer: string, surpriseNumber?: string): boolean {
  const normalized = answer.toLowerCase().trim();
  return (
    normalized === "surprise me" ||
    normalized === "surprise" ||
    normalized === "surpriseme" ||
    (surpriseNumber !== undefined && normalized === surpriseNumber)
  );
}

export async function runDesignBriefQuestionnaire(
  rootDir: string,
): Promise<DesignBrief | null> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("");
  console.log(
    colors.vitalTeal.bold("  ┌────────────────────────────────────────────────────────────────────────┐"),
  );
  console.log(
    colors.vitalTeal.bold("  │  Bilt Design Brief Questionnaire                                       │"),
  );
  console.log(
    colors.vitalTeal.apply("  │  Capture authentic developer design intent to guide AI coding agents   │"),
  );
  console.log(
    colors.slateDim.apply("  │  Press [Enter] or 's' to skip any question. 'surprise me' = freedom    │"),
  );
  console.log(
    colors.vitalTeal.bold("  └────────────────────────────────────────────────────────────────────────┘"),
  );
  console.log("");

  // ─── Question 1: Purpose & Audience ───────────────────────────────────────
  console.log(`  ${colors.vitalTeal.apply(glyphs.info)} ${text.bold("Question 1 of 4: Purpose & Domain")}`);
  console.log(colors.slateDim.apply("    What is the main purpose of this product, and who is it for?\n"));
  console.log(`    ${text.bold("1)")} Dashboard / Admin      ${colors.slateDim.apply("– Data-dense workflows, operations, internal tools")}`);
  console.log(`    ${text.bold("2)")} E-commerce / Store     ${colors.slateDim.apply("– Product catalogs, checkout, shopping, merchandising")}`);
  console.log(`    ${text.bold("3)")} Marketing / Landing    ${colors.slateDim.apply("– Conversion landing page, product showcase")}`);
  console.log(`    ${text.bold("4)")} Developer Tool         ${colors.slateDim.apply("– CLI tools, developer dashboards, technical APIs")}`);
  console.log(`    ${text.bold("5)")} Custom description     ${colors.slateDim.apply("– Enter your own domain or target audience")}`);
  console.log(`    ${colors.slateDim.apply("s) Skip")}                   ${colors.slateDim.apply("– Leave unspecified")}\n`);

  const ans1 = await askQuestion(rl, `  ${colors.vitalTeal.bold("❯")} Your choice [1-5, custom, or s to skip]: `);
  let purposeValue: string | null = null;
  let purposeSource: "developer" | "not-provided" | "creative-freedom" = "not-provided";

  if (!isSkip(ans1)) {
    if (ans1 === "1") purposeValue = "Dashboard/Admin";
    else if (ans1 === "2") purposeValue = "E-commerce";
    else if (ans1 === "3") purposeValue = "Landing Page";
    else if (ans1 === "4") purposeValue = "Developer Tool";
    else if (ans1 === "5") {
      const custom = await askQuestion(rl, `    ${colors.vitalTeal.apply("❯")} Describe your product and audience: `);
      if (custom && !isSkip(custom)) purposeValue = custom;
    } else {
      purposeValue = ans1;
    }
    if (purposeValue) purposeSource = "developer";
  }

  console.log("");
  console.log(divider(68));
  console.log("");

  // ─── Question 2: Visual Direction ─────────────────────────────────────────
  console.log(`  ${colors.vitalTeal.apply(glyphs.info)} ${text.bold("Question 2 of 4: Visual Direction & Aesthetics")}`);
  console.log(colors.slateDim.apply("    What visual aesthetic best represents this product?\n"));
  console.log(`    ${text.bold("1)")} Minimal & clean        ${colors.slateDim.apply("– High whitespace, crisp typography, subtle borders")}`);
  console.log(`    ${text.bold("2)")} Dark & technical       ${colors.slateDim.apply("– Slate/dark monochrome, code-oriented, high contrast")}`);
  console.log(`    ${text.bold("3)")} Bold & expressive      ${colors.slateDim.apply("– Strong personality, distinct typography, punchy accents")}`);
  console.log(`    ${text.bold("4)")} Playful & friendly     ${colors.slateDim.apply("– Warm palette, approachable curves, welcoming feel")}`);
  console.log(`    ${text.bold("5)")} Luxury & premium       ${colors.slateDim.apply("– Deep tones, editorial layout, refined precision")}`);
  console.log(`    ${text.bold("6)")} Brutalist & raw        ${colors.slateDim.apply("– Stark utilitarian borders, raw typography, raw structure")}`);
  console.log(`    ${colors.amberFlag.bold("7) Surprise me")}            ${colors.amberFlag.apply("★ Full creative freedom (no agent visual constraints)")}`);
  console.log(`    ${colors.slateDim.apply("s) Skip")}                   ${colors.slateDim.apply("– Leave unspecified")}\n`);

  const ans2 = await askQuestion(rl, `  ${colors.vitalTeal.bold("❯")} Your choice [1-7, 'surprise me', custom, or s to skip]: `);
  let visualValue: string[] | null = null;
  let visualSource: "developer" | "not-provided" | "creative-freedom" = "not-provided";

  if (!isSkip(ans2)) {
    if (isSurprise(ans2, "7")) {
      visualSource = "creative-freedom";
    } else {
      if (ans2 === "1") visualValue = ["minimal"];
      else if (ans2 === "2") visualValue = ["dark"];
      else if (ans2 === "3") visualValue = ["bold"];
      else if (ans2 === "4") visualValue = ["playful"];
      else if (ans2 === "5") visualValue = ["luxury"];
      else if (ans2 === "6") visualValue = ["brutalist"];
      else visualValue = [ans2];
      visualSource = "developer";
    }
  }

  console.log("");
  console.log(divider(68));
  console.log("");

  // ─── Question 3: Brand Colors & References ────────────────────────────────
  console.log(`  ${colors.vitalTeal.apply(glyphs.info)} ${text.bold("Question 3 of 4: Brand Colors & Visual Palette")}`);
  console.log(colors.slateDim.apply("    Do you have brand colors or a palette direction?\n"));
  console.log(colors.slateDim.apply("    • Enter hex codes or color names (e.g. '#2563eb, slate' or '#78350f, cream')"));
  console.log(`    • Type ${colors.amberFlag.apply("'surprise me'")} to give the agent full creative freedom on colors`);
  console.log(colors.slateDim.apply("    • Press [Enter] or type 's' to skip (no color constraint)\n"));

  const ans3 = await askQuestion(rl, `  ${colors.vitalTeal.bold("❯")} Brand colors or choice: `);
  let colorsValue: string[] | null = null;
  let colorsSource: "developer" | "not-provided" | "creative-freedom" = "not-provided";

  if (!isSkip(ans3)) {
    if (isSurprise(ans3)) {
      colorsSource = "creative-freedom";
    } else {
      colorsValue = parseColorInput(ans3);
      if (colorsValue.length > 0) colorsSource = "developer";
    }
  }

  console.log("");
  console.log(divider(68));
  console.log("");

  // ─── Question 4: Interface Atmosphere ─────────────────────────────────────
  console.log(`  ${colors.vitalTeal.apply(glyphs.info)} ${text.bold("Question 4 of 4: Interface Atmosphere & Emotional Tone")}`);
  console.log(colors.slateDim.apply("    When someone opens this interface, what feeling should it evoke?\n"));
  console.log(`    ${text.bold("1)")} Trust & reliability    ${colors.slateDim.apply("– Dependable, secure, enterprise-grade, proven")}`);
  console.log(`    ${text.bold("2)")} Focus & clarity        ${colors.slateDim.apply("– Clean, productive, uncluttered, zero distractions")}`);
  console.log(`    ${text.bold("3)")} Excitement & energy    ${colors.slateDim.apply("– Vibrant, inspiring, motivating, dynamic")}`);
  console.log(`    ${text.bold("4)")} Calm & approachable    ${colors.slateDim.apply("– Welcoming, comfortable, friendly, low-stress")}`);
  console.log(`    ${colors.amberFlag.bold("5) Surprise me")}            ${colors.amberFlag.apply("★ Full creative freedom")}`);
  console.log(`    ${colors.slateDim.apply("s) Skip")}                   ${colors.slateDim.apply("– Leave unspecified")}\n`);

  const ans4 = await askQuestion(rl, `  ${colors.vitalTeal.bold("❯")} Your choice [1-5, 'surprise me', custom, or s to skip]: `);
  let feelingValue: string[] | null = null;
  let feelingSource: "developer" | "not-provided" | "creative-freedom" = "not-provided";

  if (!isSkip(ans4)) {
    if (isSurprise(ans4, "5")) {
      feelingSource = "creative-freedom";
    } else {
      if (ans4 === "1") feelingValue = ["trust"];
      else if (ans4 === "2") feelingValue = ["calm", "focus"];
      else if (ans4 === "3") feelingValue = ["excitement"];
      else if (ans4 === "4") feelingValue = ["approachable", "friendly"];
      else feelingValue = [ans4];
      feelingSource = "developer";
    }
  }

  // ─── Creative Freedom Calculation ─────────────────────────────────────────
  const surpriseCount = [purposeSource, visualSource, colorsSource, feelingSource].filter(
    (s) => s === "creative-freedom",
  ).length;
  const developerCount = [purposeSource, visualSource, colorsSource, feelingSource].filter(
    (s) => s === "developer",
  ).length;

  let creativeFreedom: CreativeFreedom = "balanced";
  if (surpriseCount > developerCount) {
    creativeFreedom = "creative";
  } else if (developerCount > 0) {
    creativeFreedom = "guided";
  }

  // ─── Summary Card ─────────────────────────────────────────────────────────
  console.log("");
  console.log(
    colors.vitalTeal.bold("  ┌────────────────────────────────────────────────────────────────────────┐"),
  );
  console.log(
    colors.vitalTeal.bold("  │  Design Brief Summary                                                  │"),
  );
  console.log(
    colors.vitalTeal.bold("  ├────────────────────────────────────────────────────────────────────────┤"),
  );

  const formatSummaryRow = (label: string, val: string) => {
    const paddedLabel = (label + ":").padEnd(14, " ");
    const content = `${paddedLabel}${val}`;
    const clipped = content.length > 68 ? content.slice(0, 65) + "..." : content;
    const padding = " ".repeat(Math.max(0, 68 - clipped.length));
    return `  │  ${clipped}${padding}│`;
  };

  const renderFieldValue = (source: string, val: string | string[] | null) => {
    if (source === "creative-freedom") return colors.amberFlag.apply("Surprise me (creative freedom)");
    if (source === "not-provided" || !val) return colors.slateDim.apply("Not specified");
    if (Array.isArray(val)) return val.join(", ");
    return String(val);
  };

  console.log(formatSummaryRow("Purpose", renderFieldValue(purposeSource, purposeValue)));
  console.log(formatSummaryRow("Visual", renderFieldValue(visualSource, visualValue)));
  console.log(formatSummaryRow("Colors", renderFieldValue(colorsSource, colorsValue)));
  console.log(formatSummaryRow("Feeling", renderFieldValue(feelingSource, feelingValue)));
  console.log(formatSummaryRow("Freedom Mode", colors.mintClear.apply(creativeFreedom)));
  console.log(
    colors.vitalTeal.bold("  └────────────────────────────────────────────────────────────────────────┘"),
  );
  console.log("");

  const confirm = await askQuestion(rl, `  ${colors.vitalTeal.bold("❯")} Save this brief to .bilt/design-brief.json? [Y/n/edit]: `);
  rl.close();

  const normConfirm = confirm.toLowerCase().trim();
  if (normConfirm === "n" || normConfirm === "edit" || normConfirm === "start-over") {
    console.log(colors.slateDim.apply("\n  Restarting questionnaire...\n"));
    return runDesignBriefQuestionnaire(rootDir);
  }

  const now = new Date().toISOString();
  const brief: DesignBrief = {
    schemaVersion: "1",
    createdAt: now,
    updatedAt: now,
    purpose: { value: purposeValue, source: purposeSource },
    audience: { value: null, source: "not-provided" },
    visualDirection: { value: visualValue, source: visualSource },
    brandColors: {
      value: colorsValue,
      source: colorsSource,
      type: colorsSource === "developer" ? "requirement" : undefined,
    },
    desiredFeeling: { value: feelingValue, source: feelingSource },
    creativeFreedom,
  };

  return brief;
}
