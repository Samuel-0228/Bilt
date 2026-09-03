// ─── Report Command ──────────────────────────────────────────────────────────
// Generates Markdown or JSON project health reports for CI/CD and documentation.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import path from "node:path";
import { executeScan } from "./scan.js";
import { colors } from "../ui/theme.js";

export async function executeReport(
  projectDir: string,
  options: { format?: string; output?: string; export?: string; stdout?: boolean } = {},
): Promise<void> {
  const rootDir = path.resolve(projectDir);
  const result = await executeScan(rootDir, { quiet: true });

  const format = (options.format || "markdown").toLowerCase();

  // Determine output target path (defaulting to bilt-report.md or bilt-report.json unless --stdout is passed)
  let outputPath: string | null = options.output || options.export || null;
  if (!outputPath && !options.stdout) {
    outputPath = format === "json" ? "bilt-report.json" : "bilt-report.md";
  }

  if (format === "json") {
    const jsonOutput = JSON.stringify(result, null, 2);
    if (outputPath) {
      const fullPath = path.resolve(rootDir, outputPath);
      await fs.writeFile(fullPath, jsonOutput, "utf-8");
      console.log(colors.mintClear.apply(`✔ Report saved to ${outputPath}`));
    } else {
      console.log(jsonOutput);
    }
    return;
  }

  // Generate Markdown report
  let md = `# Bilt Repository Health Report\n\n`;
  md += `**Overall Health Score:** ${result.healthScore}/100 (**Grade: ${result.grade}**)\n\n`;

  md += `## Domain Health Scores\n\n`;
  md += `| Health Domain | Score | Status |\n`;
  md += `|---|---|---|\n`;
  md += `| Security | ${result.domainScores.security}/100 | ${result.domainScores.security >= 90 ? "🟢 Healthy" : "🟡 Needs Attention"} |\n`;
  md += `| Environment | ${result.domainScores.environment}/100 | ${result.domainScores.environment >= 90 ? "🟢 Healthy" : "🟡 Needs Attention"} |\n`;
  md += `| Git Hygiene | ${result.domainScores.git}/100 | ${result.domainScores.git >= 90 ? "🟢 Healthy" : "🟡 Needs Attention"} |\n`;
  md += `| Dependencies | ${result.domainScores.dependencies}/100 | ${result.domainScores.dependencies >= 90 ? "🟢 Healthy" : "🟡 Needs Attention"} |\n`;
  md += `| Configuration | ${result.domainScores.configuration}/100 | ${result.domainScores.configuration >= 90 ? "🟢 Healthy" : "🟡 Needs Attention"} |\n`;
  md += `| Performance | ${result.domainScores.performance}/100 | ${result.domainScores.performance >= 90 ? "🟢 Healthy" : "🟡 Needs Attention"} |\n\n`;

  md += `## Detailed Issues & AI Guidance\n\n`;
  if (result.findings.length === 0) {
    md += `*No issues detected! Repository is in excellent health.*\n\n`;
  } else {
    for (const f of result.findings) {
      md += `### [${f.severity.toUpperCase()}] ${f.message}\n`;
      md += `- **File:** \`${f.file}${f.line ? `:${f.line}` : ""}\`\n`;
      md += `- **Category:** \`${f.category}\`\n`;
      if (f.aiExplanation) {
        md += `- **What is it?** ${f.aiExplanation.whatIsIt}\n`;
        md += `- **Why is it a problem?** ${f.aiExplanation.whyIsItAProblem}\n`;
        md += `- **Exploitation Risk:** ${f.aiExplanation.canItBeExploited}\n`;
        md += `- **Remediation:** ${f.aiExplanation.howToFix}\n`;
      }
      md += `\n`;
    }
  }

  md += `---\n*Generated automatically by Bilt Toolkit*\n`;

  if (outputPath) {
    const fullPath = path.resolve(rootDir, outputPath);
    await fs.writeFile(fullPath, md, "utf-8");
    console.log(colors.mintClear.apply(`✔ Report saved to ${outputPath}`));
  } else {
    console.log(md);
  }
}
