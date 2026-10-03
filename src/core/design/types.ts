// ─── Design Quality & Anti-Vibecoding Type Definitions ───────────────────────

export type DesignCategory =
  | "design-genericity"
  | "product-authenticity"
  | "ux-completeness"
  | "accessibility"
  | "content-quality"
  | "production-ux";

export type DesignSeverity = "low" | "medium" | "high";

export interface DesignFinding {
  ruleId: string;
  category: DesignCategory;
  severity: DesignSeverity;
  title: string;
  whyItMatters: string;
  evidence: string[];
  recommendation: string;
  agentAction: string;
  fingerprint: string;
  file?: string;
  line?: number;
  endLine?: number;
  fixable?: boolean;
}

export interface SuppressedDesignFinding {
  ruleId: string;
  category: DesignCategory;
  severity: DesignSeverity;
  title: string;
  reason: string;
  file?: string;
}

// ─── Intermediate Representation (DesignSnapshot) ───────────────────────────

export interface RouteSnapshot {
  path: string;
  file: string;
  type: "marketing" | "app" | "auth" | "legal" | "api" | "unknown";
  hasLoadingState?: boolean;
  hasErrorState?: boolean;
  hasEmptyState?: boolean;
}

export interface ComponentSnapshot {
  name: string;
  file: string;
  line: number;
  tag: string;
  isCard?: boolean;
  isButton?: boolean;
  isNavbar?: boolean;
  isHero?: boolean;
  isTestimonial?: boolean;
  isTerminalMockup?: boolean;
  isBentoGrid?: boolean;
  isMarquee?: boolean;
  isFeatureMatrix?: boolean;
  isDemo?: boolean;
  isMockup?: boolean;
  isPill?: boolean;
  isThreeColumnSection?: boolean;
  hasIcon?: boolean;
  iconNames: string[];
  hasLoadingState?: boolean;
  hasErrorState?: boolean;
  hasEmptyState?: boolean;
  hasSuccessState?: boolean;
  hasDisabledState?: boolean;
  hasAriaLabel?: boolean;
  hasAltAttribute?: boolean;
  hasOutlineNoneWithoutFocusVisible?: boolean;
  interactiveTargetSize?: "normal" | "tiny";
  cardNestingDepth?: number;
  classes: string[];
  rawText: string;
}

export interface StyleSnapshot {
  file: string;
  gradientCount: number;
  harshGradientCount: number;
  purpleBlueGradientCount: number;
  rainbowGradientCount: number;
  gradientTextCount: number;
  gradientButtonCount: number;
  gradientBorderCount: number;
  shadowCount: number;
  excessiveShadowCount: number;
  blurCount: number;
  glassmorphismCount: number;
  glowCount: number;
  softRadiusCount: number;
  extremeRadiusCount: number;
  pillButtonCount: number;
  noiseTextureCount: number;
  dotGridCount: number;
  radialOrbCount: number;
  decorativeBlobCount: number;
  squigglesCount: number;
  hasReducedMotion: boolean;
  outlineNoneWithoutFocusVisibleCount: number;
}

export interface TypographySnapshot {
  fontsDetected: string[];
  hasInterGeistWithoutIntent: boolean;
  heroHeadingSizes: number[];
  hasExcessiveBold: boolean;
  uppercaseEyebrowCount: number;
  colonHeadingCount: number;
  rhetoricalQuestionHeadingCount: number;
}

export interface ColorSnapshot {
  primaryColors: string[];
  isPurpleBlackAesthetic: boolean;
  hasNeonColors: boolean;
  hasGenericPastelPalette: boolean;
  pureWhiteBgCount: number;
  multiAccentCount: number;
  lowContrastCount: number;
}

export interface AssetSnapshot {
  file: string;
  images: Array<{
    src: string;
    alt?: string;
    isStock?: boolean;
    isAiRobotOrBlob?: boolean;
    isScreenshot?: boolean;
  }>;
  hasTos: boolean;
  hasPrivacyPolicy: boolean;
  has404Page: boolean;
}

export interface InteractionSnapshot {
  file: string;
  hoverAnimationCount: number;
  excessiveScaleHoverCount: number;
  buttonHoverMoveCount: number;
  cardFloatHoverCount: number;
  cursorFollowerCount: number;
  scrollAnimationCount: number;
  parallaxCount: number;
  animatedGradientCount: number;
  infiniteMarqueeCount: number;
  textRevealCount: number;
  fakeTypingCount: number;
  fakeCounterCount: number;
  fakeProgressBarCount: number;
  fakeLiveIndicatorCount: number;
  fakeOnlineUsersCount: number;
  fakeToastsCount: number;
}

export interface CopySnapshot {
  genericSaaSCount: number;
  genericPhrasesFound: string[];
  adjectiveStackCount: number;
  itIsNotXItIsYCount: number;
  fakeTestimonialCount: number;
  fakeCompanyCount: number;
  fakeUrgencyCount: number;
  emDashCount: number;
  emojiCount: number;
  loremIpsumCount: number;
  featureMatrixCardOnlyCount: number;
}

export interface UXStateSnapshot {
  file: string;
  missingLoadingCount: number;
  missingEmptyCount: number;
  missingErrorCount: number;
  missingSuccessCount: number;
  missingDisabledCount: number;
  missingFormValidationCount: number;
  missingMobileNav: boolean;
  missingFocusStylesCount: number;
  missingA11yIconCount: number;
  destructiveWithoutConfirmCount: number;
  emptyDashboardCount: number;
  deadLinkCtaCount: number;
}

