// ─── Exposed API Documentation Detector ──────────────────────────────────────
// Detects Swagger UI, GraphQL Playground, or OpenAPI docs enabled without production guards.
// ─────────────────────────────────────────────────────────────────────────────

import fg from "fast-glob";
import path from "node:path";
import fs from "node:fs/promises";
import type { ScanFinding } from "../../types/index.js";

let findingCounter = 0;
function nextFindingId(): string {
  return `api-exposed-docs-${Date.now()}-${++findingCounter}`;
}

export async function detectExposedDocs(
  rootDir: string,
  filePayloads?: Array<{ path: string; content: string }>
): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = [];

  let payloads = filePayloads;
  if (!payloads) {
    payloads = [];
    const files = await fg(["**/*.{ts,js,tsx,jsx,py,rb,yaml,yml,json}"], {
      cwd: rootDir,
      ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
      onlyFiles: true,
    });
    for (const relPath of files) {
      try {
        const content = await fs.readFile(path.join(rootDir, relPath), "utf-8");
        payloads.push({ path: relPath, content });
      } catch {
        // Skip
      }
    }
  }

  const docsLibraryRegex = /(?:swagger-ui-express|swagger-ui|graphiql|apollo-server-express|scalar\/express|drf_spectacular|flask_restx\.Api|SwaggerUI|ScalarUI)/i;
  const docsEndpointRegex = /(?:app|router)\.use\s*\(\s*['"]\/(?:docs|swagger|api-docs|graphiql|playground|redoc)['"]/i;

  for (const file of payloads) {
    const code = file.content;
    const lines = code.split("\n");

    if (docsLibraryRegex.test(code) || docsEndpointRegex.test(code)) {
      // Check if guarded by production env check
      const hasProductionGuard = checkProductionGuard(code);

      if (!hasProductionGuard) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          if (docsLibraryRegex.test(line) || docsEndpointRegex.test(line)) {
            const headline = `Interactive API documentation enabled without environment guard in ${path.basename(file.path)}`;
            const why = `Swagger UI, GraphQL Playground, or OpenAPI docs route is registered without restricting access in production (e.g. process.env.NODE_ENV !== 'production').`;
            const action = `Wrap API docs route registration in an environment check (e.g., if (process.env.NODE_ENV !== 'production') { app.use('/docs', ...) }).`;

            findings.push({
              id: nextFindingId(),
              severity: "warning",
              category: "api-exposed-docs",
              message: headline,
              file: file.path,
              line: i + 1,
              suggestion: action,
              confidence: "high",
              aiExplanation: {
                whatIsIt: `Exposed API documentation in production config in ${file.path}. Interactive API docs are registered without environment restrictions.`,
                whyIsItAProblem: why,
                howSerious: `WARNING — exposes full API schema, internal endpoint signatures, and parameter structures to public users in production.`,
                canItBeExploited: `Attackers can inspect live Swagger/GraphQL UI to discover unlinked endpoints, parameter schemas, and attack surfaces.`,
                howToFix: action,
                canBiltFix: false,
              },
              knowledge: {
                provider: "bilt-api-security",
                type: "api-exposed-docs",
                whatItIs: `Exposed API documentation in ${file.path}`,
                why,
                safeAsPublic: false,
                action,
                docsUrl: "https://owasp.org/www-project-top-ten/2021/A01_2021-Broken_Access_Control/",
              },
            });
            break; // One finding per file is sufficient
          }
        }
      }
    }
  }

  return findings;
}

function checkProductionGuard(code: string): boolean {
  const guardPatterns = [
    /process\.env\.NODE_ENV\s*!==\s*['"]production['"]/i,
    /process\.env\.NODE_ENV\s*===\s*['"]development['"]/i,
    /NODE_ENV\s*!==\s*['"]production['"]/i,
    /DEBUG\s*=\s*True/i,
    /config\.isDevelopment/i,
    /isProd(?:uction)?\s*===\s*false/i,
    /if\s*\(!isProd/i,
  ];

  for (const pat of guardPatterns) {
    if (pat.test(code)) return true;
  }
  return false;
}
