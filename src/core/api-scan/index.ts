// ─── API Scan Engine Orchestrator ──────────────────────────────────────────────
// Runs static, local security analysis against detected API routes and OpenAPI specs.
// ─────────────────────────────────────────────────────────────────────────────

import type { ScanFinding } from "../../types/index.js";
import { detectApiRoutes } from "./route-detector.js";
import { detectMassAssignment } from "./mass-assignment.js";
import { detectMethodAllowlisting } from "./method-allowlist.js";
import { detectContentValidation } from "./content-validation.js";
import { detectExposedDocs } from "./docs-exposed.js";
import { detectSensitiveSchemaExposure } from "./schema-exposure.js";
import type { APIRouteInfo } from "./types.js";

export async function performApiScan(
  rootDir: string,
  files?: Array<{ path: string; content: string }>
): Promise<{ findings: ScanFinding[]; routes: APIRouteInfo[] }> {
  const findings: ScanFinding[] = [];

  // 1. Detect normalized API routes
  const routes = await detectApiRoutes(rootDir, files);

  // 2. Mass assignment risk detection
  const massAssignmentFindings = await detectMassAssignment(rootDir, routes, files);
  findings.push(...massAssignmentFindings);

  // 3. HTTP method allowlisting check
  const methodFindings = detectMethodAllowlisting(routes);
  findings.push(...methodFindings);

  // 4. Content-type & schema validation check
  const validationFindings = detectContentValidation(routes);
  findings.push(...validationFindings);

  // 5. Exposed production documentation check
  const docsFindings = await detectExposedDocs(rootDir, files);
  findings.push(...docsFindings);

  // 6. Sensitive response schema field exposure check
  const schemaFindings = await detectSensitiveSchemaExposure(rootDir, files);
  findings.push(...schemaFindings);

  return { findings, routes };
}
