// ─── Design Snapshot Builder ───────────────────────────────────────────────
// Static analysis scanner that constructs a normalized DesignSnapshot representation
// without executing arbitrary code or relying on external LLMs.
// ─────────────────────────────────────────────────────────────────────────────

import path from "node:path";
import fs from "node:fs/promises";
import fg from "fast-glob";
import type {
  DesignSnapshot,
  RouteSnapshot,
  ComponentSnapshot,
  StyleSnapshot,
  TypographySnapshot,
  ColorSnapshot,
  AssetSnapshot,
  InteractionSnapshot,
  CopySnapshot,
  UXStateSnapshot,
} from "./types.js";

const GENERIC_SAAS_PATTERNS = [
  /the future of\b/i,
  /built for the modern\b/i,
  /supercharge your\b/i,
  /transform your workflow\b/i,
  /unlock your potential\b/i,
  /from idea to production\b/i,
  /built for developers, loved by teams\b/i,
  /next-gen\b/i,
  /streamline your\b/i,
  /all-in-one platform\b/i,
  /accelerate your\b/i,
  /seamlessly integrate\b/i,
  /say goodbye to\b/i,
  /bring your ideas to life\b/i,
];

const ADJECTIVE_STACK_REGEX =
  /\b(powerful|seamless|intelligent|effortless|lightning-fast|blazing-fast|cutting-edge|revolutionary|intuitive|robust|scalable|modern)\b(?:[\s,]+and[\s,]+|[\s,]+)\b(powerful|seamless|intelligent|effortless|lightning-fast|blazing-fast|cutting-edge|revolutionary|intuitive|robust|scalable|modern)\b(?:[\s,]+and[\s,]+|[\s,]+)?\b(powerful|seamless|intelligent|effortless|lightning-fast|blazing-fast|cutting-edge|revolutionary|intuitive|robust|scalable|modern)?/i;

