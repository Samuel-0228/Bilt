// ─── Doctor Command ──────────────────────────────────────────────────────────
// Comprehensive multi-domain health report with AI explanations & domain scores.
// ─────────────────────────────────────────────────────────────────────────────

import path from "node:path";
import type { ScanFinding, Severity } from "../types/index.js";
import { executeScan } from "./scan.js";
import { formatHealthScore, severityIcon } from "../ui/format.js";
import {
  colors,
  glyphs,
  sectionHeader,
  divider,
  isPlainMode,
  showBliptBanner,
  text,
} from "../ui/theme.js";
import { createRequire } from "node:module";

export function getOWASPMapping(f: ScanFinding): { id: string; name: string } {
  if (f.owaspMapping) {
    if (f.owaspMapping.includes("A01")) return { id: "A01:2021", name: "Broken Access Control" };
    if (f.owaspMapping.includes("A02")) return { id: "A02:2021", name: "Cryptographic Failures" };
    if (f.owaspMapping.includes("A03")) return { id: "A03:2021", name: "Injection" };
    if (f.owaspMapping.includes("A04")) return { id: "A04:2021", name: "Insecure Design" };
    if (f.owaspMapping.includes("A05")) return { id: "A05:2021", name: "Security Misconfiguration" };
    if (f.owaspMapping.includes("A06")) return { id: "A06:2021", name: "Vulnerable & Outdated Components" };
    if (f.owaspMapping.includes("A07")) return { id: "A07:2021", name: "Identification & Authentication Failures" };
    if (f.owaspMapping.includes("A08")) return { id: "A08:2021", name: "Software & Data Integrity Failures" };
    if (f.owaspMapping.includes("A09")) return { id: "A09:2021", name: "Security Logging & Monitoring Failures" };
    if (f.owaspMapping.includes("A10")) return { id: "A10:2021", name: "Server-Side Request Forgery" };
  }

  switch (f.category) {
    case "secret-detected":
      return { id: "A02:2021", name: "Cryptographic Failures" };
    case "env-missing":
    case "env-unused":
    case "env-mismatch":
    case "env-exposed":
    case "gitignore-missing":
    case "plugin-finding":
    case "config-package":
      return { id: "A05:2021", name: "Security Misconfiguration" };
    case "dep-vulnerable":
    case "dep-unused":
    case "dep-duplicate":
      return { id: "A06:2021", name: "Vulnerable & Outdated Components" };
    case "api-mass-assignment":
    case "api-wildcard-method":
      return { id: "A01:2021", name: "Broken Access Control" };
    case "api-missing-validation":
      return { id: "A04:2021", name: "Insecure Design" };
    case "api-exposed-docs":
    case "api-sensitive-exposure":
      return { id: "A05:2021", name: "Security Misconfiguration" };
    default:
      return { id: "A05:2021", name: "Security Misconfiguration" };
  }
}

