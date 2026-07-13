// ─── Docker Plugin ───────────────────────────────────────────────────────────
// Scans Dockerfiles for hardcoded secrets and validates .dockerignore.

import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  PluginManifest,
  PluginContext,
  PluginResult,
  ScanFinding,
} from "../../types/index.js";

// Patterns that indicate hardcoded secrets in Dockerfile ENV directives
const SECRET_PATTERNS = [
  {
    name: "API key",
    pattern:
      /ENV\s+\w*(API_KEY|APIKEY|API_SECRET)\w*\s*=\s*["']?(?!(\$\{|<|your_|changeme|placeholder|xxx))\S+/i,
  },
  {
    name: "password",
    pattern:
      /ENV\s+\w*(PASSWORD|PASSWD|DB_PASS)\w*\s*=\s*["']?(?!(\$\{|<|your_|changeme|placeholder|xxx))\S+/i,
  },
  {
    name: "token",
    pattern:
      /ENV\s+\w*(TOKEN|SECRET_KEY|PRIVATE_KEY|ACCESS_KEY)\w*\s*=\s*["']?(?!(\$\{|<|your_|changeme|placeholder|xxx))\S+/i,
  },
  {
    name: "connection string",
    pattern:
      /ENV\s+\w*(DATABASE_URL|REDIS_URL|MONGO_URI|CONNECTION_STRING)\w*\s*=\s*["']?(?!(\$\{|<|your_|changeme|placeholder|xxx))\S+/i,
  },
];

const plugin: PluginManifest = {
  name: "bilt-plugin-docker",
  version: "1.0.0",
  description:
    "Scans Dockerfiles for hardcoded secrets and validates .dockerignore configuration.",

  async check(context: PluginContext): Promise<PluginResult> {
    const findings: ScanFinding[] = [];

    // ── Scan Dockerfiles for ENV with hardcoded secrets ────────────────
    const dockerfiles = context.files.filter(
      (f) =>
        path.basename(f) === "Dockerfile" ||
        path.basename(f).startsWith("Dockerfile.") ||
        f.endsWith(".dockerfile"),
    );

    for (const dockerFile of dockerfiles) {
      const fullPath = path.join(context.rootDir, dockerFile);
      let content: string;
      try {
        content = await fs.readFile(fullPath, "utf-8");
      } catch {
        continue;
      }

      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const trimmed = line.trim();

        // Skip comments and empty lines
        if (trimmed.startsWith("#") || trimmed === "") continue;

        // Skip ARG directives that use build-args (safe pattern)
        if (/^ARG\s/i.test(trimmed)) continue;

        for (const { name, pattern } of SECRET_PATTERNS) {
          if (pattern.test(trimmed)) {
            findings.push({
              id: `docker-env-secret-${dockerFile}-${i + 1}`,
              severity: "critical",
              category: "plugin-finding",
              message: `Hardcoded ${name} found in Dockerfile ENV directive`,
              file: dockerFile,
              line: i + 1,
              suggestion:
                "Use ARG with --build-arg or mount secrets at runtime instead of hardcoding in ENV.",
            });
            break; // One finding per line
          }
        }
      }
    }

    // ── Check .dockerignore exists and excludes .env ──────────────────
    if (dockerfiles.length > 0) {
      const dockerignorePath = path.join(context.rootDir, ".dockerignore");
      try {
        const content = await fs.readFile(dockerignorePath, "utf-8");
        const lines = content
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l !== "" && !l.startsWith("#"));

        const coversEnv = lines.some(
          (l) =>
            l === ".env" ||
            l === ".env*" ||
            l === ".env.*" ||
            l === "*.env" ||
            l === ".env.local" ||
            l === ".env.production",
        );

        if (!coversEnv) {
          findings.push({
            id: "docker-dockerignore-env",
            severity: "warning",
            category: "plugin-finding",
            message:
              ".dockerignore exists but does not exclude .env files — secrets may be copied into image",
            file: ".dockerignore",
            suggestion:
              "Add `.env*` to your .dockerignore to prevent copying secrets into the Docker image.",
          });
        }
      } catch {
        // .dockerignore doesn't exist
        findings.push({
          id: "docker-no-dockerignore",
          severity: "warning",
          category: "plugin-finding",
          message:
            "No .dockerignore found — .env files may be copied into Docker image during build",
          file: dockerfiles[0]!,
          suggestion:
            "Create a .dockerignore file and add `.env*` to prevent secrets from entering your image.",
        });
      }
    }

    return { findings };
  },
};

export default plugin;
