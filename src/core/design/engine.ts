// ─── Design Quality Engine ──────────────────────────────────────────────────
// Evaluates design rules, manages baselines & documented exceptions,
// computes fingerprints, and integrates with loop escalation detection.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import path from "node:path";
import { buildDesignSnapshot } from "./snapshot.js";
import { DESIGN_RULES } from "./catalog.js";
import { applyDesignSafeFixes } from "./fix.js";
import { loadConfig } from "../../config/config.js";
import { checkLoopProgress, resetLoopState } from "../loop/state.js";
import { getGitScope } from "../scoping/git-scope.js";
import type {
  DesignCheckOptions,
  DesignCheckResult,
  DesignFinding,
  SuppressedDesignFinding,
  DesignCheckConfig,
} from "./types.js";

export function generateDesignFingerprint(
  ruleId: string,
  file?: string,
  line?: number,
  extra?: string,
): string {
  const hash = crypto.createHash("sha256");
  hash.update(ruleId);
  if (file) hash.update(`:${file}`);
  if (line !== undefined) hash.update(`:${line}`);
  if (extra) hash.update(`:${extra}`);
  return hash.digest("hex");
}

export interface ResolvedLocation {
  primaryFile?: string;
  primaryLine?: number;
  locations: Array<{ file: string; line?: number; endLine?: number }>;
}

export function resolveFindingLocations(
  ruleId: string,
  res: import("./types.js").DesignRuleCheckResult,
  snapshot: import("./types.js").DesignSnapshot,
): ResolvedLocation {
  const locMap = new Map<string, number>();

  const addLoc = (file?: string, line?: number) => {
    if (!file) return;
    if (!locMap.has(file)) {
      locMap.set(file, line ?? 1);
    } else if (line && line > 1 && locMap.get(file) === 1) {
      locMap.set(file, line);
    }
  };

  // If rule explicitly provided file/line/locations, record them
  if (res.file) {
    addLoc(res.file, res.line);
  }
  if (res.locations) {
    for (const l of res.locations) {
      addLoc(l.file, l.line);
    }
  }

  // Combinations & Landing page composition
  if (
    ruleId === "GENERIC-SAAS-COMBINATION-001" ||
    ruleId === "VIBECODED-LANDING-PAGE-001" ||
    ruleId === "DECORATION-OVERLOAD-001"
  ) {
    const marketingRoute = snapshot.routes.find((r) => r.type === "marketing");
    if (marketingRoute) addLoc(marketingRoute.file);

    for (const c of snapshot.components) {
      if (
        c.isHero ||
        c.isTerminalMockup ||
        c.isBentoGrid ||
        c.isThreeColumnSection ||
        c.isCard ||
        c.iconNames.some((i) => /Sparkle|Wand/i.test(i))
      ) {
        addLoc(c.file, c.line);
      }
    }
    for (const s of snapshot.styles) {
      if (s.radialOrbCount > 0 || s.gradientTextCount > 0 || s.decorativeBlobCount > 0) {
        addLoc(s.file);
      }
    }
  }

  // Gradients and visual styling
  if (
    ruleId === "DESIGN-VISUAL-001" ||
    ruleId === "DESIGN-VISUAL-002" ||
    ruleId === "DESIGN-VISUAL-003"
  ) {
    for (const s of snapshot.styles) {
      if (
        s.gradientTextCount > 0 ||
        s.gradientButtonCount > 0 ||
        s.gradientBorderCount > 0 ||
        s.purpleBlueGradientCount > 0 ||
        s.radialOrbCount > 0 ||
        s.glassmorphismCount > 0
      ) {
        addLoc(s.file);
      }
    }
  }

  // Extreme corner radii
  if (ruleId === "DESIGN-VISUAL-004") {
    for (const s of snapshot.styles) {
      if (s.extremeRadiusCount > 0) {
        addLoc(s.file);
      }
    }
  }

  // Sparkle / wand icons
  if (ruleId === "DESIGN-VISUAL-005") {
    for (const c of snapshot.components) {
      if (c.iconNames.some((name) => /Sparkle|Wand|Brain/i.test(name))) {
        addLoc(c.file, c.line);
      }
    }
  }

  // Dot grids and textures
  if (ruleId === "DESIGN-VISUAL-006") {
    for (const s of snapshot.styles) {
      if (s.dotGridCount > 0 || s.noiseTextureCount > 0) {
        addLoc(s.file);
      }
    }
  }

  // Excessive hover animations & interactions
  if (ruleId === "DESIGN-INTERACTION-001") {
    for (const s of snapshot.styles) {
      addLoc(s.file);
    }
  }
  if (ruleId === "DESIGN-AUTHENTICITY-004") {
    for (const c of snapshot.components) {
      if (/animate-ping|viewing right now|online right now/i.test(c.rawText)) {
        addLoc(c.file, c.line);
      }
    }
  }

  // Copy quality, slogans, testimonials, companies
  if (ruleId.startsWith("CONTENT-QUALITY") || ruleId.startsWith("DESIGN-AUTHENTICITY")) {
    if (snapshot.copy.matchLocations) {
      for (const m of snapshot.copy.matchLocations) {
        addLoc(m.file, m.line);
      }
    }
    for (const c of snapshot.components) {
      if (c.isTestimonial || /CEO at|Acme Corp|TechCorp|Supercharge/i.test(c.rawText)) {
        addLoc(c.file, c.line);
      }
    }
  }

  // Accessibility
  if (ruleId === "A11Y-UI-001") {
    for (const c of snapshot.components) {
      if (c.hasAriaLabel === false || c.hasIcon) {
        addLoc(c.file, c.line);
      }
    }
  }
  if (ruleId === "A11Y-UI-002") {
    for (const s of snapshot.styles) {
      if (s.outlineNoneWithoutFocusVisibleCount > 0) {
        addLoc(s.file);
      }
    }
  }
  if (ruleId === "A11Y-UI-003") {
    for (const a of snapshot.assets) {
      if (a.images.some((img) => img.alt === undefined)) {
        addLoc(a.file);
      }
    }
  }

  // Fallback: if still empty, pick first route or first component
  if (locMap.size === 0) {
    const firstRoute = snapshot.routes[0];
    const firstComponent = snapshot.components[0];
    if (firstRoute) {
      addLoc(firstRoute.file);
    } else if (firstComponent) {
      addLoc(firstComponent.file, firstComponent.line);
    }
  }

  const locations = Array.from(locMap.entries()).map(([file, line]) => ({
    file,
    line,
  }));

  const primary = locations[0];
  return {
    primaryFile: primary?.file,
    primaryLine: primary?.line,
    locations,
  };
}

