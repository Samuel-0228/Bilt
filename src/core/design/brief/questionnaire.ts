import readline from "node:readline";
import type { DesignBrief, CreativeFreedom } from "./types.js";

export function parseColorInput(input: string): string[] {
  if (!input || input.trim() === "") return [];
  const words = input.split(/[\s,]+/);
  return words.filter(w => w.length > 0);
}

function askQuestion(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function isSkip(answer: string): boolean {
  const normalized = answer.toLowerCase();
  return normalized === "" || normalized === "s" || normalized === "skip";
}

function isSurprise(answer: string, optionsCount: number): boolean {
  const normalized = answer.toLowerCase();
  return normalized === "surprise me" || normalized === String(optionsCount - 1);
}

export async function runDesignBriefQuestionnaire(rootDir: string): Promise<DesignBrief | null> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log("\\n=== Bilt Design Brief Questionnaire ===");
  console.log("Answer 4 quick questions to guide AI design choices.");
  console.log("Type 's' or press Enter to skip any question.\\n");

  const q1 = "1. What is this product mainly for?\\n" +
             "   1) Dashboard/Admin\\n" +
             "   2) E-commerce\\n" +
             "   3) Landing Page\\n" +
             "   4) Tell me in my own words\\n" +
             "   5) Skip\\n" +
             "   Your choice: ";

  const ans1 = await askQuestion(rl, q1);
  let purposeValue = null;
  let purposeSource: "developer" | "not-provided" | "creative-freedom" = "not-provided";
  if (!isSkip(ans1)) {
    if (ans1 === "1") purposeValue = "Dashboard/Admin";
    else if (ans1 === "2") purposeValue = "E-commerce";
    else if (ans1 === "3") purposeValue = "Landing Page";
    else if (ans1 === "4") {
       const custom = await askQuestion(rl, "   Please describe: ");
       if (custom) purposeValue = custom;
    } else {
       purposeValue = ans1;
    }
    if (purposeValue) purposeSource = "developer";
  }

  console.log("");
  const q2 = "2. What visual direction feels right?\\n" +
             "   1) Minimal & clean\\n" +
             "   2) Dark & technical\\n" +
             "   3) Playful & friendly\\n" +
             "   4) Surprise me\\n" +
             "   5) Skip\\n" +
             "   Your choice: ";

  const ans2 = await askQuestion(rl, q2);
  let visualValue: string[] | null = null;
  let visualSource: "developer" | "not-provided" | "creative-freedom" = "not-provided";
  if (!isSkip(ans2)) {
    if (isSurprise(ans2, 5)) {
       visualSource = "creative-freedom";
    } else {
       if (ans2 === "1") visualValue = ["minimal"];
       else if (ans2 === "2") visualValue = ["dark"];
       else if (ans2 === "3") visualValue = ["playful"];
       else visualValue = [ans2];
       visualSource = "developer";
    }
  }

  console.log("");
  const q3 = "3. Do you have a brand color or color direction?\\n" +
             "   (Enter hex codes or names, e.g. '#ff6600, cream', or 'surprise me', or skip)\\n" +
             "   Your choice: ";

  const ans3 = await askQuestion(rl, q3);
  let colorsValue: string[] | null = null;
  let colorsSource: "developer" | "not-provided" | "creative-freedom" = "not-provided";
  if (!isSkip(ans3)) {
    if (ans3.toLowerCase() === "surprise me") {
      colorsSource = "creative-freedom";
    } else {
      colorsValue = parseColorInput(ans3);
      if (colorsValue.length > 0) colorsSource = "developer";
    }
  }

  console.log("");
  const q4 = "4. When someone opens this, what should they feel?\\n" +
             "   1) Trust & reliability\\n" +
             "   2) Excitement & energy\\n" +
             "   3) Calm & focused\\n" +
             "   4) Surprise me\\n" +
             "   5) Skip\\n" +
             "   Your choice: ";

  const ans4 = await askQuestion(rl, q4);
  let feelingValue: string[] | null = null;
  let feelingSource: "developer" | "not-provided" | "creative-freedom" = "not-provided";
  if (!isSkip(ans4)) {
    if (isSurprise(ans4, 5)) {
      feelingSource = "creative-freedom";
    } else {
      if (ans4 === "1") feelingValue = ["trust"];
      else if (ans4 === "2") feelingValue = ["excitement"];
      else if (ans4 === "3") feelingValue = ["calm"];
      else feelingValue = [ans4];
      feelingSource = "developer";
    }
  }

  console.log("\\n=== Summary ===");
  console.log(`Purpose: ${purposeValue || "Not specified"}`);
  console.log(`Visual: ${visualSource === "creative-freedom" ? "Surprise me" : (visualValue?.join(", ") || "Not specified")}`);
  console.log(`Colors: ${colorsSource === "creative-freedom" ? "Surprise me" : (colorsValue?.join(", ") || "Not specified")}`);
  console.log(`Feeling: ${feelingSource === "creative-freedom" ? "Surprise me" : (feelingValue?.join(", ") || "Not specified")}`);
  
  const confirm = await askQuestion(rl, "\\nIs this correct? [Y/n/edit/start-over]: ");
  rl.close();

  if (confirm.toLowerCase() === "n" || confirm.toLowerCase() === "edit" || confirm.toLowerCase() === "start-over") {
    return runDesignBriefQuestionnaire(rootDir);
  }

  const surpriseCount = [purposeSource, visualSource, colorsSource, feelingSource].filter(s => s === "creative-freedom").length;
  const developerCount = [purposeSource, visualSource, colorsSource, feelingSource].filter(s => s === "developer").length;
  
  let creativeFreedom: CreativeFreedom = "balanced";
  if (surpriseCount > developerCount) {
    creativeFreedom = "creative";
  } else if (developerCount > 0) {
    creativeFreedom = "guided";
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
      type: colorsSource === "developer" ? "requirement" : undefined
    },
    desiredFeeling: { value: feelingValue, source: feelingSource },
    creativeFreedom
  };

  return brief;
}
