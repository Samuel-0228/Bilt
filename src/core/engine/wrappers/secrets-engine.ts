import path from "node:path";
import { promises as fs } from "node:fs";
import fg from "fast-glob";
import type { Engine, EngineContext } from "../types.js";
import type { ScanFinding } from "../../../types/index.js";
import { SECRET_RULES } from "../../rules/secret-rules.js";
import { scanFileForSecrets, scanGitHistory } from "../../scan/secrets.js";
import { VERIFIERS } from "../../scan/verifiers/index.js";

export class SecretsEngine implements Engine {
  id = "secrets";
  version = "1.0.0";
  description =
    "Scans files and git history for high-entropy tokens, API keys, and credentials";

  async analyze(context: EngineContext): Promise<ScanFinding[]> {
    const findings: ScanFinding[] = [];
    const rootDir = context.rootDir;
    const config = context.config;

    const scanTargets = await fg(["**/*"], {
      cwd: rootDir,
      ignore: config.ignore,
      onlyFiles: true,
    });

    const textExtensions = new Set([
      ".ts",
      ".js",
      ".tsx",
      ".jsx",
      ".mjs",
      ".cjs",
      ".py",
      ".rb",
      ".go",
      ".rs",
      ".java",
      ".kt",
      ".json",
      ".yaml",
      ".yml",
      ".toml",
      ".xml",
      ".env",
      ".cfg",
      ".conf",
      ".ini",
      ".properties",
      ".sh",
      ".bash",
      ".zsh",
      ".fish",
      ".tf",
      ".hcl",
      ".dockerfile",
      ".md",
      ".txt",
      ".csv",
    ]);

    for (const file of scanTargets) {
      const ext = path.extname(file).toLowerCase();
      const basename = path.basename(file).toLowerCase();
      const isEnvFile = basename.startsWith(".env");
      if (!isEnvFile && !textExtensions.has(ext) && ext !== "") continue;

      const fullPath = path.join(rootDir, file);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.size > 1_048_576) continue;

        const content = await fs.readFile(fullPath, "utf-8");
        const secretFindings = scanFileForSecrets(content, file, SECRET_RULES, {
          entropyThreshold: config.entropyThreshold,
          includeTests: context.options?.includeTests,
        });
        findings.push(...secretFindings);
      } catch {
        // Skip unreadable files
      }
    }

    try {
      const depth = context.options?.fullHistory
        ? undefined
        : config.historyDepth;
      const historyFindings = await scanGitHistory(
        rootDir,
        SECRET_RULES,
        config.entropyThreshold,
        depth,
      );
      findings.push(...historyFindings);
    } catch {
      // Skip git history errors
    }

    // Verify credentials if not disabled
    for (const finding of findings) {
      if (finding.category === "secret-detected" && finding.secret) {
        if (context.options?.noVerify) {
          finding.verificationState = "unverified";
        } else {
          const providerName = finding.provider?.name;
          if (providerName && VERIFIERS[providerName]) {
            try {
              const state = await VERIFIERS[providerName](finding.secret);
              finding.verificationState = state;
              if (state === "verified-live") {
                finding.confidence = "high";
              }
            } catch {
              finding.verificationState = "unverified";
            }
          } else {
            finding.verificationState = "unverified";
          }
        }
      }
    }

    return findings;
  }
}
