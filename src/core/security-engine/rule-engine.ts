import type { SecurityRule, SecurityFindingDetails, ASTContext } from "./types.js";
import { ALL_SECURITY_RULES } from "./rules/index.js";
import { ASTAnalyzer } from "./ast-analyzer.js";
import { SecretAnalyzer } from "./secret-analyzer.js";
import { EnvAnalyzer, type EnvFile } from "./env-analyzer.js";

export class SecurityRuleEngine {
  private rules: SecurityRule[] = [];

  constructor(customRules?: SecurityRule[]) {
    this.rules = [...ALL_SECURITY_RULES, ...(customRules || [])];
  }

  /**
   * Registers additional dynamic or plugin rules
   */
  public registerRule(rule: SecurityRule): void {
    this.rules.push(rule);
  }

  /**
   * Returns all registered rules
   */
  public getRules(): SecurityRule[] {
    return this.rules;
  }

  /**
   * Evaluates a single file content against all active security rules
   */
  public analyzeFile(filePath: string, fileContent: string): SecurityFindingDetails[] {
    const findings: SecurityFindingDetails[] = [];
    const normPath = filePath.replace(/\\/g, "/");

    // Skip node_modules, dist, build, coverage, binary files
    if (
      normPath.includes("/node_modules/") ||
      normPath.includes("/dist/") ||
      normPath.includes("/build/") ||
      normPath.includes("/coverage/") ||
      normPath.includes("/.git/")
    ) {
      return findings;
    }

    const { context } = ASTAnalyzer.parse(filePath, fileContent);

    // 1. Run all AST / Code Pattern security rules
    for (const rule of this.rules) {
      try {
        const matches = rule.match(context);
        findings.push(...matches);
      } catch (err) {
        // Deterministic error handling per rule
      }
    }

    // 2. Run Secret Analyzer across raw source / doc / config / markdown / prompt files
    const secretsInFile = SecretAnalyzer.scanTextForSecrets(fileContent, filePath);
    secretsInFile.forEach((sec) => {
      findings.push({
        ruleId: "SEC-SEC-001",
        category: "secrets",
        severity: "critical",
        confidence: sec.confidence,
        title: `Exposed Hardcoded Secret (${sec.type})`,
        message: `Hardcoded ${sec.type} detected at line ${sec.line}: ${sec.reason}`,
        evidence: {
          file: filePath,
          line: sec.line,
          snippet: sec.snippet,
        },
        affectedFiles: [filePath],
        affectedLines: [sec.line],
        whyThisIsDangerous:
          "Hardcoding sensitive backend credentials or private keys directly in source files or documentation exposes them to anyone with read access or to git history.",
        howAttackersAbuseIt:
          "Attackers scan repositories, git commits, or built assets to extract private keys, database passwords, and API credentials.",
        suggestedFix: "Move secret values to environment variables (.env) and reference them via process.env.",
        automaticFixAvailability: { available: false },
        documentation: {
          owasp: "A02:2021-Cryptographic Failures",
          cwe: "CWE-798",
        },
        owaspMapping: "A02:2021 - Cryptographic Failures",
      });
    });

    return findings;
  }

  /**
   * Analyzes an entire project directory (env files, source files)
   */
  public analyzeProject(
    files: Array<{ path: string; content: string }>,
    frameworks: string[] = []
  ): SecurityFindingDetails[] {
    const findings: SecurityFindingDetails[] = [];

    const envFiles: EnvFile[] = [];
    const sourceCodeEnvRefs = new Map<string, Array<{ file: string; line: number }>>();

    files.forEach((f) => {
      const normPath = f.path.replace(/\\/g, "/");

      // Collect .env files
      if (normPath.endsWith(".env") || normPath.includes(".env.")) {
        const entries = new Map<string, { value: string; line: number; comment?: string }>();
        const lines = f.content.split("\n");

        lines.forEach((lineText, idx) => {
          const trimmed = lineText.trim();
          if (trimmed && !trimmed.startsWith("#")) {
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx > 0) {
              const key = trimmed.substring(0, eqIdx).trim();
              const val = trimmed.substring(eqIdx + 1).trim();
              entries.set(key, { value: val, line: idx + 1 });
            }
          }
        });

        envFiles.push({ filePath: f.path, entries });
      }

      // Collect process.env references in JS/TS source code
      if (normPath.endsWith(".ts") || normPath.endsWith(".js") || normPath.endsWith(".tsx") || normPath.endsWith(".jsx")) {
        const lines = f.content.split("\n");
        lines.forEach((lineText, idx) => {
          const matches = lineText.matchAll(/process\.env\.([A-Z0-9_]+)/gi);
          for (const match of matches) {
            const envKey = match[1];
            if (!envKey) continue;
            const arr = sourceCodeEnvRefs.get(envKey) || [];
            arr.push({ file: f.path, line: idx + 1 });
            sourceCodeEnvRefs.set(envKey, arr);
          }
        });
      }

      // Run per-file code analysis
      const fileFindings = this.analyzeFile(f.path, f.content);
      findings.push(...fileFindings);
    });

    // Run env analyzer
    if (envFiles.length > 0) {
      const envFindings = EnvAnalyzer.analyze(envFiles, sourceCodeEnvRefs, frameworks);
      findings.push(...envFindings);
    }

    return findings;
  }
}