const IT_IS_NOT_X_REGEX =
  /\b(?:it'?s not|not just|not another)\s+([a-zA-Z0-9_-]+)[,\s]+it'?s\b/i;

const FAKE_URGENCY_REGEX =
  /\b(?:your workflow will never be the same|don'?t get left behind|the only tool you'?ll ever need|experience the difference today)\b/i;

const FAKE_TESTIMONIAL_NAME_REGEX =
  /\b(?:CEO at TechCorp|Founder at StartupX|John D\.|Sarah M\.|Alex P\.|Jane Doe|John Doe)\b/i;

const FAKE_COMPANY_REGEX =
  /\b(?:Acme Corp|TechCorp|StartupX|Initech|Pied Piper|Company A|Company B)\b/i;

const EMOJI_REGEX =
  /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/u;

export async function buildDesignSnapshot(
  rootDir: string,
  targetFiles?: string[],
): Promise<DesignSnapshot> {
  const normalizedRoot = path.resolve(rootDir);

  // 1. Gather all UI-relevant files
  let scannedPaths: string[];
  if (targetFiles && targetFiles.length > 0) {
    scannedPaths = targetFiles.map((f) =>
      path.isAbsolute(f) ? f : path.join(normalizedRoot, f),
    );
  } else {
    scannedPaths = await fg(
      [
        "**/*.{tsx,jsx,html,vue,svelte,css,scss}",
        "**/package.json",
        "**/app/**",
        "**/pages/**",
        "**/routes/**",
        "**/public/**",
      ],
      {
        cwd: normalizedRoot,
        ignore: [
          "**/node_modules/**",
          "**/dist/**",
          "**/build/**",
          "**/.next/**",
          "**/.nuxt/**",
          "**/.git/**",
          "**/coverage/**",
          "**/test/**",
          "**/tests/**",
          "**/*.test.*",
          "**/*.spec.*",
        ],
        absolute: true,
      },
    );
  }

  const routes: RouteSnapshot[] = [];
  const components: ComponentSnapshot[] = [];
  const styles: StyleSnapshot[] = [];
  const assets: AssetSnapshot[] = [];

  let detectedFramework: string | undefined;

  // Aggregate structures
  const allDetectedFonts = new Set<string>();
  let hasInterGeistWithoutIntent = false;
  const heroHeadingSizes: number[] = [];
  let boldTextMatches = 0;
  let uppercaseEyebrowCount = 0;
  let colonHeadingCount = 0;
  let rhetoricalQuestionHeadingCount = 0;

  const detectedPrimaryColors = new Set<string>();
  let isPurpleBlackAesthetic = false;
  let hasNeonColors = false;
  let hasGenericPastelPalette = false;
  let pureWhiteBgCount = 0;
  let multiAccentCount = 0;
  let lowContrastCount = 0;

  let hoverAnimationCount = 0;
  let excessiveScaleHoverCount = 0;
  let buttonHoverMoveCount = 0;
  let cardFloatHoverCount = 0;
  let cursorFollowerCount = 0;
  let scrollAnimationCount = 0;
  let parallaxCount = 0;
  let animatedGradientCount = 0;
  let infiniteMarqueeCount = 0;
  let textRevealCount = 0;
  let fakeTypingCount = 0;
  let fakeCounterCount = 0;
  let fakeProgressBarCount = 0;
  let fakeLiveIndicatorCount = 0;
  let fakeOnlineUsersCount = 0;
  let fakeToastsCount = 0;

  let genericSaaSCount = 0;
  const genericPhrasesFound: string[] = [];
  const copyMatchLocations: Array<{ file: string; line: number; phrase: string; patternType?: string }> = [];
  let adjectiveStackCount = 0;
  let itIsNotXItIsYCount = 0;
  let fakeTestimonialCount = 0;
  let fakeCompanyCount = 0;
  let fakeUrgencyCount = 0;
  let emDashCount = 0;
  let emojiCount = 0;
  let loremIpsumCount = 0;
  let featureMatrixCardOnlyCount = 0;

  let missingLoadingCount = 0;
  let missingEmptyCount = 0;
  let missingErrorCount = 0;
  let missingSuccessCount = 0;
  let missingDisabledCount = 0;
  let missingFormValidationCount = 0;
  let missingMobileNav = false;
  let missingFocusStylesCount = 0;
  let missingA11yIconCount = 0;
  let destructiveWithoutConfirmCount = 0;
  let emptyDashboardCount = 0;
  let deadLinkCtaCount = 0;

  let hasTosFile = false;
  let hasPrivacyFile = false;
  let has404File = false;
  let hasMobileNavComponent = false;
  let hasDesktopNavComponent = false;

  for (const filePath of scannedPaths) {
    const relPath = path.relative(normalizedRoot, filePath).replace(/\\/g, "/");
    const lowerRel = relPath.toLowerCase();

    // Check legal & 404 routes
    if (lowerRel.includes("terms") || lowerRel.includes("tos")) hasTosFile = true;
    if (lowerRel.includes("privacy")) hasPrivacyFile = true;
    if (
      lowerRel.includes("404") ||
      lowerRel.includes("not-found") ||
      lowerRel.endsWith("notfound.tsx")
    ) {
      has404File = true;
    }

    let content: string;
    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch {
      continue;
    }

    if (relPath.endsWith("package.json")) {
      try {
        const pkg = JSON.parse(content);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps.next) detectedFramework = "nextjs";
        else if (deps["@remix-run/react"]) detectedFramework = "remix";
        else if (deps.nuxt) detectedFramework = "nuxt";
        else if (deps.svelte || deps["@sveltejs/kit"]) detectedFramework = "sveltekit";
        else if (deps.astro) detectedFramework = "astro";
        else if (deps.vite) detectedFramework = "vite";
        else if (deps.react) detectedFramework = "react";
      } catch {
        // Skip malformed package.json
      }
      continue;
    }

    // Identify routes
    if (
      lowerRel.includes("/app/") ||
      lowerRel.includes("/pages/") ||
      lowerRel.includes("/routes/")
    ) {
      const isLegal = lowerRel.includes("terms") || lowerRel.includes("privacy");
      const isAuth = lowerRel.includes("auth") || lowerRel.includes("login") || lowerRel.includes("signup");
      const isApi = lowerRel.includes("/api/");
      const isMarketing =
        lowerRel.endsWith("page.tsx") ||
        lowerRel.endsWith("index.tsx") ||
        lowerRel.endsWith("index.html") ||
        lowerRel.includes("landing");

      routes.push({
        path: relPath,
        file: relPath,
        type: isLegal
          ? "legal"
          : isAuth
            ? "auth"
            : isApi
              ? "api"
              : isMarketing
                ? "marketing"
                : "app",
        hasLoadingState:
          content.includes("loading") ||
          content.includes("Skeleton") ||
          content.includes("Spinner"),
        hasErrorState:
          content.includes("error") ||
          content.includes("catch") ||
          content.includes("ErrorBoundary"),
        hasEmptyState: content.includes("empty") || content.includes("no results") || content.includes("No items"),
      });
    }

    // Inspect Typography
    if (
      content.includes("font-sans") ||
      content.includes("Inter") ||
      content.includes("Geist") ||
      content.includes("Space Grotesk")
    ) {
      if (content.includes("Inter")) allDetectedFonts.add("Inter");
      if (content.includes("Geist")) allDetectedFonts.add("Geist");
      if (content.includes("Space Grotesk")) allDetectedFonts.add("Space Grotesk");

      if (
        (content.includes("Inter") || content.includes("Geist") || content.includes("Space Grotesk")) &&
        !content.includes("font-serif") &&
        !content.includes("font-mono")
      ) {
        hasInterGeistWithoutIntent = true;
      }
    }

    // Inspect copy in file
    for (const pattern of GENERIC_SAAS_PATTERNS) {
      const match = content.match(pattern);
      if (match) {
        genericSaaSCount++;
        genericPhrasesFound.push(match[0]);
      }
    }

    if (ADJECTIVE_STACK_REGEX.test(content)) {
      adjectiveStackCount++;
    }

    if (IT_IS_NOT_X_REGEX.test(content)) {
      itIsNotXItIsYCount++;
    }

    if (FAKE_URGENCY_REGEX.test(content)) {
      fakeUrgencyCount++;
    }

    if (FAKE_TESTIMONIAL_NAME_REGEX.test(content)) {
      fakeTestimonialCount++;
    }

    if (FAKE_COMPANY_REGEX.test(content)) {
      fakeCompanyCount++;
    }

    const emDashes = (content.match(/—|&mdash;/g) || []).length;
    if (emDashes > 3) {
      emDashCount += emDashes;
    }

    const emojis = (content.match(new RegExp(EMOJI_REGEX, "gu")) || []).length;
    if (emojis > 0) {
      emojiCount += emojis;
    }

    if (/lorem ipsum/i.test(content)) {
      loremIpsumCount++;
    }

    // Inspect Styles & Tailwind classes
    let gradientCount = 0;
    let harshGradientCount = 0;
    let purpleBlueGradientCount = 0;
    let rainbowGradientCount = 0;
    let gradientTextCount = 0;
    let gradientButtonCount = 0;
    let gradientBorderCount = 0;
    let shadowCount = 0;
    let excessiveShadowCount = 0;
    let blurCount = 0;
    let glassmorphismCount = 0;
    let glowCount = 0;
    let softRadiusCount = 0;
    let extremeRadiusCount = 0;
    let pillButtonCount = 0;
    let noiseTextureCount = 0;
    let dotGridCount = 0;
    let radialOrbCount = 0;
    let decorativeBlobCount = 0;
    let squigglesCount = 0;
    let outlineNoneWithoutFocusVisibleCount = 0;

    const lines = content.split("\n");

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;

      // Copy match tracking for precise file and line attribution
      for (const pattern of GENERIC_SAAS_PATTERNS) {
        const match = lineText.match(pattern);
        if (match) {
          copyMatchLocations.push({
            file: relPath,
            line: lineNum,
            phrase: match[0],
            patternType: "slogan",
          });
        }
      }
      if (ADJECTIVE_STACK_REGEX.test(lineText)) {
        copyMatchLocations.push({
          file: relPath,
          line: lineNum,
          phrase: "adjective stack",
          patternType: "adjective-stack",
        });
      }
      if (IT_IS_NOT_X_REGEX.test(lineText)) {
        copyMatchLocations.push({
          file: relPath,
          line: lineNum,
          phrase: "formulaic comparison",
          patternType: "formulaic-claim",
        });
      }
      if (FAKE_TESTIMONIAL_NAME_REGEX.test(lineText)) {
        copyMatchLocations.push({
          file: relPath,
          line: lineNum,
          phrase: "fake customer testimonial",
          patternType: "testimonial",
        });
      }
      if (FAKE_COMPANY_REGEX.test(lineText)) {
        copyMatchLocations.push({
          file: relPath,
          line: lineNum,
          phrase: "placeholder company name",
          patternType: "company",
        });
      }
      if (/lorem ipsum/i.test(lineText)) {
        copyMatchLocations.push({
          file: relPath,
          line: lineNum,
          phrase: "Lorem ipsum",
          patternType: "lorem-ipsum",
        });
      }

      // Hero heading sizes
      if (
        /text-6xl|text-7xl|text-8xl|text-9xl|font-size:\s*(?:6[4-9]|[7-9]\d|\d{3})px/i.test(
          lineText,
        )
      ) {
        heroHeadingSizes.push(lineNum);
      }

      // Bold counts
      if (/font-bold|font-extrabold|font-black|font-weight:\s*(?:700|800|900)/i.test(lineText)) {
        boldTextMatches++;
      }

      // Eyebrow labels
      if (
        /uppercase(?:\s+tracking-w(?:ider|idest))?(?:\s+text-xs|\s+text-sm)?/i.test(
          lineText,
        ) &&
        /eyebrow|<span|<p/i.test(lineText)
      ) {
        uppercaseEyebrowCount++;
      }

      // Colon headings
      if (/<h[1-4][^>]*>[^<:]+:\s*[^<]+<\/h[1-4]>/i.test(lineText)) {
        colonHeadingCount++;
      }

      // Rhetorical questions
      if (
        /<h[1-4][^>]*>[^<]*\?[^<]*<\/h[1-4]>/i.test(lineText) &&
        /why|how|ready|what/i.test(lineText)
      ) {
        rhetoricalQuestionHeadingCount++;
      }

      // Gradients
      if (/bg-gradient-to|linear-gradient/i.test(lineText)) {
        gradientCount++;
        if (
          /from-purple|to-blue|from-indigo|to-purple|from-violet/i.test(
            lineText,
          )
        ) {
          purpleBlueGradientCount++;
        }
        if (
          /from-pink.*via-purple.*to-blue|from-red.*via-green|rainbow/i.test(
            lineText,
          )
        ) {
          rainbowGradientCount++;
        }
        if (
          /from-cyan-400.*to-fuchsia-500|from-[#0-9a-fA-F]{6}.*to-[#0-9a-fA-F]{6}/i.test(
            lineText,
          )
        ) {
          harshGradientCount++;
        }
        if (/bg-clip-text\s+text-transparent/i.test(lineText)) {
          gradientTextCount++;
        }
        if (/<button[^>]*class(?:Name)?="[^"]*bg-gradient/i.test(lineText)) {
          gradientButtonCount++;
        }
        if (/p-\[1px\]\s+bg-gradient/i.test(lineText)) {
          gradientBorderCount++;
        }
      }

      // Shadows & Glow
      if (/shadow-2xl|shadow-xl|box-shadow:\s*0\s+2[0-9]px/i.test(lineText)) {
        shadowCount++;
        excessiveShadowCount++;
      } else if (/shadow-lg|shadow-md/i.test(lineText)) {
        shadowCount++;
      }

      if (/shadow-\[0_0_.*px_rgba|drop-shadow-\[0_0_/i.test(lineText)) {
        glowCount++;
      }

      // Glassmorphism & Blur
      if (/backdrop-blur|backdrop-filter:\s*blur/i.test(lineText)) {
        blurCount++;
        if (/bg-white\/[0-9]+|bg-black\/[0-9]+|bg-opacity/i.test(lineText)) {
          glassmorphismCount++;
        }
      }

      // Radius
      if (/rounded-3xl|rounded-\[3[0-9]px\]|rounded-\[4[0-9]px\]/i.test(lineText)) {
        extremeRadiusCount++;
      } else if (/rounded-2xl|rounded-xl/i.test(lineText)) {
        softRadiusCount++;
      }

      if (/<button[^>]*class(?:Name)?="[^"]*rounded-full/i.test(lineText)) {
        pillButtonCount++;
      }

      // Noise & Dot grid & Orbs
      if (/noise|bg-\[url\(['"]?.*noise/i.test(lineText)) {
        noiseTextureCount++;
      }
      if (/bg-dot-grid|radial-gradient\(#.*1px,\s*transparent\s+1px\)/i.test(lineText)) {
        dotGridCount++;
      }
      if (
        /radial-gradient|bg-\[radial-gradient|blur-3xl.*rounded-full.*bg-purple/i.test(
          lineText,
        )
      ) {
        radialOrbCount++;
        decorativeBlobCount++;
      }
      if (/squiggle|<svg[^>]*class(?:Name)?="[^"]*squiggle/i.test(lineText)) {
        squigglesCount++;
      }

      // Focus styles & a11y
      if (
        /outline-none|focus:outline-none/i.test(lineText) &&
        !/focus-visible:|focus:ring|ring-offset/i.test(lineText)
      ) {
        outlineNoneWithoutFocusVisibleCount++;
        missingFocusStylesCount++;
      }

      // Purple + Black aesthetic detection
      if (
        (lineText.includes("#09090b") ||
          lineText.includes("bg-black") ||
          lineText.includes("bg-zinc-950") ||
          lineText.includes("bg-neutral-950")) &&
        (lineText.includes("purple") || lineText.includes("violet"))
      ) {
        isPurpleBlackAesthetic = true;
      }

      // Neon colors
      if (
        /#00ff[0-9a-f]{2}|#ff00ff|#00ffff|bg-neon-|text-neon-/i.test(lineText)
      ) {
        hasNeonColors = true;
      }

      // Pastel colors
      if (
        /bg-purple-100.*bg-blue-100.*bg-pink-100|#f3e8ff.*#e0e7ff/i.test(
          lineText,
        )
      ) {
        hasGenericPastelPalette = true;
      }

      // Pure white background
      if (
        /bg-white|#ffffff|rgb\(255,\s*255,\s*255\)/i.test(lineText) &&
        /<(?:body|main|section|div class="min-h-screen")/i.test(lineText)
      ) {
        pureWhiteBgCount++;
      }

      // Animations & Interactions
      if (/hover:scale-105|hover:scale-110/i.test(lineText)) {
        hoverAnimationCount++;
        excessiveScaleHoverCount++;
      } else if (/hover:scale-/i.test(lineText)) {
        hoverAnimationCount++;
      }

      if (/hover:-translate-y-1|hover:-translate-y-2/i.test(lineText)) {
        if (/<button/i.test(lineText)) buttonHoverMoveCount++;
        else cardFloatHoverCount++;
      }

      if (/cursor-pointer.*follow|custom-cursor|cursor-tracker/i.test(lineText)) {
        cursorFollowerCount++;
      }

      if (/whileInView|data-aos|aos-animate|scroll-trigger/i.test(lineText)) {
        scrollAnimationCount++;
      }

      if (/parallax|transform-gpu/i.test(lineText) && /scroll/i.test(lineText)) {
        parallaxCount++;
      }

      if (/animate-gradient|gradient-shift/i.test(lineText)) {
        animatedGradientCount++;
      }

      if (/animate-marquee|<Marquee|marquee/i.test(lineText)) {
        infiniteMarqueeCount++;
      }

      if (/typewriter|text-reveal/i.test(lineText)) {
        textRevealCount++;
      }

      if (/fake-terminal|npm i|curl -s|bash <\(/i.test(lineText) && /bg-black|rounded-lg/i.test(lineText)) {
        fakeTypingCount++;
      }

      if (/count-up|data-counter|0 to 10,?000/i.test(lineText)) {
        fakeCounterCount++;
      }

      if (/<progress|role="progressbar"|w-\[85%\]|w-\[99%\]/i.test(lineText) && /bg-green|bg-blue/i.test(lineText)) {
        fakeProgressBarCount++;
      }

      if (/animate-ping.*bg-green/i.test(lineText) && /live|online|uptime/i.test(lineText)) {
        fakeLiveIndicatorCount++;
      }

      if (/[0-9]+\s+(?:people|users)\s+(?:viewing|online)\s+right\s+now/i.test(lineText)) {
        fakeOnlineUsersCount++;
      }

      if (/just bought|purchased.*seconds ago/i.test(lineText)) {
        fakeToastsCount++;
      }

      // Buttons with dead links
      if (
        /<(?:button|a)[^>]*(?:href="#"|onClick=\{\(\)\s*=>\s*\{\}\})[^>]*>/i.test(
          lineText,
        ) &&
        /get started|sign up|buy now|try free|start free/i.test(lineText)
      ) {
        deadLinkCtaCount++;
      }

      // Destructive actions without confirm
      if (
        /<button[^>]*>[^<]*(?:delete|remove|destroy|purge)[^<]*<\/button>/i.test(
          lineText,
        ) &&
        !/confirm|dialog|alert|prompt|modal/i.test(content)
      ) {
        destructiveWithoutConfirmCount++;
      }

      // Icon without aria-label
      if (
        /<button[^>]*>(?:\s*<(?:[A-Z][a-zA-Z0-9]*Icon|Sparkles|Check|Arrow|X|Menu|Trash)[^>]*\/>|\s*<svg[^>]*>[\s\S]*?<\/svg>)\s*<\/button>/i.test(
          lineText,
        ) &&
        !/aria-label|aria-labelledby|<span[^>]*class="sr-only"/i.test(lineText)
      ) {
        missingA11yIconCount++;
      }
    });

    styles.push({
      file: relPath,
      gradientCount,
      harshGradientCount,
      purpleBlueGradientCount,
      rainbowGradientCount,
      gradientTextCount,
      gradientButtonCount,
      gradientBorderCount,
      shadowCount,
      excessiveShadowCount,
      blurCount,
      glassmorphismCount,
      glowCount,
      softRadiusCount,
      extremeRadiusCount,
      pillButtonCount,
      noiseTextureCount,
      dotGridCount,
      radialOrbCount,
      decorativeBlobCount,
      squigglesCount,
      hasReducedMotion:
        content.includes("prefers-reduced-motion") ||
        content.includes("motion-reduce:"),
      outlineNoneWithoutFocusVisibleCount,
    });

    // Inspect Components
    const isHero = /hero/i.test(relPath) || /<section[^>]*hero/i.test(content);
    const isNavbar = /nav|navbar|header/i.test(relPath) || /<nav/i.test(content);
    const isTestimonial = /testimonial/i.test(relPath) || /testimonials/i.test(content);
    const isTerminalMockup = /terminal/i.test(relPath) || (/rounded-full.*bg-red-500.*bg-yellow-500.*bg-green-500/i.test(content));
    const isBento = /bento/i.test(relPath) || (content.includes("col-span-2") && content.includes("row-span-2"));
    const isThreeColumn = /grid-cols-3/i.test(content) || /three-column/i.test(content);

    if (isNavbar) {
      hasDesktopNavComponent = true;
      if (/md:hidden|mobile-nav|hamburger|drawer/i.test(content)) {
        hasMobileNavComponent = true;
      }
    }

    // Extract icons
    const iconNames: string[] = [];
    const iconMatches = content.matchAll(/<(Sparkles|Sparkle|Wand2|Brain|Zap|Check|ArrowRight|Star|Globe|Shield|Activity|Terminal|Copy)\b/g);
    for (const match of iconMatches) {
      if (match[1]) iconNames.push(match[1]);
    }

    // Check card nesting
    let cardNestingDepth = 0;
    if (content.includes("card") || content.includes("Card")) {
      const cardTags = (content.match(/<(?:div|article|section)[^>]*(?:class(?:Name)?="[^"]*card|<Card)/gi) || []).length;
      if (cardTags >= 3) cardNestingDepth = cardTags;
    }

    let componentStartLine = 1;
    if (isHero) {
      const heroIdx = lines.findIndex((l) => /<section[^>]*hero|<header/i.test(l));
      if (heroIdx >= 0) componentStartLine = heroIdx + 1;
    } else if (isTerminalMockup) {
      const termIdx = lines.findIndex((l) => /terminal|rounded-full.*bg-red-500/i.test(l));
      if (termIdx >= 0) componentStartLine = termIdx + 1;
    } else if (isBento) {
      const bentoIdx = lines.findIndex((l) => /col-span-2/i.test(l));
      if (bentoIdx >= 0) componentStartLine = bentoIdx + 1;
    } else if (isTestimonial) {
      const testIdx = lines.findIndex((l) => /testimonial/i.test(l));
      if (testIdx >= 0) componentStartLine = testIdx + 1;
    }

    components.push({
      name: path.basename(filePath, path.extname(filePath)),
      file: relPath,
      line: componentStartLine,
      tag: "component",
      isCard: content.includes("rounded-") && (content.includes("border") || content.includes("shadow")),
      isButton: content.includes("<button"),
      isNavbar,
      isHero,
      isTestimonial,
      isTerminalMockup,
      isBentoGrid: isBento,
      isMarquee: infiniteMarqueeCount > 0,
      isFeatureMatrix: content.includes("feature") && content.includes("grid"),
      isThreeColumnSection: isThreeColumn,
      hasIcon: iconNames.length > 0,
      iconNames,
      hasLoadingState: content.includes("loading") || content.includes("Skeleton"),
      hasErrorState: content.includes("error") || content.includes("catch"),
      hasEmptyState: content.includes("empty") || content.includes("no results"),
      hasSuccessState: content.includes("success") || content.includes("submitted"),
      hasDisabledState: content.includes("disabled"),
      cardNestingDepth,
      classes: [],
      rawText: content.slice(0, 1000),
    });

    // Inspect Assets / Images
    const imgMatches = content.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi);
    const assetImages: AssetSnapshot["images"] = [];
    for (const match of imgMatches) {
      const src = match[1] || "";
      const fullTag = match[0];
      const altMatch = fullTag.match(/alt=["']([^"']*)["']/i);
      const alt = altMatch ? altMatch[1] : undefined;
      const isStock = /unsplash|pexels|stock|placeholder/i.test(src);
      const isAiRobotOrBlob = /robot|ai-avatar|blob|sphere/i.test(src);
      const isScreenshot = /screenshot|dashboard|app-preview/i.test(src);

      assetImages.push({
        src,
        alt,
        isStock,
        isAiRobotOrBlob,
        isScreenshot,
      });
    }

    assets.push({
      file: relPath,
      images: assetImages,
      hasTos: hasTosFile,
      hasPrivacyPolicy: hasPrivacyFile,
      has404Page: has404File,
    });
  }

  // Check mobile navigation presence
  if (hasDesktopNavComponent && !hasMobileNavComponent) {
    missingMobileNav = true;
  }

  const typography: TypographySnapshot = {
    fontsDetected: Array.from(allDetectedFonts),
    hasInterGeistWithoutIntent,
    heroHeadingSizes,
    hasExcessiveBold: boldTextMatches > 25,
    uppercaseEyebrowCount,
    colonHeadingCount,
    rhetoricalQuestionHeadingCount,
  };

  const colors: ColorSnapshot = {
    primaryColors: Array.from(detectedPrimaryColors),
    isPurpleBlackAesthetic,
    hasNeonColors,
    hasGenericPastelPalette,
    pureWhiteBgCount,
    multiAccentCount,
    lowContrastCount,
  };

  const interactions: InteractionSnapshot = {
    file: "project",
    hoverAnimationCount,
    excessiveScaleHoverCount,
    buttonHoverMoveCount,
    cardFloatHoverCount,
    cursorFollowerCount,
    scrollAnimationCount,
    parallaxCount,
    animatedGradientCount,
    infiniteMarqueeCount,
    textRevealCount,
    fakeTypingCount,
    fakeCounterCount,
    fakeProgressBarCount,
    fakeLiveIndicatorCount,
    fakeOnlineUsersCount,
    fakeToastsCount,
  };

  const copy: CopySnapshot = {
    genericSaaSCount,
    genericPhrasesFound,
    adjectiveStackCount,
    itIsNotXItIsYCount,
    fakeTestimonialCount,
    fakeCompanyCount,
    fakeUrgencyCount,
    emDashCount,
    emojiCount,
    loremIpsumCount,
    featureMatrixCardOnlyCount,
    matchLocations: copyMatchLocations,
  };

  const uxStates: UXStateSnapshot = {
    file: "project",
    missingLoadingCount,
    missingEmptyCount,
    missingErrorCount,
    missingSuccessCount,
    missingDisabledCount,
    missingFormValidationCount,
    missingMobileNav,
    missingFocusStylesCount,
    missingA11yIconCount,
    destructiveWithoutConfirmCount,
    emptyDashboardCount,
    deadLinkCtaCount,
  };

  return {
    framework: detectedFramework,
    routes,
    components,
    styles,
    typography,
    colors,
    assets,
    interactions: [interactions],
    copy,
    uxStates: [uxStates],
    totalFilesScanned: scannedPaths.length,
  };
}
