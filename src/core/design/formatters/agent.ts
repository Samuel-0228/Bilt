import fs from "node:fs";
import path from "node:path";
import type { DesignCheckResult } from "../types.js";

export interface FormatAgentDesignOutputOptions {
  projectRoot?: string;
  hasDesignBrief?: boolean;
}

export function formatAgentDesignOutput(
  result: DesignCheckResult,
  options?: FormatAgentDesignOutputOptions,
): object {
  const allFiles = Array.from(
    new Set(
      result.findings.flatMap((f) =>
        f.locations && f.locations.length > 0
          ? f.locations.map((l) => l.file)
          : f.file ? [f.file] : [],
      ),
    ),
  );

  let hasBrief = options?.hasDesignBrief ?? result.hasDesignBrief;
  if (hasBrief === undefined) {
    const root = options?.projectRoot || process.cwd();
    try {
      const briefPath = path.join(root, ".bilt", "design-brief.json");
      if (fs.existsSync(briefPath)) {
        const raw = fs.readFileSync(briefPath, "utf-8");
        const parsed = JSON.parse(raw);
        hasBrief = Boolean(parsed && typeof parsed === "object");
      } else {
        hasBrief = false;
      }
    } catch {
      hasBrief = false;
    }
  }

  const designRefactorBody = !hasBrief
    ? `MANDATORY DESIGN INTENT CHECKPOINT: No design brief is configured (.bilt/design-brief.json). Before rewriting UI, PAUSE and ask the developer these 4 Design Intent questions in chat:\n` +
      `1. Purpose & Audience: What is the main purpose of this product, and who is it for?\n` +
      `2. Visual Direction: What visual direction do you prefer? (Minimal, Bold, Technical, Playful, Luxury, Brutalist, 'Surprise me', or Custom)\n` +
      `3. Brand Colors: Do you have specific brand colors or visual references? (Hex codes, color names, or 'Surprise me')\n` +
      `4. Desired Feeling: When someone opens this, what should they feel? (Trustworthy, calm, energetic, technical, or 'Surprise me')\n` +
      `After the developer answers, save their answers via "npx bilt design-brief set --purpose '...' --visual '...' --colors '...' --feeling '...'" and refactor UI to match their brief. Re-run 'npx bilt design-check --format agent' to verify.`
    : `Refactor generic templates into authentic domain UI matching the design brief (.bilt/design-brief.json) and re-run 'npx bilt design-check --format agent'.`;

  const nextAction =
    result.status === "pass"
      ? {
          type: "stop",
          findingIds: [],
          instruction: "STOP. Design and UI quality checks pass. Clean domain UI verified.",
        }
      : result.status === "escalate"
        ? {
            type: "escalate",
            findingIds: [],
            instruction: result.escalationMessage || "HALT automated UI retries. Request human direction.",
          }
        : {
            type: "fix",
            findingIds: result.findings.map((f) => f.fingerprint.slice(0, 8)),
            instruction:
              `MANDATORY DESIGN REFACTOR: ${result.findings.length} design quality pattern(s) detected across [${allFiles.slice(0, 3).join(", ")}]. ` +
              `Run 'npx bilt design-check --fix' for automated mechanical fixes. ` +
              designRefactorBody,
          };

  const output: any = {
    schemaVersion: "1",
    status: result.status,
    summary: {
      patternsDetected: result.summary.patternsDetected,
      high: result.summary.high,
      medium: result.summary.medium,
      low: result.summary.low,
    },
    findings: result.findings.map((f) => ({
      ruleId: f.ruleId,
      category: f.category,
      severity: f.severity,
      title: f.title,
      whyItMatters: f.whyItMatters,
      agentAction: f.agentAction,
      recommendation: f.recommendation,
      evidence: f.evidence,
      file: f.file,
      line: f.line,
      locations:
        f.locations && f.locations.length > 0
          ? f.locations
          : f.file ? [{ file: f.file, line: f.line }] : [],
      fingerprint: f.fingerprint,
    })),
    nextAction,
  };

  if (result.suppressed && result.suppressed.length > 0) {
    output.suppressed = result.suppressed;
  }

  if (result.escalationMessage) {
    output.escalationMessage = result.escalationMessage;
  }

  if (result.fixedCount !== undefined && result.fixedCount > 0) {
    output.fixedCount = result.fixedCount;
  }

  return output;
}
