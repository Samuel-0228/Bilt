// ─── Command: bilt explain ────────────────────────────────────────────────────
// Explains production readiness concepts with structured education guides.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TAXONOMY, getAllCategories } from "../core/readiness/taxonomy.js";
import { colors, glyphs, sectionHeader } from "../ui/theme.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATEGORY_ALIASES: Record<string, string> = {
  authentication: "auth",
  secrets: "secrets-and-env",
  env: "secrets-and-env",
  input: "input-validation",
  inputs: "input-validation",
  validation: "input-validation",
  api: "api-abuse-and-cost",
  abuse: "api-abuse-and-cost",
  cost: "api-abuse-and-cost",
  db: "database",
  deps: "dependencies",
  dependency: "dependencies",
  logging: "error-handling-logs",
  logs: "error-handling-logs",
  errors: "error-handling-logs",
  headers: "transport-and-headers",
  cors: "transport-and-headers",
  transport: "transport-and-headers",
  deploy: "deploy-config",
  config: "deploy-config",
  uploads: "file-uploads",
  upload: "file-uploads",
  payment: "payments",
  privacy: "privacy-and-pii",
  pii: "privacy-and-pii",
  monitoring: "monitoring-rollback",
  rollback: "monitoring-rollback",
};

export async function executeExplain(categoryArg?: string): Promise<number> {
  if (!categoryArg) {
    printCategoryCatalog();
    return 0;
  }

  const normalized = categoryArg.toLowerCase().trim();
  const categoryId = CATEGORY_ALIASES[normalized] || normalized;

  // Resolve concepts directory (works in dev and dist)
  const conceptsDir = path.resolve(__dirname, "../../src/concepts");
  const distConceptsDir = path.resolve(__dirname, "../concepts");

  let filePath = path.join(conceptsDir, `${categoryId}.md`);
  try {
    await fs.access(filePath);
  } catch {
    filePath = path.join(distConceptsDir, `${categoryId}.md`);
  }

  try {
    const content = await fs.readFile(filePath, "utf-8");
    console.log("");
    console.log(content);
    console.log("");
    return 0;
  } catch {
    console.error("");
    console.error(
      colors.pulseCoral.bold(
        `  ${glyphs.critical} Unknown category: '${categoryArg}'`,
      ),
    );
    console.error("");
    printCategoryCatalog();
    return 1;
  }
}

function printCategoryCatalog(): void {
  console.log(sectionHeader("Bilt Production Readiness Concepts"));
  console.log("Learn how to inspect and harden AI-generated applications before shipping.\n");
  console.log("Usage: bilt explain <category>\n");

  console.log("Available categories:\n");
  for (const meta of TAXONOMY) {
    const badge =
      meta.enforcement === "enforced"
        ? colors.mintClear.apply("[ENFORCED]")
        : meta.enforcement === "guided"
          ? colors.vitalTeal.apply("[GUIDED]")
          : meta.enforcement === "partial"
            ? colors.amberFlag.apply("[PARTIAL]")
            : colors.slateDim.dim("[COMING SOON]");

    console.log(`  ${meta.id.padEnd(24)} ${badge.padEnd(16)} ${meta.name}`);
  }
  console.log("");
}
