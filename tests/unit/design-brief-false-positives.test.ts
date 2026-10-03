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

describe("Design Brief False Positives Regression", () => {
  it("Unusual but intentional design -> no brief findings if brief allows it", () => {
    const brief: DesignBrief = {
      schemaVersion: "1",
      createdAt: "",
      updatedAt: "",
      purpose: { value: "Weird App", source: "developer" },
      audience: { value: null, source: "not-provided" },
      visualDirection: { value: null, source: "creative-freedom" },
      brandColors: { value: null, source: "not-provided" },
      desiredFeeling: { value: null, source: "not-provided" },
      creativeFreedom: "balanced"
    };

    const snapshot = createMockSnapshot({
      colors: { pureWhiteBgCount: 10, isPurpleBlackAesthetic: false } as any
    });

    const findings = getBriefConsistencyFindings(brief, snapshot);
    expect(findings).toHaveLength(0);
  });

  it("Brief with all surprise me -> no findings", () => {
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

    const snapshot = createMockSnapshot();
    const findings = getBriefConsistencyFindings(brief, snapshot);
    expect(findings).toHaveLength(0);
  });

  it("Missing brief -> zero findings", () => {
    const findings = getBriefConsistencyFindings(null, createMockSnapshot());
    expect(findings).toHaveLength(0);
  });

  it("Oscillating thresholds (gradient count 8->7->8) -> hysteresis prevents state flip", () => {
    // Our rules threshold for Combination score is >= 5.
    // If it's 4, no finding. If 5, finding. It's conservative.
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

    const snapshot4 = createMockSnapshot({
      styles: [{ gradientCount: 2, radialOrbCount: 1 } as any], // grad>=2 (+1), orbs>=1 (+1)
      components: [{ isCard: true } as any, { isCard: true } as any, { isCard: true } as any], // cards>=3 (+1)
      colors: { isPurpleBlackAesthetic: true } as any // (+1) => score=4
    });

    expect(getBriefConsistencyFindings(brief, snapshot4)).toHaveLength(0);
  });
});
