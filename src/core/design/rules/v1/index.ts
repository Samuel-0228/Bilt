// ─── Design Quality & Anti-Vibecoding Rule Catalog (v1) ───────────────────────
// Versioned rules evaluating normalized DesignSnapshot intermediate representations.
// Deterministic static analysis; no external LLM execution.
// Pure functions only.
// ─────────────────────────────────────────────────────────────────────────────

import type { DesignRule, DesignSnapshot, DesignRuleCheckResult } from "../../types.js";
import { getInteractionTotals, getUXStateTotals } from "../../types.js";

export const RULE_CATALOG_VERSION = "v1";

export const DESIGN_RULES_V1: DesignRule[] = [
  // ─── Combinations (design-genericity) ───────────────────────────────────────
  {
    id: "GENERIC-SAAS-COMBINATION-001",
    category: "design-genericity",
    severity: "high",
    title: "High concentration of recognizable SaaS template patterns",
    whyItMatters:
      "Individually, rounded cards, gradients, or sparkle icons are normal design elements. However, stacking them together creates an unmistakably generic, interchangeable template look commonly associated with AI vibecoding.",
    recommendation:
      "Replace at least two decorative template patterns with product-specific visual elements: real product screenshots, domain diagrams, or authentic user workflow states.",
    agentAction:
      "Audit the hero and feature sections. Replace generic decorative gradients and radial orbs with authentic product UI previews or domain-specific data representations.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const evidence: string[] = [];
      const totalCards = snapshot.components.filter((c) => c.isCard).length;
      const totalGradients = snapshot.styles.reduce((sum, s) => sum + s.gradientCount, 0);
      const totalRadialOrbs = snapshot.styles.reduce((sum, s) => sum + s.radialOrbCount, 0);
      const totalSparkles = snapshot.components.reduce(
        (sum, c) => sum + c.iconNames.filter((i) => i.includes("Sparkle") || i.includes("Wand")).length,
        0,
      );
      const hasThreeColumn = snapshot.components.some((c) => c.isThreeColumnSection);
      const hasGenericCopy = snapshot.copy.genericSaaSCount > 0;
      const isPurpleBlack = snapshot.colors.isPurpleBlackAesthetic;
      const hasBento = snapshot.components.some((c) => c.isBentoGrid);

      if (totalCards >= 3) evidence.push(`${totalCards} rounded container cards`);
      if (totalGradients >= 2) evidence.push(`${totalGradients} decorative gradients`);
      if (totalRadialOrbs >= 1) evidence.push(`${totalRadialOrbs} radial background orbs`);
      if (totalSparkles >= 1) evidence.push(`${totalSparkles} generic sparkle/AI icons`);
      if (hasThreeColumn) evidence.push("repetitive three-column feature cards");
      if (hasGenericCopy) evidence.push(`generic marketing copy (${snapshot.copy.genericPhrasesFound.slice(0, 2).join(", ")})`);
      if (isPurpleBlack) evidence.push("purple-on-black default SaaS color scheme");
      if (hasBento) evidence.push("bento grid composition");

      // Triggers when 4 or more recognizable patterns co-occur
      if (evidence.length >= 4) {
        return [{ matches: true, evidence }];
      }
      return [];
    },
  },

  {
    id: "VIBECODED-LANDING-PAGE-001",
    category: "design-genericity",
    severity: "medium",
    title: "Template-heavy landing page composition",
    whyItMatters:
      "Landing pages following the formulaic 'Eyebrow → Giant Heading → 2 CTA Pill Buttons → 3 Feature Cards → Fake Testimonial' lack distinctive brand identity and make the product appear artificial.",
    recommendation:
      "Restructure the landing page to feature the actual product workflow immediately. Anchor the value proposition in concrete product mechanics rather than generic marketing slogans.",
    agentAction:
      "Introduce real product interaction states or interactive previews directly into the hero section.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const evidence: string[] = [];
      const interactions = getInteractionTotals(snapshot);
      if (snapshot.typography.heroHeadingSizes.length > 0) evidence.push("giant 64px+ hero heading");
      if (snapshot.typography.uppercaseEyebrowCount >= 2) evidence.push(`${snapshot.typography.uppercaseEyebrowCount} uppercase eyebrow labels`);
      if (snapshot.copy.fakeTestimonialCount > 0) evidence.push("unverified testimonial placeholders");
      if (interactions.fakeTypingCount > 0) evidence.push("decorative simulated terminal window");
      if (snapshot.copy.genericSaaSCount >= 2) evidence.push("formulaic slogan headings");

      if (evidence.length >= 3) {
        return [{ matches: true, evidence }];
      }
      return [];
    },
  },

  {
    id: "DECORATION-OVERLOAD-001",
    category: "design-genericity",
    severity: "medium",
    title: "Excessive decorative visual elements without functional purpose",
    whyItMatters:
      "Stacking decorative blobs, floating cards, squiggles, and glowing borders creates visual noise that distracts users from the product's actual purpose.",
    recommendation:
      "Remove non-functional decorative artifacts. Rely on deliberate typographic hierarchy, proportional whitespace, and functional contrast to structure the page.",
    agentAction:
      "Eliminate background blobs, floating decorative cards, and glow effects that do not represent interactive states.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const totalBlobs = snapshot.styles.reduce((sum, s) => sum + s.decorativeBlobCount, 0);
      const totalGlow = snapshot.styles.reduce((sum, s) => sum + s.glowCount, 0);
      const totalSquiggles = snapshot.styles.reduce((sum, s) => sum + s.squigglesCount, 0);
      const interactions = getInteractionTotals(snapshot);
      const totalFloatCards = interactions.cardFloatHoverCount;

      const evidence: string[] = [];
      if (totalBlobs >= 2) evidence.push(`${totalBlobs} blurred decorative background blobs`);
      if (totalGlow >= 2) evidence.push(`${totalGlow} artificial glow drop-shadows`);
      if (totalSquiggles >= 1) evidence.push(`${totalSquiggles} decorative squiggles/lines`);
      if (totalFloatCards >= 2) evidence.push(`${totalFloatCards} floating hover elements`);

      if (evidence.length >= 2) {
        return [{ matches: true, evidence }];
      }
      return [];
    },
  },

  // ─── Visual Patterns (design-genericity) ───────────────────────────────────
  {
    id: "DESIGN-VISUAL-001",
    category: "design-genericity",
    severity: "medium",
    title: "Excessive gradient saturation across headings and buttons",
    whyItMatters:
      "Widespread use of multi-stop or clip-text gradients across headings, buttons, and borders diminishes visual hierarchy and looks like a generic landing page template.",
    recommendation:
      "Reserve gradients for subtle accentuation, or use solid semantic colors aligned with the product's primary visual identity.",
    agentAction:
      "Replace text-clip and button gradients with solid high-contrast brand colors.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const gradTexts = snapshot.styles.reduce((s, st) => s + st.gradientTextCount, 0);
      const gradBtns = snapshot.styles.reduce((s, st) => s + st.gradientButtonCount, 0);
      const gradBorders = snapshot.styles.reduce((s, st) => s + st.gradientBorderCount, 0);

      if (gradTexts + gradBtns + gradBorders >= 3) {
        return [
          {
            matches: true,
            evidence: [
              `${gradTexts} gradient text headings`,
              `${gradBtns} gradient CTA buttons`,
              `${gradBorders} gradient borders`,
            ],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-VISUAL-002",
    category: "design-genericity",
    severity: "low",
    title: "Default purple-on-dark SaaS aesthetic",
    whyItMatters:
      "The combination of near-black backgrounds (#09090b) with purple/violet (#8b5cf6) glows and accents has become the default aesthetic of AI-generated web apps.",
    recommendation:
      "Choose a color palette derived from your product's specific problem space (e.g. data-dense slate, warm editorial ochre, industrial amber, or clean corporate indigo).",
    agentAction:
      "Explore non-default accent tones that uniquely signify the product's domain rather than template defaults.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      if (snapshot.colors.isPurpleBlackAesthetic) {
        return [
          {
            matches: true,
            evidence: ["Dark background paired with purple/violet accent glow"],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-VISUAL-003",
    category: "design-genericity",
    severity: "medium",
    title: "Excessive glassmorphism and backdrop-blur nesting",
    whyItMatters:
      "Translucent frosted glass cards placed on top of other frosted glass layers cause legibility issues and performance penalties on low-powered mobile devices.",
    recommendation:
      "Use solid surface colors with subtle borders or gentle tonal shifts rather than heavy backdrop-blur filters.",
    agentAction:
      "Replace nested backdrop-blur cards with solid background surfaces.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const glassCount = snapshot.styles.reduce((s, st) => s + st.glassmorphismCount, 0);
      if (glassCount >= 3) {
        return [
          {
            matches: true,
            evidence: [`${glassCount} glassmorphism elements with backdrop-blur and translucent backgrounds`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-VISUAL-004",
    category: "design-genericity",
    severity: "low",
    title: "Extreme corner radius on all containers",
    whyItMatters:
      "Applying extreme rounded corners (rounded-3xl or rounded-full) to every card, modal, and container produces a puffy, toy-like appearance unsuitable for professional tools.",
    recommendation:
      "Calibrate border radius purposefully. Standard enterprise interfaces typically use 6px to 12px (rounded-md to rounded-lg) for crisp container definition.",
    agentAction:
      "Reduce container border radii from rounded-3xl/full to standard rounded-lg or rounded-xl.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const extremeRadius = snapshot.styles.reduce((s, st) => s + st.extremeRadiusCount, 0);
      if (extremeRadius >= 4) {
        return [
          {
            matches: true,
            evidence: [`${extremeRadius} containers configured with extreme rounded-3xl or 30px+ radii`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-VISUAL-005",
    category: "design-genericity",
    severity: "medium",
    title: "Generic AI sparkle and wand icon decorations",
    whyItMatters:
      "Sprinkling Sparkles, Wand, and Brain icons across non-AI product capabilities has become an AI template trope that conveys little practical meaning to users.",
    recommendation:
      "Reserve icons for actions or entities where visual symbols assist navigation. Replace decorative sparkles with meaningful domain iconography or concise text.",
    agentAction:
      "Remove gratuitous sparkle and wand icons from feature headlines and list items.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const sparkleIcons = snapshot.components.flatMap((c) =>
        c.iconNames.filter((name) => /Sparkle|Wand|Brain/i.test(name)),
      );
      if (sparkleIcons.length >= 2) {
        return [
          {
            matches: true,
            evidence: [`${sparkleIcons.length} decorative sparkle/wand icons detected (${sparkleIcons.join(", ")})`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-VISUAL-006",
    category: "design-genericity",
    severity: "low",
    title: "Dot-grid and background noise texture overuse",
    whyItMatters:
      "Synthetic dot-grid patterns and SVG noise textures are ubiquitous in AI demo templates and frequently conflict with text contrast and content clarity.",
    recommendation:
      "Use clean background fields or structural borders to frame content. If subtle texture is required, restrict it to specialized header or footer areas.",
    agentAction:
      "Remove repetitive dot-grid and noise overlays from primary reading areas.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const dotGrids = snapshot.styles.reduce((s, st) => s + st.dotGridCount, 0);
      const noises = snapshot.styles.reduce((s, st) => s + st.noiseTextureCount, 0);
      if (dotGrids + noises >= 2) {
        return [
          {
            matches: true,
            evidence: [
              dotGrids > 0 ? `${dotGrids} dot-grid backgrounds` : "",
              noises > 0 ? `${noises} noise texture overlays` : "",
            ].filter(Boolean),
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-VISUAL-007",
    category: "design-genericity",
    severity: "low",
    title: "Unconstrained neon or pastel color accents",
    whyItMatters:
      "Employing uncalibrated high-saturation neon accents (#00ffxx, #ff00ff) or generic pastel grids purely because they look futuristic reduces contrast and visual authority.",
    recommendation:
      "Anchor accent colors to domain semantics (e.g. status tokens, data categories) with calibrated contrast ratios.",
    agentAction:
      "Replace arbitrary neon highlights with deliberate accessible brand accents.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      if (snapshot.colors.hasNeonColors || snapshot.colors.hasGenericPastelPalette) {
        return [
          {
            matches: true,
            evidence: [
              snapshot.colors.hasNeonColors ? "High-saturation neon colors detected" : "",
              snapshot.colors.hasGenericPastelPalette ? "Generic multi-pastel palette detected" : "",
            ].filter(Boolean),
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-VISUAL-008",
    category: "design-genericity",
    severity: "low",
    title: "Pure unmodulated white backgrounds without structural hierarchy",
    whyItMatters:
      "Using pure #ffffff backgrounds across every container without subtle borders, surface cards, or elevation produces an unfinished, unmodulated interface.",
    recommendation:
      "Introduce subtle neutral surface tones (e.g., slate-50, zinc-50) and light structural border lines to frame content areas.",
    agentAction:
      "Add surface backgrounds or crisp boundary borders to separate content sections.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      if (snapshot.colors.pureWhiteBgCount >= 4) {
        return [
          {
            matches: true,
            evidence: [`${snapshot.colors.pureWhiteBgCount} container sections using pure unmodulated white backgrounds`],
          },
        ];
      }
      return [];
    },
  },

  // ─── Layout Patterns (design-genericity) ───────────────────────────────────
  {
    id: "DESIGN-LAYOUT-001",
    category: "design-genericity",
    severity: "medium",
    title: "Formulaic three-column feature cards",
    whyItMatters:
      "Repeating identical 3-column card grids for all product features suggests template filling rather than deliberate information architecture tailored to actual product mechanics.",
    recommendation:
      "Consider whether this information needs a card at all. Use hierarchy, whitespace, typography, tables, timelines, lists, or direct interaction when those structures communicate more naturally.",
    agentAction:
      "Refactor uniform 3-card grids into diverse layouts (e.g. side-by-side workflow previews, data tables, or sequential steps).",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const threeColSections = snapshot.components.filter((c) => c.isThreeColumnSection).length;
      if (threeColSections >= 2) {
        return [
          {
            matches: true,
            evidence: [`${threeColSections} distinct sections using uniform 3-column card layouts`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-LAYOUT-002",
    category: "design-genericity",
    severity: "medium",
    title: "Excessive container and card nesting",
    whyItMatters:
      "Nesting cards inside cards inside cards (Page → Section → Card → Nested Card) creates clutter, shrinks readable content space, and signals template composition.",
    recommendation:
      "Flatter visual hierarchy. Remove intermediate container boundaries and use whitespace or subtle dividers instead of enclosing boxes.",
    agentAction:
      "Flatten deeply nested container divs into direct content blocks.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const deeplyNested = snapshot.components.filter((c) => (c.cardNestingDepth || 0) >= 3);
      if (deeplyNested.length > 0) {
        return deeplyNested.map((c) => ({
          matches: true,
          evidence: [`Card nesting depth of ${c.cardNestingDepth} in ${c.file}`],
          file: c.file,
        }));
      }
      return [];
    },
  },

  {
    id: "DESIGN-LAYOUT-003",
    category: "design-genericity",
    severity: "low",
    title: "All buttons styled as identical pill shapes",
    whyItMatters:
      "Applying rounded-full pill styling to every action button without hierarchy flattens semantic priority between primary, secondary, and tertiary controls.",
    recommendation:
      "Differentiate primary calls to action with distinct sizing, subtle rectangular geometry, or contextual positioning.",
    agentAction:
      "Limit pill buttons to badges or filter chips; use purposeful button geometry for core actions.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const pillButtons = snapshot.styles.reduce((s, st) => s + st.pillButtonCount, 0);
      if (pillButtons >= 4) {
        return [
          {
            matches: true,
            evidence: [`${pillButtons} buttons using identical rounded-full pill styling`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-LAYOUT-004",
    category: "design-genericity",
    severity: "low",
    title: "Decorative simulated terminal window mockup",
    whyItMatters:
      "Displaying a simulated macOS terminal window with fake npm install commands as the primary hero image is a pervasive developer-tool cliché that adds no functional understanding.",
    recommendation:
      "Display actual functional code snippets, real API responses, or live interactive playground controls instead of static terminal graphics.",
    agentAction:
      "Replace simulated terminal graphic with interactive code snippet or actual terminal component.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const terminalComponents = snapshot.components.filter((c) => c.isTerminalMockup);
      if (terminalComponents.length > 0) {
        return [
          {
            matches: true,
            evidence: [`Simulated terminal mockup detected in ${terminalComponents.map((c) => c.file).join(", ")}`],
          },
        ];
      }
      return [];
    },
  },

  // ─── Typography (design-genericity) ─────────────────────────────────────────
  {
    id: "DESIGN-TYPOGRAPHY-001",
    category: "design-genericity",
    severity: "low",
    title: "Unintentional typography default (Inter/Geist without scale)",
    whyItMatters:
      "Relying exclusively on default sans-serif web fonts without intentional hierarchy, scale, or paired monospace/serif fonts produces an anonymous aesthetic.",
    recommendation:
      "Establish an intentional typographic system with proportional leading, distinct font weights, and domain-appropriate font selection.",
    agentAction:
      "Pair body copy with a distinctive heading typeface or establish clear proportional scale variables.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      if (snapshot.typography.hasInterGeistWithoutIntent) {
        return [
          {
            matches: true,
            evidence: [
              `Fonts detected: ${snapshot.typography.fontsDetected.join(", ")} without complementary type pairing`,
            ],
          },
        ];
      }
      return [];
    },
  },

  // ─── Interaction Patterns (design-genericity) ──────────────────────────────
  {
    id: "DESIGN-INTERACTION-001",
    category: "design-genericity",
    severity: "medium",
    title: "Excessive hover scale and micro-movement animations",
    whyItMatters:
      "Applying scale-105 transforms and upward floats to every card and button creates a dizzying experience and causes layout jitter on touchscreens.",
    recommendation:
      "Use subtle color or border-intensity transitions for hover feedback rather than spatial displacement.",
    agentAction:
      "Remove hover:scale-105 and hover:-translate-y from static content cards.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const interactions = getInteractionTotals(snapshot);
      const hoverScales = interactions.excessiveScaleHoverCount;
      const hoverMoves = interactions.buttonHoverMoveCount + interactions.cardFloatHoverCount;
      if (hoverScales + hoverMoves >= 4) {
        return [
          {
            matches: true,
            evidence: [
              `${hoverScales} elements using hover:scale-105+`,
              `${hoverMoves} elements moving/translating on hover`,
            ],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-INTERACTION-002",
    category: "design-genericity",
    severity: "low",
    title: "Infinite logo marquee used purely for filler",
    whyItMatters:
      "Continuously scrolling marquee bars often disguise a lack of authentic social proof or meaningful content.",
    recommendation:
      "Display verified integrations or partners in a static, responsive grid with clear documentation links.",
    agentAction:
      "Replace continuous marquee animation with a clean static integration grid.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const interactions = getInteractionTotals(snapshot);
      if (interactions.infiniteMarqueeCount >= 1) {
        return [
          {
            matches: true,
            evidence: [`${interactions.infiniteMarqueeCount} animated infinite marquee ticker(s)`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-INTERACTION-003",
    category: "design-genericity",
    severity: "low",
    title: "Simulated progress bar or artificial counter animation",
    whyItMatters:
      "Hardcoded count-up tickers (e.g. '0 to 10,000 in 2s') or decorative progress bars unlinked to actual backend data degrade user trust.",
    recommendation:
      "Connect metric counters to real application statistics or display static verified numbers.",
    agentAction:
      "Link counters to real telemetry or replace with static verified metrics.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const interactions = getInteractionTotals(snapshot);
      if (interactions.fakeCounterCount > 0 || interactions.fakeProgressBarCount > 0) {
        return [
          {
            matches: true,
            evidence: [
              interactions.fakeCounterCount > 0 ? `${interactions.fakeCounterCount} artificial count-up animation(s)` : "",
              interactions.fakeProgressBarCount > 0 ? `${interactions.fakeProgressBarCount} simulated progress bar(s)` : "",
            ].filter(Boolean),
          },
        ];
      }
      return [];
    },
  },

  // ─── Content Quality (content-quality) ─────────────────────────────────────
  {
    id: "CONTENT-QUALITY-001",
    category: "content-quality",
    severity: "medium",
    title: "Concentration of generic AI marketing slogans",
    whyItMatters:
      "Headings like 'Supercharge your workflow' or 'The future of productivity' offer zero information about what the software actually does, eroding user trust.",
    recommendation:
      "Replace marketing cliches with concrete descriptions of the product's actual domain, core operations, and supported workflows.",
    agentAction:
      "Rewrite headings to explicitly describe the concrete problem solved and the target user.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      if (snapshot.copy.genericSaaSCount >= 2) {
        return [
          {
            matches: true,
            evidence: snapshot.copy.genericPhrasesFound.map((p) => `Generic phrase: "${p}"`),
          },
        ];
      }
      return [];
    },
  },

  {
    id: "CONTENT-QUALITY-002",
    category: "content-quality",
    severity: "low",
    title: "AI adjective stacking ('powerful, seamless, intelligent')",
    whyItMatters:
      "Stringing together buzzwords ('powerful, seamless, and intelligent') is a trademark artifact of LLM text generation that fails to convince discerning users.",
    recommendation:
      "State specific verifiable metrics or technical attributes instead of abstract superlatives.",
    agentAction:
      "Replace adjective lists with clear factual statements describing capabilities.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      if (snapshot.copy.adjectiveStackCount >= 2) {
        return [
          {
            matches: true,
            evidence: [`${snapshot.copy.adjectiveStackCount} instances of stacked marketing adjectives detected`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "CONTENT-QUALITY-003",
    category: "content-quality",
    severity: "medium",
    title: "Placeholder or unverified customer testimonials",
    whyItMatters:
      "Stock testimonials featuring generic titles like 'CEO at TechCorp' or 'John D.' damage credibility and indicate placeholder marketing copy.",
    recommendation:
      "Either include verified customer case studies with verifiable details, or replace testimonial sections with real product documentation, community stats, or live metrics.",
    agentAction:
      "Remove placeholder testimonials or replace with verifiable project metrics.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      if (snapshot.copy.fakeTestimonialCount > 0) {
        return [
          {
            matches: true,
            evidence: [`${snapshot.copy.fakeTestimonialCount} placeholder customer testimonials detected`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "CONTENT-QUALITY-004",
    category: "content-quality",
    severity: "low",
    title: "Formulaic 'It's not X, it's Y' contrast copy",
    whyItMatters:
      "Relying on artificial antithesis formulas ('It's not just a tool, it's an ecosystem') is an overused copywriting template that feels derivative.",
    recommendation:
      "Describe the product's actual architecture, capabilities, and workflows in direct, authentic terms.",
    agentAction:
      "Rewrite contrasting copy formulas into direct, informative descriptions.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      if (snapshot.copy.itIsNotXItIsYCount > 0) {
        return [
          {
            matches: true,
            evidence: [`${snapshot.copy.itIsNotXItIsYCount} formulaic 'It's not X, it's Y' phrase(s) detected`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "CONTENT-QUALITY-005",
    category: "content-quality",
    severity: "low",
    title: "Manufactured urgency or exaggerated claims",
    whyItMatters:
      "Phrases like 'Your workflow will never be the same' or 'The only tool you'll ever need' diminish credibility.",
    recommendation:
      "Ground marketing copy in measurable technical advantages and clear product capabilities.",
    agentAction:
      "Remove artificial urgency claims and replace with verifiable product capabilities.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      if (snapshot.copy.fakeUrgencyCount > 0) {
        return [
          {
            matches: true,
            evidence: [`${snapshot.copy.fakeUrgencyCount} manufactured urgency claim(s) detected`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "CONTENT-QUALITY-006",
    category: "content-quality",
    severity: "low",
    title: "Excessive decorative emoji usage in interface copy",
    whyItMatters:
      "Sprinkling emojis (🚀, ✨, 🔥, 💡) across headings and buttons produces an informal, toy-like appearance unsuitable for production software.",
    recommendation:
      "Replace emojis with accessible SVG icons or deliberate typographic emphasis.",
    agentAction:
      "Remove decorative emojis from headings and navigation labels.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      if (snapshot.copy.emojiCount >= 6) {
        return [
          {
            matches: true,
            evidence: [`${snapshot.copy.emojiCount} decorative emojis detected across interface copy`],
          },
        ];
      }
      return [];
    },
  },

  // ─── Product Authenticity (product-authenticity) ───────────────────────────
  {
    id: "DESIGN-AUTHENTICITY-001",
    category: "product-authenticity",
    severity: "high",
    title: "Marketing interface does not appear to represent the actual product",
    whyItMatters:
      "Landing pages that showcase decorative mockups, fake terminal typing, or placeholder screenshots without showing the actual application UI mislead users.",
    recommendation:
      "Incorporate authentic screenshots, code samples, interactive sandboxes, or actual component states directly from the application codebase.",
    agentAction:
      "Replace decorative mockups with authentic product interface snapshots or live interactive component demos.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const evidence: string[] = [];
      const interactions = getInteractionTotals(snapshot);
      const hasTerminal = interactions.fakeTypingCount > 0;
      const hasScreenshots = snapshot.assets.some((a) => a.images.some((img) => img.isScreenshot));
      const hasMarketing = snapshot.routes.some((r) => r.type === "marketing");

      if (hasTerminal) evidence.push("simulated terminal window with non-functional command output");
      if (interactions.fakeLiveIndicatorCount > 0) evidence.push("simulated fake live status indicators");
      if (interactions.fakeCounterCount > 0) evidence.push("unconnected metric counter animation");
      if (hasMarketing && !hasScreenshots && snapshot.assets.every((a) => a.images.length === 0)) {
        evidence.push("landing page contains no authentic application screenshots or previews");
      }

      if (evidence.length >= 2) {
        return [{ matches: true, evidence }];
      }
      return [];
    },
  },

  {
    id: "DESIGN-AUTHENTICITY-002",
    category: "product-authenticity",
    severity: "medium",
    title: "Primary Call-to-Action buttons lead to dead links",
    whyItMatters:
      "Landing page CTA buttons pointing to '#' or empty callback handlers break user flows and demonstrate incomplete implementation.",
    recommendation:
      "Connect primary buttons to working authentication routes, application views, or functional registration dialogs.",
    agentAction:
      "Update button href/onClick attributes to navigate to real application routes.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const uxStates = getUXStateTotals(snapshot);
      if (uxStates.deadLinkCtaCount > 0) {
        return [
          {
            matches: true,
            evidence: [`${uxStates.deadLinkCtaCount} call-to-action buttons configured with '#' or empty onClick handlers`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-AUTHENTICITY-003",
    category: "product-authenticity",
    severity: "medium",
    title: "Placeholder company names used in social proof and brand logos",
    whyItMatters:
      "Displaying fictional placeholder companies ('Acme Corp', 'TechCorp', 'StartupX', 'Initech') damages trust and signals unverified template copy.",
    recommendation:
      "Either display verified partner or customer logos, or replace the logo strip with concrete product architectural highlights or community stats.",
    agentAction:
      "Remove placeholder brand names and replace with authentic customer references or open source stats.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      if (snapshot.copy.fakeCompanyCount > 0) {
        return [
          {
            matches: true,
            evidence: [`${snapshot.copy.fakeCompanyCount} placeholder company name(s) detected in copy/logos`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "DESIGN-AUTHENTICITY-004",
    category: "product-authenticity",
    severity: "low",
    title: "Simulated live visitor or activity indicators",
    whyItMatters:
      "Displaying hardcoded fake live activity badges ('24 people viewing right now') is a manipulative pattern that reduces authenticity.",
    recommendation:
      "Replace simulated real-time indicators with real WebSocket presence telemetry or remove the indicator.",
    agentAction:
      "Connect presence indicators to authentic real-time metrics or remove fake live badges.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const interactions = getInteractionTotals(snapshot);
      if (interactions.fakeOnlineUsersCount > 0 || interactions.fakeLiveIndicatorCount > 0) {
        return [
          {
            matches: true,
            evidence: [
              interactions.fakeOnlineUsersCount > 0 ? "Hardcoded online visitor count detected" : "",
              interactions.fakeLiveIndicatorCount > 0 ? "Simulated live ping indicator detected" : "",
            ].filter(Boolean),
          },
        ];
      }
      return [];
    },
  },

  // ─── Accessibility (accessibility) ─────────────────────────────────────────
  {
    id: "A11Y-UI-001",
    category: "accessibility",
    severity: "high",
    title: "Interactive icon button missing accessible name",
    whyItMatters:
      "Buttons containing only an icon or SVG without an aria-label, title, or sr-only text are inaccessible to screen reader users (WCAG 2.1 4.1.2).",
    recommendation:
      "Provide an explicit aria-label describing the button's action (e.g. aria-label=\"Search documents\").",
    agentAction:
      "Add aria-label attributes to all icon-only button elements.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const uxStates = getUXStateTotals(snapshot);
      if (uxStates.missingA11yIconCount > 0) {
        return [
          {
            matches: true,
            evidence: [`${uxStates.missingA11yIconCount} icon-only button(s) lack aria-label or accessible text`],
            fixable: true,
          },
        ];
      }
      return [];
    },
  },

  {
    id: "A11Y-UI-002",
    category: "accessibility",
    severity: "medium",
    title: "Interactive elements suppress outline without focus-visible replacement",
    whyItMatters:
      "Removing default focus outlines (outline-none) without supplying a visible focus indicator prevents keyboard-only users from navigating the page (WCAG 2.1 2.4.7).",
    recommendation:
      "Add focus-visible styling (e.g. focus-visible:ring-2 focus-visible:ring-offset-2) when suppressing default outlines.",
    agentAction:
      "Pair outline-none classes with focus-visible ring utilities.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const uxStates = getUXStateTotals(snapshot);
      if (uxStates.missingFocusStylesCount > 0) {
        return [
          {
            matches: true,
            evidence: [`${uxStates.missingFocusStylesCount} element(s) suppress outline without visible focus indicators`],
            fixable: true,
          },
        ];
      }
      return [];
    },
  },

  {
    id: "A11Y-UI-003",
    category: "accessibility",
    severity: "medium",
    title: "Images missing alt text attribute",
    whyItMatters:
      "Images without alt attributes prevent screen readers from conveying visual information or properly skipping decorative graphics (WCAG 2.1 1.1.1).",
    recommendation:
      "Add descriptive alt text to informative images, or alt=\"\" to purely decorative images.",
    agentAction:
      "Supply alt attributes for all img tags.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const missingAlt = snapshot.assets.flatMap((a) =>
        a.images.filter((img) => img.alt === undefined),
      );
      if (missingAlt.length > 0) {
        return [
          {
            matches: true,
            evidence: [`${missingAlt.length} image(s) missing alt attribute`],
            fixable: true,
          },
        ];
      }
      return [];
    },
  },

  {
    id: "A11Y-UI-004",
    category: "accessibility",
    severity: "low",
    title: "Animations lack reduced-motion preference handling",
    whyItMatters:
      "Continuous or large-scale CSS animations without prefers-reduced-motion queries can trigger vestibular motion disorders.",
    recommendation:
      "Wrap keyframe animations and transitions in motion-reduce: (Tailwind) or @media (prefers-reduced-motion: reduce).",
    agentAction:
      "Add reduced-motion media query guards to page animations.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const hasAnimations = snapshot.styles.some((s) => s.hasReducedMotion === false && s.blurCount > 2);
      const interactions = getInteractionTotals(snapshot);
      if (hasAnimations && interactions.scrollAnimationCount > 2) {
        return [
          {
            matches: true,
            evidence: ["Scroll animations present without prefers-reduced-motion guard"],
          },
        ];
      }
      return [];
    },
  },

  // ─── UX Completeness (ux-completeness) ─────────────────────────────────────
  {
    id: "UX-STATE-001",
    category: "ux-completeness",
    severity: "medium",
    title: "Missing loading or skeleton states in dynamic components",
    whyItMatters:
      "Deploying interactive applications without asynchronous loading or skeleton states causes content layout shifts (CLS) and leaves users wondering if data is arriving.",
    recommendation:
      "Implement skeleton screens or loading spinners during async data fetches and page transitions.",
    agentAction:
      "Add skeleton loaders or fallback suspense states for data-fetching views.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const dynamicRoutes = snapshot.routes.filter((r) => r.type === "app");
      const routesWithoutLoading = dynamicRoutes.filter((r) => !r.hasLoadingState);
      if (dynamicRoutes.length > 0 && routesWithoutLoading.length > 0) {
        return [
          {
            matches: true,
            evidence: [`${routesWithoutLoading.length} application route(s) lack loading states (${routesWithoutLoading.map((r) => r.file).join(", ")})`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "UX-STATE-002",
    category: "ux-completeness",
    severity: "medium",
    title: "Missing empty states for collection and listing components",
    whyItMatters:
      "When a search, table, or user collection returns zero results, displaying a blank container confuses users.",
    recommendation:
      "Provide an intentional empty state featuring an informative message and a clear next action.",
    agentAction:
      "Add empty state conditions with action buttons to collection views.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const appRoutes = snapshot.routes.filter((r) => r.type === "app");
      const routesWithoutEmpty = appRoutes.filter((r) => !r.hasEmptyState);
      if (appRoutes.length >= 2 && routesWithoutEmpty.length === appRoutes.length) {
        return [
          {
            matches: true,
            evidence: ["Application routes show no handling for empty collection states"],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "UX-STATE-006",
    category: "ux-completeness",
    severity: "medium",
    title: "Missing dedicated error boundary or error handling state",
    whyItMatters:
      "When client-side rendering fails or an API call rejects, lacking an error boundary crashes the entire app to a white screen.",
    recommendation:
      "Add an ErrorBoundary component or dedicated error state route with a reload/retry button.",
    agentAction:
      "Implement ErrorBoundary components or route-level error handlers.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const appRoutes = snapshot.routes.filter((r) => r.type === "app");
      const routesWithoutError = appRoutes.filter((r) => !r.hasErrorState);
      if (appRoutes.length >= 2 && routesWithoutError.length === appRoutes.length) {
        return [
          {
            matches: true,
            evidence: ["Application routes lack error boundary or error handling state"],
          },
        ];
      }
      return [];
    },
  },

  // ─── Production UX (production-ux) ─────────────────────────────────────────
  {
    id: "UX-STATE-003",
    category: "production-ux",
    severity: "medium",
    title: "Missing mobile navigation drawer or responsive menu",
    whyItMatters:
      "Navigation bars designed exclusively for desktop screens break on mobile viewports, leaving mobile users unable to navigate.",
    recommendation:
      "Implement a responsive mobile navigation drawer or bottom navigation bar.",
    agentAction:
      "Add mobile navigation toggle and drawer for viewports under 768px.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const uxStates = getUXStateTotals(snapshot);
      if (uxStates.missingMobileNav) {
        return [
          {
            matches: true,
            evidence: ["Desktop navbar present without corresponding mobile hamburger or drawer"],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "UX-STATE-004",
    category: "production-ux",
    severity: "high",
    title: "Destructive actions lack confirmation dialog",
    whyItMatters:
      "Providing immediate delete, purge, or remove buttons without confirmation dialogs leads to accidental data loss.",
    recommendation:
      "Require modal confirmation or a two-step verification flow for permanent delete actions.",
    agentAction:
      "Wrap destructive triggers in confirmation dialogs.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const uxStates = getUXStateTotals(snapshot);
      if (uxStates.destructiveWithoutConfirmCount > 0) {
        return [
          {
            matches: true,
            evidence: [`${uxStates.destructiveWithoutConfirmCount} destructive button(s) lack confirmation dialogs`],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "UX-STATE-005",
    category: "production-ux",
    severity: "low",
    title: "Missing 404 error page experience",
    whyItMatters:
      "Production web applications must provide a user-friendly 404 page that guides users back to the homepage or documentation when broken links occur.",
    recommendation:
      "Create a custom 404 (or not-found) route providing helpful recovery navigation.",
    agentAction:
      "Add a 404.html or not-found route with clear recovery links.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const hasWebRoutes = snapshot.routes.length > 0;
      const has404 = snapshot.assets.some((a) => a.has404Page);
      if (hasWebRoutes && !has404) {
        return [
          {
            matches: true,
            evidence: ["No 404 or not-found route detected in project routes"],
          },
        ];
      }
      return [];
    },
  },

  {
    id: "UX-STATE-007",
    category: "production-ux",
    severity: "low",
    title: "Missing Terms of Service or Privacy Policy disclosures",
    whyItMatters:
      "Production SaaS platforms collecting user data or offering authenticated accounts must link to Terms of Service and Privacy Policy documentation.",
    recommendation:
      "Add Terms of Service and Privacy Policy pages accessible from the site footer.",
    agentAction:
      "Add /terms and /privacy routes or link legal documents in the footer.",
    check: (snapshot: DesignSnapshot): DesignRuleCheckResult[] => {
      const hasAuthRoutes = snapshot.routes.some((r) => r.type === "auth");
      const hasLegal = snapshot.assets.some((a) => a.hasTos || a.hasPrivacyPolicy);
      if (hasAuthRoutes && !hasLegal) {
        return [
          {
            matches: true,
            evidence: ["Authentication routes detected without corresponding Terms of Service or Privacy Policy"],
          },
        ];
      }
      return [];
    },
  },
];
