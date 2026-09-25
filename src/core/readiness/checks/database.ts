// ─── Database Readiness Check ─────────────────────────────────────────────────
// Inspection for database credentials, client/server boundaries,
// connection security, and data durability.
// Status: PARTIAL — automated boundary checks + guided backup review.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReadinessCategory } from "../taxonomy.js";
import type { BiltCheckFinding, CheckMode } from "../finding.js";
import type { CategoryChecker, CheckContext } from "../check-runner.js";
import { generateCheckFingerprint } from "../finding.js";

const CATEGORY: ReadinessCategory = "database";

export const databaseChecker: CategoryChecker = {
  category: CATEGORY,
  mode: "automated" as CheckMode,

  async run(context: CheckContext): Promise<BiltCheckFinding[]> {
    const findings: BiltCheckFinding[] = [];

    for (const file of context.files) {
      const normalizedPath = file.path.replace(/\\/g, "/");
      if (
        normalizedPath.includes("/node_modules/") ||
        normalizedPath.includes("/dist/") ||
        normalizedPath.includes("/build/") ||
        normalizedPath.includes("/test")
      ) {
        continue;
      }

      // 1. Direct database imports in client components
      const isClientCode =
        normalizedPath.includes("/components/") ||
        (normalizedPath.includes("/pages/") && !normalizedPath.includes("/api/")) ||
        (normalizedPath.includes("/app/") && !normalizedPath.includes("/api/") && !normalizedPath.endsWith("route.ts"));

      if (isClientCode) {
        if (
          /@prisma\/client|pg|mysql2|mongoose|drizzle-orm|sqlite3/i.test(
            file.content,
          )
        ) {
          findings.push({
            ruleId: "CHECK-DB-001",
            category: CATEGORY,
            mode: "automated",
            severity: "critical",
            precision: "high",
            maturity: "stable",
            status: "fail",
            title: `Direct database library imported in client file ${file.path}`,
            whyItMatters:
              "Client-side UI code must never import backend database drivers. " +
              "Bundling database drivers client-side leaks internal connection credentials and database schema.",
            technicalDetail:
              `${file.path} contains direct imports of database drivers or ORMs. ` +
              "Database interactions must strictly occur within server-side routes or server actions.",
            agentAction:
              "Move database queries to a backend API handler or server action and call it from the UI component via fetch.",
            fixable: false,
            file: file.path,
            line: 1,
            fingerprint: generateCheckFingerprint("CHECK-DB-001", file.path, 1),
          });
        }
      }

      // 2. Unencrypted database URLs (e.g. postgres:// without sslmode=require)
      const lines = file.content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (
          /postgres(ql)?:\/\/[^:]+:[^@]+@[^/]+\/[^?]+(?!\S*sslmode=require)/i.test(
            line,
          ) &&
          !line.includes("localhost") &&
          !line.includes("127.0.0.1")
        ) {
          findings.push({
            ruleId: "CHECK-DB-002",
            category: CATEGORY,
            mode: "automated",
            severity: "medium",
            precision: "medium",
            maturity: "stable",
            status: "fail",
            title: "Database connection string missing TLS/SSL enforcement",
            whyItMatters:
              "Production database connections across the internet or cloud VPCs without SSL/TLS " +
              "can be intercepted or tampered with by network intermediaries.",
            technicalDetail:
              `${file.path}:${i + 1} appears to connect to an external database without sslmode=require or ssl: true.`,
            agentAction:
              "Append '?sslmode=require' to your connection string or enable TLS in your database client options.",
            fixable: false,
            file: file.path,
            line: i + 1,
            fingerprint: generateCheckFingerprint("CHECK-DB-002", file.path, i + 1),
          });
        }
      }
    }

    // 3. Guided check: Database backup and migration verification
    const usesDatabase = context.files.some((f) =>
      /prisma|drizzle|mongoose|typeorm|sequelize|supabase/i.test(f.content),
    );

    if (usesDatabase) {
      findings.push({
        ruleId: "CHECK-DB-GUIDED-003",
        category: CATEGORY,
        mode: "guided",
        severity: "medium",
        precision: "low",
        maturity: "stable",
        status: "needs-review",
        title: "Verify database backup, point-in-time recovery, and migration strategy",
        whyItMatters:
          "Production databases without automated backups or migration rollbacks risk catastrophic data loss " +
          "during bad deployments or corrupted migrations.",
        technicalDetail:
          "Database usage detected. Verify point-in-time recovery (PITR) is enabled on your managed database provider.",
        agentAction:
          "Review your database provider settings (Supabase, Neon, RDS, PlanetScale) to ensure automated daily backups are active.",
        evidenceRequired: true,
        fixable: false,
        fingerprint: generateCheckFingerprint("CHECK-DB-GUIDED-003", "db-backup-check"),
      });
    }

    return findings;
  },
};
