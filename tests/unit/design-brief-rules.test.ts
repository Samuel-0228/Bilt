import { describe, it, expect } from "vitest";
import { getBriefConsistencyFindings } from "../../src/core/design/brief/rules.js";
import type { DesignBrief } from "../../src/core/design/brief/types.js";
import type { DesignSnapshot } from "../../src/core/design/types.js";

function createMockSnapshot(overrides: Partial<DesignSnapshot> = {}): DesignSnapshot {
  return {
    routes: [],
    components: [],
    styles: [],
    typography: {
      fontsDetected: [],
      hasInterGeistWithoutIntent: false,
      heroHeadingSizes: [],
      hasExcessiveBold: false,
      uppercaseEyebrowCount: 0,
      colonHeadingCount: 0,
      rhetoricalQuestionHeadingCount: 0
    },
    colors: {
      primaryColors: [],
      isPurpleBlackAesthetic: false,
      hasNeonColors: false,
      hasGenericPastelPalette: false,
      pureWhiteBgCount: 0,
      multiAccentCount: 0,
      lowContrastCount: 0
    },
    assets: [],
    interactions: [],
    copy: {
      genericSaaSCount: 0,
      genericPhrasesFound: [],
      adjectiveStackCount: 0,
      itIsNotXItIsYCount: 0,
      fakeTestimonialCount: 0,
      fakeCompanyCount: 0,
      fakeUrgencyCount: 0,
      emDashCount: 0,
      emojiCount: 0,
      loremIpsumCount: 0,
      featureMatrixCardOnlyCount: 0
    },
    uxStates: [],
    totalFilesScanned: 1,
    ...overrides
  };
}

describe("Design Brief Rules", () => {
  it("returns no findings if no brief", () => {
    const findings = getBriefConsistencyFindings(null, createMockSnapshot());
    expect(findings).toHaveLength(0);
  });

  it("returns no findings if creative freedom", () => {
    const brief: DesignBrief = {
      schemaVersion: "1",
      createdAt: "",
      updatedAt: "",
      purpose: { value: null, source: "creative-freedom" },
      audience: { value: null, source: "creative-freedom" },
      visualDirection: { value: null, source: "creative-freedom" },
      brandColors: { value: null, source: "creative-freedom" },
      desiredFeeling: { value: null, source: "creative-freedom" },
      creativeFreedom: "creative"
    };
    const findings = getBriefConsistencyFindings(brief, createMockSnapshot());
    expect(findings).toHaveLength(0);
  });

  it("fires DESIGN-BRIEF-001 if dark requested but light implemented", () => {
    const brief: DesignBrief = {
      schemaVersion: "1",
      createdAt: "",
      updatedAt: "",
      purpose: { value: null, source: "not-provided" },
      audience: { value: null, source: "not-provided" },
      visualDirection: { value: ["dark"], source: "developer" },
      brandColors: { value: null, source: "not-provided" },
      desiredFeeling: { value: null, source: "not-provided" },
      creativeFreedom: "guided"
    };
    
    const snapshot = createMockSnapshot({
      colors: {
        primaryColors: [],
        isPurpleBlackAesthetic: false,
        hasNeonColors: false,
        hasGenericPastelPalette: false,
        pureWhiteBgCount: 4,
        multiAccentCount: 0,
        lowContrastCount: 0
      }
    });

    const findings = getBriefConsistencyFindings(brief, snapshot);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("DESIGN-BRIEF-001");
  });

  it("fires DESIGN-BRIEF-002 if required brand color missing", () => {
    const brief: DesignBrief = {
      schemaVersion: "1",
      createdAt: "",
      updatedAt: "",
      purpose: { value: null, source: "not-provided" },
      audience: { value: null, source: "not-provided" },
      visualDirection: { value: null, source: "not-provided" },
      brandColors: { value: ["#ff0000"], source: "developer", type: "requirement" },
      desiredFeeling: { value: null, source: "not-provided" },
      creativeFreedom: "guided"
    };
    
    const snapshot = createMockSnapshot({
      colors: {
        primaryColors: ["#0000ff"],
        isPurpleBlackAesthetic: false,
        hasNeonColors: false,
        hasGenericPastelPalette: false,
        pureWhiteBgCount: 0,
        multiAccentCount: 0,
        lowContrastCount: 0
      }
    });

    const findings = getBriefConsistencyFindings(brief, snapshot);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("DESIGN-BRIEF-002");
  });

  it("fires DESIGN-BRIEF-003 if minimal requested but high density", () => {
    const brief: DesignBrief = {
      schemaVersion: "1",
      createdAt: "",
      updatedAt: "",
      purpose: { value: null, source: "not-provided" },
      audience: { value: null, source: "not-provided" },
      visualDirection: { value: ["minimal"], source: "developer" },
      brandColors: { value: null, source: "not-provided" },
      desiredFeeling: { value: null, source: "not-provided" },
      creativeFreedom: "guided"
    };
    
    const snapshot = createMockSnapshot({
      components: [
        { isCard: true } as any, { isCard: true } as any, { isCard: true } as any, // 3 cards -> +1
        { iconNames: ["Sparkle"] } as any // sparkles -> +1
      ],
      styles: [
        { gradientCount: 2, radialOrbCount: 1 } as any // gradients>=2 -> +1, orbs>=1 -> +1
      ],
      colors: {
        primaryColors: [],
        isPurpleBlackAesthetic: true, // +1
        hasNeonColors: false,
        hasGenericPastelPalette: false,
        pureWhiteBgCount: 0,
        multiAccentCount: 0,
        lowContrastCount: 0
      }
    });

    // Score: cards(1) + sparkes(1) + gradients(1) + orbs(1) + purpleBlack(1) = 5
    const findings = getBriefConsistencyFindings(brief, snapshot);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("DESIGN-BRIEF-003");
  });
});