export async function executeDoctor(
  projectDir: string,
  options: { card?: boolean; owasp?: boolean; fun?: boolean; debug?: boolean } = {},
): Promise<void> {
  const rootDir = path.resolve(projectDir);

  const result = await executeScan(rootDir, {
    quiet: true,
    fullHistory: true,
    debug: options.debug,
  });

  const { findings, healthScore, domainScores, grade, scannedFiles, duration, framework } =
    result;

  if (options.card) {
    const repoName = path.basename(rootDir);
    const filledWidth = Math.max(0, Math.min(800, (healthScore / 100) * 800));
    const fillColor =
      healthScore <= 39
        ? "#FB7185"
        : healthScore <= 74
          ? "#FBBF24"
          : "#34D399";

    const cardSvg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0D1117" />
  <rect x="20" y="20" width="1160" height="590" rx="20" fill="none" stroke="#5EEAD4" stroke-width="1.5" stroke-opacity="0.15" />
  <text x="100" y="160" font-family="system-ui, sans-serif" font-size="54" font-weight="800" fill="#5EEAD4">${repoName}</text>
  <text x="100" y="240" font-family="system-ui, sans-serif" font-size="24" font-weight="700" fill="#64748B">REPOSITORY HEALTH SCORE</text>
  <rect x="100" y="270" width="800" height="36" rx="8" fill="#1E293B" />
  <rect x="100" y="270" width="${filledWidth}" height="36" rx="8" fill="${fillColor}" />
  <text x="920" y="300" font-family="system-ui, sans-serif" font-size="40" font-weight="800" fill="${fillColor}">${healthScore}/100</text>
  <text x="100" y="380" font-family="system-ui, sans-serif" font-size="20" fill="#94A3B8">Security: ${domainScores.security}/100 | Environment: ${domainScores.environment}/100</text>
  <text x="100" y="420" font-family="system-ui, sans-serif" font-size="20" fill="#94A3B8">Git: ${domainScores.git}/100 | Dependencies: ${domainScores.dependencies}/100</text>
  <text x="100" y="460" font-family="system-ui, sans-serif" font-size="20" fill="#94A3B8">Config: ${domainScores.configuration}/100 | Performance: ${domainScores.performance}/100</text>
  <text x="1100" y="570" text-anchor="end" font-family="system-ui, sans-serif" font-size="24" font-weight="700" fill="#64748B" opacity="0.5">bilt.dev</text>
</svg>
    `.trim();

    try {
      const sharp = (await import("sharp")).default;
      const outputPath = path.join(rootDir, "bilt-health-card.png");
      await sharp(Buffer.from(cardSvg)).png().toFile(outputPath);
      console.log("");
      console.log(colors.mintClear.apply("  " + glyphs.fixed + " Generated card: " + outputPath));
      console.log("");
      console.log(colors.slateDim.apply("  Share this card on social media:"));
      console.log(colors.vitalTeal.bold(`  Score: ${healthScore}/100 — scanned with bilt \u2192 bilt.dev`));
      console.log("");
    } catch (err: any) {
      console.error(colors.pulseCoral.apply("  " + glyphs.critical + " Failed to generate card PNG: " + err.message));
    }
    return;
  }

  const isPlain = isPlainMode();
  const maybeSleep = async () => {
    if (!isPlain) {
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  };

  console.log("");
  const require = createRequire(import.meta.url);
  const pkg = require("../../package.json") as { version: string };
  showBliptBanner(pkg.version);
  await maybeSleep();
  console.log("");
  console.log(colors.vitalTeal.bold("  BILT DOCTOR \u2014 Repository Health Report"));
  await maybeSleep();
  console.log("");

  // Overall Score
  console.log(sectionHeader("Overall Repository Score"));
  await maybeSleep();
  console.log("");
  console.log(`  ${formatHealthScore(healthScore)}`);
  await maybeSleep();
  console.log("");
  console.log(
    colors.slateDim.dim(
      `  Scanned ${scannedFiles} files in ${duration}ms${framework ? ` • Framework: ${framework.displayName}` : ""}`,
    ),
  );
  await maybeSleep();
  console.log("");

  // Domain & Category Breakdown
  console.log(sectionHeader("Category Breakdown"));
  await maybeSleep();
  console.log("");

  const categories = [
    { name: "Secret Detection", score: domainScores.security },
    { name: "Environment Variables", score: domainScores.environment },
    { name: "Git Hygiene", score: domainScores.git },
    { name: "Dependencies", score: domainScores.dependencies },
    { name: "Tool Configuration", score: domainScores.configuration },
    { name: "Performance Insights", score: domainScores.performance },
  ];

  for (const cat of categories) {
    const color =
      cat.score >= 90
        ? colors.mintClear
        : cat.score >= 70
          ? colors.amberFlag
          : colors.pulseCoral;
    console.log(`  ${cat.name.padEnd(20)} [${color.apply(`${cat.score}/100`)}]`);
    await maybeSleep();
  }
  console.log("");

  // OWASP Top 10 Breakdown (if --owasp flag passed)
  if (options.owasp) {
    console.log(sectionHeader("OWASP Top 10 Security Compliance"));
    await maybeSleep();
    console.log("");

    const owaspCategories = [
      { id: "A01:2021", name: "Broken Access Control" },
      { id: "A02:2021", name: "Cryptographic Failures" },
      { id: "A03:2021", name: "Injection" },
      { id: "A04:2021", name: "Insecure Design" },
      { id: "A05:2021", name: "Security Misconfiguration" },
      { id: "A06:2021", name: "Vulnerable & Outdated Components" },
      { id: "A07:2021", name: "Identification & Authentication Failures" },
      { id: "A08:2021", name: "Software & Data Integrity Failures" },
      { id: "A09:2021", name: "Security Logging & Monitoring Failures" },
      { id: "A10:2021", name: "Server-Side Request Forgery" },
    ];

    const counts: Record<string, number> = {};
    const grouped: Record<string, ScanFinding[]> = {};
    for (const cat of owaspCategories) {
      counts[cat.id] = 0;
      grouped[cat.id] = [];
    }

    for (const f of findings) {
      const mapping = getOWASPMapping(f);
      counts[mapping.id] = (counts[mapping.id] || 0) + 1;
      grouped[mapping.id]?.push(f);
    }

    for (const cat of owaspCategories) {
      const cnt = counts[cat.id] || 0;
      const statusStr = cnt === 0
        ? colors.mintClear.apply("🟢 PASS")
        : colors.pulseCoral.apply(`🔴 ${cnt} RISK${cnt > 1 ? "S" : ""}`);
      const label = `${cat.id} ${cat.name}`.padEnd(46);
      console.log(`  ${label} [${statusStr}]`);
      await maybeSleep();
    }
    console.log("");

    if (findings.length > 0) {
      console.log(sectionHeader("OWASP Risk Details & Findings"));
      await maybeSleep();
      console.log("");

      for (const cat of owaspCategories) {
        const catFindings = grouped[cat.id] || [];
        if (catFindings.length > 0) {
          console.log(colors.vitalTeal.bold(`  ◆ ${cat.id} ${cat.name}`));
          for (const f of catFindings) {
            const loc = f.line ? `${f.file}:${f.line}` : f.file;
            console.log(`     ${severityIcon(f.severity)} ${f.message} (${loc})`);
            if (f.suggestion) {
              console.log(colors.slateDim.dim(`        Action: ${f.suggestion}`));
            }
          }
          console.log("");
        }
      }
    }
  }

  // Detailed Findings with AI Explanations
  if (findings.length > 0) {
    console.log(sectionHeader("Detailed Issues & AI Insights"));
    await maybeSleep();
    console.log("");

    for (const f of findings) {
      const icon = severityIcon(f.severity);
      const loc = f.line ? `${f.file}:${f.line}` : f.file;
      console.log(`  ${icon} ${colors.pulseCoral.bold(f.message)}  ${colors.slateDim.dim(`(${loc})`)}`);
      await maybeSleep();

      if (f.aiExplanation) {
        console.log(colors.slateDim.dim(`     • What: ${f.aiExplanation.whatIsIt}`));
        console.log(colors.slateDim.dim(`     • Why:  ${f.aiExplanation.whyIsItAProblem}`));
        console.log(colors.vitalTeal.apply(`     • Fix:  ${f.aiExplanation.howToFix.split("\n")[0]}`));
      }
      console.log("");
    }
  }

  // Recommendations
  console.log(sectionHeader("Action Plan"));
  await maybeSleep();
  console.log("");
  console.log(`  1. Run ${colors.vitalTeal.bold("bilt fix")} to apply automatic reversible fixes.`);
  console.log(`  2. Run ${colors.vitalTeal.bold("bilt watch")} for live background protection.`);
  console.log(`  3. Run ${colors.vitalTeal.bold("bilt report --export markdown")} to generate CI/PR reports.`);
  console.log("");
}
