// ─── Content-Type & Schema Validation Detector ──────────────────────────────
// Flags write endpoints parsing request body without schema validation libraries.
// ─────────────────────────────────────────────────────────────────────────────

import type { ScanFinding } from "../../types/index.js";
import type { APIRouteInfo } from "./types.js";

let findingCounter = 0;
function nextFindingId(): string {
  return `api-missing-validation-${Date.now()}-${++findingCounter}`;
}

export function detectContentValidation(routes: APIRouteInfo[]): ScanFinding[] {
  const findings: ScanFinding[] = [];
  const writeRoutes = routes.filter(
    (r) => r.method === "POST" || r.method === "PUT" || r.method === "PATCH"
  );

  for (const route of writeRoutes) {
    const code = route.handlerContent;

    const hasValidation = checkValidationLibraryOrCheck(code);
    if (!hasValidation) {
      const headline = `Missing request body validation on ${route.method} ${route.path}`;
      const why = `Write endpoint parses request body without detecting a schema validation library (Zod, Joi, Yup, Pydantic, DRF serializer, express-validator) or content-type verification.`;
      const action = `Add schema validation for incoming request payloads (e.g. z.object({...}).parse(req.body) or a Pydantic/Joi schema).`;

      findings.push({
        id: nextFindingId(),
        severity: "warning",
        category: "api-missing-validation",
        message: headline,
        file: route.handlerFile,
        line: route.handlerLine,
        suggestion: action,
        confidence: "medium",
        aiExplanation: {
          whatIsIt: `Unvalidated request body on ${route.method} ${route.path}. The endpoint receives request payloads without explicit schema validation.`,
          whyIsItAProblem: why,
          howSerious: `WARNING — invalid or malformed request payloads could lead to unexpected exceptions, type errors, or injection risks.`,
          canItBeExploited: `An attacker can submit unexpected data types or arbitrary keys to trigger backend runtime errors or bypass logic.`,
          howToFix: action,
          canBiltFix: false,
        },
        knowledge: {
          provider: "bilt-api-security",
          type: "api-missing-validation",
          whatItIs: `Missing request body validation on ${route.method} ${route.path}`,
          why,
          safeAsPublic: false,
          action,
          docsUrl: "https://owasp.org/www-project-top-ten/2021/A03_2021-Injection/",
        },
      });
    }
  }

  return findings;
}

function checkValidationLibraryOrCheck(code: string): boolean {
  const validationPatterns = [
    /\b(?:zod|z\.(?:object|string|number|parse|safeParse))\b/i,
    /\b(?:joi|Joi\.(?:object|string|validate))\b/i,
    /\b(?:yup|yup\.(?:object|string|validate))\b/i,
    /\b(?:pydantic|BaseModel|field_validator|validator)\b/i,
    /\b(?:Serializer|ModelSerializer|serializers\.)\b/i,
    /\b(?:express-validator|body\s*\(|check\s*\(|validationResult)\b/i,
    /\b(?:typebox|Type\.(?:Object|String))\b/i,
    /\b(?:valibot|v\.(?:object|string|parse))\b/i,
    /\b(?:req|request)\.(?:is|accepts)\s*\(/i,
    /Content-Type/i,
  ];

  for (const pat of validationPatterns) {
    if (pat.test(code)) return true;
  }

  return false;
}