export function getInteractionTotals(snapshot: DesignSnapshot): InteractionSnapshot {
  const totals: InteractionSnapshot = {
    file: "aggregated",
    hoverAnimationCount: 0,
    excessiveScaleHoverCount: 0,
    buttonHoverMoveCount: 0,
    cardFloatHoverCount: 0,
    cursorFollowerCount: 0,
    scrollAnimationCount: 0,
    parallaxCount: 0,
    animatedGradientCount: 0,
    infiniteMarqueeCount: 0,
    textRevealCount: 0,
    fakeTypingCount: 0,
    fakeCounterCount: 0,
    fakeProgressBarCount: 0,
    fakeLiveIndicatorCount: 0,
    fakeOnlineUsersCount: 0,
    fakeToastsCount: 0,
  };
  for (const i of snapshot.interactions) {
    totals.hoverAnimationCount += i.hoverAnimationCount;
    totals.excessiveScaleHoverCount += i.excessiveScaleHoverCount;
    totals.buttonHoverMoveCount += i.buttonHoverMoveCount;
    totals.cardFloatHoverCount += i.cardFloatHoverCount;
    totals.cursorFollowerCount += i.cursorFollowerCount;
    totals.scrollAnimationCount += i.scrollAnimationCount;
    totals.parallaxCount += i.parallaxCount;
    totals.animatedGradientCount += i.animatedGradientCount;
    totals.infiniteMarqueeCount += i.infiniteMarqueeCount;
    totals.textRevealCount += i.textRevealCount;
    totals.fakeTypingCount += i.fakeTypingCount;
    totals.fakeCounterCount += i.fakeCounterCount;
    totals.fakeProgressBarCount += i.fakeProgressBarCount;
    totals.fakeLiveIndicatorCount += i.fakeLiveIndicatorCount;
    totals.fakeOnlineUsersCount += i.fakeOnlineUsersCount;
    totals.fakeToastsCount += i.fakeToastsCount;
  }
  return totals;
}

export function getUXStateTotals(snapshot: DesignSnapshot): UXStateSnapshot {
  const totals: UXStateSnapshot = {
    file: "aggregated",
    missingLoadingCount: 0,
    missingEmptyCount: 0,
    missingErrorCount: 0,
    missingSuccessCount: 0,
    missingDisabledCount: 0,
    missingFormValidationCount: 0,
    missingMobileNav: false,
    missingFocusStylesCount: 0,
    missingA11yIconCount: 0,
    destructiveWithoutConfirmCount: 0,
    emptyDashboardCount: 0,
    deadLinkCtaCount: 0,
  };
  for (const u of snapshot.uxStates) {
    totals.missingLoadingCount += u.missingLoadingCount;
    totals.missingEmptyCount += u.missingEmptyCount;
    totals.missingErrorCount += u.missingErrorCount;
    totals.missingSuccessCount += u.missingSuccessCount;
    totals.missingDisabledCount += u.missingDisabledCount;
    totals.missingFormValidationCount += u.missingFormValidationCount;
    if (u.missingMobileNav) totals.missingMobileNav = true;
    totals.missingFocusStylesCount += u.missingFocusStylesCount;
    totals.missingA11yIconCount += u.missingA11yIconCount;
    totals.destructiveWithoutConfirmCount += u.destructiveWithoutConfirmCount;
    totals.emptyDashboardCount += u.emptyDashboardCount;
    totals.deadLinkCtaCount += u.deadLinkCtaCount;
  }
  return totals;
}

export interface DesignSnapshot {
  framework?: string;
  routes: RouteSnapshot[];
  components: ComponentSnapshot[];
  styles: StyleSnapshot[];
  typography: TypographySnapshot;
  colors: ColorSnapshot;
  assets: AssetSnapshot[];
  interactions: InteractionSnapshot[];
  copy: CopySnapshot;
  uxStates: UXStateSnapshot[];
  totalFilesScanned: number;
}

// ─── Rule Interface ──────────────────────────────────────────────────────────

export interface DesignRuleCheckResult {
  matches: boolean;
  evidence: string[];
  file?: string;
  line?: number;
  endLine?: number;
  fixable?: boolean;
}

export interface DesignRule {
  id: string;
  category: DesignCategory;
  severity: DesignSeverity;
  title: string;
  whyItMatters: string;
  recommendation: string;
  agentAction: string;
  check: (snapshot: DesignSnapshot) => DesignRuleCheckResult[];
}

// ─── Configuration & Options ─────────────────────────────────────────────────

export interface DesignCheckConfig {
  ignore?: string[];
  reason?: Record<string, string>;
  ignoreAll?: boolean;
}

export interface DesignCheckOptions {
  dir?: string;
  format?: "human" | "agent" | "json";
  fix?: boolean;
  changed?: boolean;
  base?: string;
  maxIterations?: number;
  debug?: boolean;
}

export interface DesignCheckSummary {
  patternsDetected: number;
  high: number;
  medium: number;
  low: number;
  suppressed: number;
}

export interface DesignCheckResult {
  schemaVersion: "1";
  status: "pass" | "needs-improvement" | "escalate";
  summary: DesignCheckSummary;
  findings: DesignFinding[];
  suppressed: SuppressedDesignFinding[];
  escalationMessage?: string;
  iteration: number;
  fixedCount?: number;
  rawSnapshot?: DesignSnapshot;
  timingMs?: Record<string, number>;
}
