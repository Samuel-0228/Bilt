// ─── Scan Step: Secrets & Credentials ─────────────────────────────────────────

import path from "node:path";
import { promises as fs } from "node:fs";
import fg from "fast-glob";
import type { ScanFinding, Severity } from "../../../types/index.js";
import { SECRET_RULES } from "../../../core/rules/secret-rules.js";
import { scanFileForSecrets, scanGitHistory } from "../../../core/scan/secrets.js";
import { VERIFIERS } from "../../../core/scan/verifiers/index.js";
import { applyOverridesAndFilter } from "../filter.js";
import { safeReadProjectFile } from "../../../core/safety/fs-guard.js";
import type { ScanStepContext } from "./context.js";

const TEXT_EXTENSIONS = new Set([
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

export interface SecretsStepResult {
  findings: ScanFinding[];
  scannedFiles: number;
}

export async function runSecretsStep(
  ctx: ScanStepContext,
): Promise<SecretsStepResult> {
  const stepFindings: ScanFinding[] = [];
  let scannedFiles = 0;

  const scanTargets = await fg(["**/*"], {
    cwd: ctx.rootDir,
    ignore: ctx.config.ignore,
    onlyFiles: true,
  });

  for (const file of scanTargets) {
    const ext = path.extname(file).toLowerCase();
    const basename = path.basename(file).toLowerCase();

    const isEnvFile = basename.startsWith(".env");
    if (!isEnvFile && !TEXT_EXTENSIONS.has(ext) && ext !== "") continue;

    try {
      const readResult = await safeReadProjectFile(file, ctx.rootDir);
      if (readResult.content === null) continue;

      const secretFindings = scanFileForSecrets(
        readResult.content,
        file,
        SECRET_RULES,
        {
          entropyThreshold: ctx.config.entropyThreshold,
          includeTests: ctx.options.includeTests,
        },
      );
      stepFindings.push(...secretFindings);
      scannedFiles++;
    } catch {
      // Skip unreadable files
    }
  }

  try {
    const depth = ctx.options.fullHistory ? undefined : ctx.config.historyDepth;
    const historyFindings = await scanGitHistory(
      ctx.rootDir,
      SECRET_RULES,
      ctx.config.entropyThreshold,
      depth,
    );
    stepFindings.push(...historyFindings);
  } catch {
    // Skip git history scan failures
  }

  // Credential liveness verification
  for (const finding of stepFindings) {
    if (finding.category === "secret-detected" && finding.secret) {
      if (ctx.options.noVerify) {
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
      if (!ctx.options.retainSecrets) {
        delete finding.secret;
      }
    }
  }

  const filtered = applyOverridesAndFilter(
    stepFindings,
    ctx.config,
    ctx.options.severity as Severity,
  );

  return {
    findings: filtered,
    scannedFiles,
  };
}