export async function runDesignCheck(
  rootDir: string = ".",
  options: DesignCheckOptions = {},
): Promise<DesignCheckResult> {
  const normalizedRoot = path.resolve(rootDir);

  // 1. If --fix requested, apply deterministic safe fixes first
  let fixedCount = 0;
  if (options.fix) {
    const fixes = await applyDesignSafeFixes(normalizedRoot);
    fixedCount = fixes.length;
  }

  // 2. Determine git-scoped files if --changed or --base requested
  let targetFiles: string[] | undefined;
  if (options.changed || options.base) {
    const gitScope = await getGitScope(normalizedRoot, {
      changed: options.changed,
      base: options.base,
    });
    if (gitScope && gitScope.changedFiles.size > 0) {
      targetFiles = Array.from(gitScope.changedFiles);
    }
  }

  // 3. Build snapshot
  const snapshot = await buildDesignSnapshot(normalizedRoot, targetFiles);

  // 4. Load configuration & suppressions
  const biltConfig = await loadConfig(normalizedRoot);
  const designConfig: DesignCheckConfig = (biltConfig as any).designCheck || {};

  const ignoreList = Array.isArray(designConfig.ignore) ? designConfig.ignore : [];
  const reasonMap = designConfig.reason || {};
  const isIgnoreAll = (designConfig as any).ignoreAll === true || ignoreList.includes("*");

  // 5. Evaluate rules
  const rawFindings: DesignFinding[] = [];
  const suppressedFindings: SuppressedDesignFinding[] = [];
  const timingMs: Record<string, number> = {};

  for (const rule of DESIGN_RULES) {
    const startRule = performance.now();
    const results = rule.check(snapshot);
    for (const res of results) {
      if (res.matches) {
        const resolved = resolveFindingLocations(rule.id, res, snapshot);
        const targetFile = res.file ?? resolved.primaryFile;
        const targetLine = res.line ?? resolved.primaryLine;
        const targetLocations = res.locations ?? resolved.locations;

        const fp = generateDesignFingerprint(
          rule.id,
          targetFile,
          targetLine,
          res.evidence.join(";"),
        );

        // Check suppression
        const isIgnored = !isIgnoreAll && ignoreList.includes(rule.id);
        const reason = reasonMap[rule.id]?.trim();

        if (isIgnored && reason && reason.length > 0) {
          suppressedFindings.push({
            ruleId: rule.id,
            category: rule.category,
            severity: rule.severity,
            title: rule.title,
            reason,
            file: targetFile,
          });
        } else {
          rawFindings.push({
            ruleId: rule.id,
            category: rule.category,
            severity: rule.severity,
            title: rule.title,
            whyItMatters: rule.whyItMatters,
            evidence: res.evidence,
            recommendation: rule.recommendation,
            agentAction: rule.agentAction,
            fingerprint: fp,
            file: targetFile,
            line: targetLine,
            endLine: res.endLine ?? targetLine,
            locations: targetLocations,
            fixable: res.fixable,
          });
        }
      }
    }
  }

  // 5.5 Check Brief Consistency
  const { readDesignBrief } = await import("./brief/storage.js");
  const { getBriefConsistencyFindings } = await import("./brief/rules.js");
  const brief = await readDesignBrief(normalizedRoot);
  if (brief && brief.creativeFreedom !== "creative") {
    const briefFindings = getBriefConsistencyFindings(brief, snapshot);
    for (const finding of briefFindings) {
      const isIgnored = !isIgnoreAll && ignoreList.includes(finding.ruleId);
      const reason = reasonMap[finding.ruleId]?.trim();
      if (isIgnored && reason && reason.length > 0) {
        suppressedFindings.push({
          ruleId: finding.ruleId,
          category: finding.category,
          severity: finding.severity,
          title: finding.title,
          reason,
          file: finding.file,
        });
      } else {
        rawFindings.push(finding);
      }
    }
  }

  // 6. Loop escalation check
  const activeFingerprints = rawFindings.map((f) => f.fingerprint);
  const loopResult = await checkLoopProgress(normalizedRoot, activeFingerprints, {
    maxIterations: options.maxIterations ?? 5,
    taskId: "design-check",
  });

  if (activeFindingsCount(rawFindings) === 0) {
    await resetLoopState(normalizedRoot);
  }

  // Summary counts
  const high = rawFindings.filter((f) => f.severity === "high").length;
  const medium = rawFindings.filter((f) => f.severity === "medium").length;
  const low = rawFindings.filter((f) => f.severity === "low").length;

  let status: "pass" | "needs-improvement" | "escalate" = "pass";
  if (loopResult.shouldEscalate) {
    status = "escalate";
  } else if (rawFindings.length > 0) {
    status = "needs-improvement";
  }

  const escalationMessage = loopResult.shouldEscalate
    ? `STOP.\n\nBilt detected no progress across repeated iterations.\nDo not continue making random UI changes.\nReview the findings, explain the blocker, and request human direction if necessary.\n(${loopResult.escalationReason || "No progress"})`
    : undefined;

  return {
    schemaVersion: "1",
    status,
    summary: {
      patternsDetected: rawFindings.length,
      high,
      medium,
      low,
      suppressed: suppressedFindings.length,
    },
    findings: rawFindings,
    suppressed: suppressedFindings,
    escalationMessage,
    iteration: loopResult.iteration,
    fixedCount,
    rawSnapshot: options.debug ? snapshot : undefined,
    timingMs: options.debug ? timingMs : undefined,
    hasDesignBrief: brief !== null,
  };
}

function activeFindingsCount(findings: DesignFinding[]): number {
  return findings.length;
}
