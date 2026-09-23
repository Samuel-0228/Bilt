import type { Engine, EngineContext } from "../types.js";
import type { ScanFinding, Severity } from "../../../types/index.js";
import { findEnvFiles, performEnvScan } from "../../scan/env.js";
import {
  checkEnvFilesIgnoredWithGit,
  checkCommonDirsIgnored,
} from "../../scan/gitignore.js";
import { scanGitRepository } from "../../scan/git.js";

export class EnvGitignoreEngine implements Engine {
  id = "env-gitignore";
  version = "1.0.0";
  description =
    "Verifies .env hygiene, committed secrets, gitignore coverage, and env var drift";

  async analyze(context: EngineContext): Promise<ScanFinding[]> {
    const findings: ScanFinding[] = [];
    const rootDir = context.rootDir;
    const config = context.config;

    // Check gitignore and common directories
    const envFiles = await findEnvFiles(rootDir);
    const gitignoreFindings = await checkEnvFilesIgnoredWithGit(
      rootDir,
      envFiles,
    );
    const commonDirsFindings = await checkCommonDirsIgnored(rootDir);
    findings.push(...gitignoreFindings, ...commonDirsFindings);

    // Git repository health
    const gitRepoFindings = await scanGitRepository(rootDir, {
      historyDepth: config.historyDepth,
    });
    findings.push(...gitRepoFindings);

    // Environment variables
    const envFindings = await performEnvScan(rootDir, config, {
      debug: context.options?.debug,
    });
    findings.push(...envFindings);

    return findings;
  }
}
