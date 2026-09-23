import path from "node:path";
import { promises as fs } from "node:fs";
import fg from "fast-glob";
import type { Engine, EngineContext, EngineFixResult } from "../types.js";
import type { ScanFinding } from "../../../types/index.js";
import { SecurityRuleEngine } from "../../security-engine/rule-engine.js";
import type { SecurityFindingDetails } from "../../security-engine/types.js";

export class SecurityRulesEngine implements Engine {
  id = "security-rules";
  version = "1.0.0";
  description =
    "Deterministic AST security engine auditing anti-patterns and vulnerabilities";

  private ruleEngine = new SecurityRuleEngine();

  async analyze(context: EngineContext): Promise<ScanFinding[]> {
    const findings: ScanFinding[] = [];
    const rootDir = context.rootDir;
    const config = context.config;

    let filePayloads: Array<{ path: string; content: string }> = [];
    if (context.files && context.files.length > 0) {
      filePayloads = context.files;
    } else {
      const scanTargets = await fg(
        ["**/*.{ts,js,tsx,jsx,json,yml,yaml,md,env*,Dockerfile}"],
        {
          cwd: rootDir,
          ignore: config.ignore,
          onlyFiles: true,
        },
      );

      for (const relPath of scanTargets) {
        const fullPath = path.join(rootDir, relPath);
        try {
          const stat = await fs.stat(fullPath);
          if (stat.size > 1_048_576) continue;
          const content = await fs.readFile(fullPath, "utf-8");
          filePayloads.push({ path: relPath, content });
        } catch {
          // Skip unreadable files
        }
      }
    }

    const engineFindings = this.ruleEngine.analyzeProject(
      filePayloads,
      context.frameworksDetected || [],
    );

    for (const ef of engineFindings) {
      findings.push({
        id: `sec-rule-${ef.ruleId.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        severity: ef.severity,
        category: "framework-warning",
        message: `[${ef.ruleId}] ${ef.title}: ${ef.message}`,
        file: ef.evidence.file,
        line: ef.evidence.line,
        column: ef.evidence.column,
        suggestion: ef.suggestedFix,
        ruleId: ef.ruleId,
        confidence: ef.confidence,
        aiExplanation: {
          whatIsIt: `${ef.title}. ${ef.whyThisIsDangerous}`,
          whyIsItAProblem: ef.whyThisIsDangerous,
          howSerious: `${ef.severity.toUpperCase()} (${ef.confidence} confidence evidence)`,
          canItBeExploited: ef.howAttackersAbuseIt,
          howToFix: ef.suggestedFix,
          canBiltFix: ef.automaticFixAvailability.available,
        },
      });
    }

    return findings;
  }
}
