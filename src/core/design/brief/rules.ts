import crypto from "node:crypto";
import type { DesignBrief } from "./types.js";
import type { DesignSnapshot, DesignFinding } from "../types.js";
import { generateDesignFingerprint } from "../engine.js";

function getCombinationScore(snapshot: DesignSnapshot): number {
    const totalCards = snapshot.components.filter((c) => c.isCard).length;
    const totalGradients = snapshot.styles.reduce((sum, s) => sum + s.gradientCount, 0);
    const totalRadialOrbs = snapshot.styles.reduce((sum, s) => sum + s.radialOrbCount, 0);
    const totalSparkles = snapshot.components.reduce(
        (sum, c) => sum + (c.iconNames || []).filter((i) => i.includes("Sparkle") || i.includes("Wand")).length,
        0,
    );
    const hasThreeColumn = snapshot.components.some((c) => c.isThreeColumnSection) ? 1 : 0;
    const isPurpleBlack = snapshot.colors.isPurpleBlackAesthetic ? 1 : 0;
    const hasBento = snapshot.components.some((c) => c.isBentoGrid) ? 1 : 0;

    let score = 0;
    if (totalCards >= 3) score++;
    if (totalGradients >= 2) score++;
    if (totalRadialOrbs >= 1) score++;
    if (totalSparkles >= 1) score++;
    score += hasThreeColumn;
    score += isPurpleBlack;
    score += hasBento;

    return score;
}

export function getBriefConsistencyFindings(brief: DesignBrief | null, snapshot: DesignSnapshot): DesignFinding[] {
  if (!brief) return [];
  
  const findings: DesignFinding[] = [];

  // DESIGN-BRIEF-001: Dark direction but light background
  if (brief.visualDirection.source === "developer" && brief.visualDirection.value?.includes("dark")) {
    if (snapshot.colors.pureWhiteBgCount >= 4 && !snapshot.colors.isPurpleBlackAesthetic) {
      const ruleId = "DESIGN-BRIEF-001";
      const evidence = ["pureWhiteBgCount >= 4", "isPurpleBlackAesthetic is false"];
      const sortedEvidenceKey = evidence.slice().sort().join(";");
      const fp = crypto.createHash("sha256").update(`${ruleId}:${sortedEvidenceKey}`).digest("hex");
      
      findings.push({
        ruleId,
        category: "design-genericity",
        severity: "low",
        title: "Brief specifies dark visual direction, but dominant background is clearly light",
        whyItMatters: "The implemented UI contradicts the explicit developer design brief.",
        evidence,
        recommendation: "Update the background colors to align with the dark visual direction in the brief.",
        agentAction: "Modify the root or layout background to use dark theme colors.",
        fingerprint: fp,
      });
    }
  }

  // DESIGN-BRIEF-002: Brand color missing
  if (brief.brandColors.source === "developer" && brief.brandColors.type === "requirement" && brief.brandColors.value && brief.brandColors.value.length > 0) {
    const requiredColors = brief.brandColors.value;
    const detectedColors = snapshot.colors.primaryColors;
    // We could check if required colors are in detected, but it might be fuzzy.
    // For simplicity, if we detect some colors but none match the required roughly, fire it.
    // Given the instructions, we can just say if no detected colors include the required.
    // Actually, just checking if *any* required color is somewhat present.
    // A conservative check: if the detected colors array is completely disjoint from required.
    // Actually, snapshot.colors.primaryColors are likely hex codes or rgb.
    // If it's a requirement and doesn't appear, severity low.
    const missing = requiredColors.filter(rc => !detectedColors.some(dc => dc.toLowerCase().includes(rc.toLowerCase().replace("#", ""))));
    if (missing.length === requiredColors.length && detectedColors.length > 0) {
      const ruleId = "DESIGN-BRIEF-002";
      const evidence = [`Missing required brand colors: ${missing.join(", ")}`];
      const sortedEvidenceKey = evidence.slice().sort().join(";");
      const fp = crypto.createHash("sha256").update(`${ruleId}:${sortedEvidenceKey}`).digest("hex");
      
      findings.push({
        ruleId,
        category: "design-genericity",
        severity: "low",
        title: "Brief specifies a primary brand color but it doesn't appear in detected colors",
        whyItMatters: "Brand consistency is required by the design brief.",
        evidence,
        recommendation: "Incorporate the required brand colors into the design.",
        agentAction: "Update primary accent elements to use the specified brand colors.",
        fingerprint: fp,
      });
    }
  }

  // DESIGN-BRIEF-003: Minimal direction but high decorative density
  if (brief.visualDirection.source === "developer" && brief.visualDirection.value?.includes("minimal")) {
    const score = getCombinationScore(snapshot);
    if (score >= 5) {
      const ruleId = "DESIGN-BRIEF-003";
      const evidence = [`Combination score of ${score} indicates high decorative density`];
      const sortedEvidenceKey = evidence.slice().sort().join(";");
      const fp = crypto.createHash("sha256").update(`${ruleId}:${sortedEvidenceKey}`).digest("hex");
      
      findings.push({
        ruleId,
        category: "design-genericity",
        severity: "low",
        title: "Brief describes 'minimal' direction but implementation has high decorative density",
        whyItMatters: "The implemented UI contradicts the 'minimal' visual direction in the brief.",
        evidence,
        recommendation: "Remove unnecessary decorative patterns (gradients, orbs, excessive cards).",
        agentAction: "Simplify the UI by removing decorative gradients, orbs, and generic patterns.",
        fingerprint: fp,
      });
    }
  }

  return findings;
}
