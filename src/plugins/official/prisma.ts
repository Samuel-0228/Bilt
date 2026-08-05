// ─── Prisma Official Plugin ──────────────────────────────────────────────────
// Audits Prisma schema for hardcoded database credentials and env variable usage.
// ─────────────────────────────────────────────────────────────────────────────

import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  PluginManifest,
  PluginContext,
  PluginResult,
  ScanFinding,
} from "../../types/index.js";

const plugin: PluginManifest = {
  name: "bilt-plugin-prisma",
  version: "1.0.0",
  description: "Audits Prisma schemas for hardcoded database connection strings and environment mappings.",

  async check(context: PluginContext): Promise<PluginResult> {
    const findings: ScanFinding[] = [];
    const schemaPath = path.join(context.rootDir, "prisma/schema.prisma");

    try {
      const content = await fs.readFile(schemaPath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!.trim();
        if (line.startsWith("url") && line.includes("=") && !line.includes("env(")) {
          findings.push({
            id: `prisma-hardcoded-db-url-${i + 1}`,
            severity: "critical",
            category: "plugin-finding",
            message: "Hardcoded database URL detected in prisma/schema.prisma datasource",
            file: "prisma/schema.prisma",
            line: i + 1,
            suggestion: 'Use `url = env("DATABASE_URL")` instead of hardcoding database connection string.',
          });
        }
      }
    } catch {
      // Prisma schema not present
    }

    return { findings };
  },
};

export default plugin;
