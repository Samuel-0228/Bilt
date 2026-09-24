import path from "node:path";
import type { Finding } from "../../finding/types.js";
import { toAgentFinding } from "../../finding/mapper.js";
import type { ScanFinding } from "../../../types/index.js";

const VALIDATION_LIBRARY_PATTERNS = [
  /\b(?:zod|joi|yup|valibot|superstruct|ajv|class-validator)\b/i,
  /\.(?:parse|safeParse|validate|validateAsync|assert)\s*\(/i,
];

const DIRECT_DB_SINK_PATTERNS = [
  /\.(?:create|insert|insertOne|insertMany|update|updateOne|updateMany)\s*\(\s*(?:\{\s*data\s*:\s*)?req\.body\b/i,
  /\.(?:create|insert|insertOne|insertMany|update|updateOne|updateMany)\s*\(\s*(?:\{\s*data\s*:\s*)?body\b/i,
  /\.query\s*\([^)]*req\.body\b/i,
];

export function evaluateInputValidation(
  filePath: string,
  content: string,
): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split("\n");

  const hasSchemaValidator = VALIDATION_LIBRARY_PATTERNS.some((re) =>
    re.test(content),
  );

  if (!hasSchemaValidator) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      // Check if line passes unvalidated body directly to database sink
      const sinkMatch = DIRECT_DB_SINK_PATTERNS.some((re) => re.test(line));

      if (sinkMatch) {
        const raw: ScanFinding = {
          id: `input-validation-missing-${Date.now()}-${i}`,
          ruleId: "RULE-INPUT-001",
          severity: "warning",
          category: "api-missing-validation",
          message:
            "Request payload passed directly to data store without prior schema validation.",
          file: filePath,
          line: i + 1,
          preview: line.trim(),
          suggestion:
            "Validate request body against a strict schema (e.g., Zod, Joi) before persisting to database.",
        };
        findings.push(toAgentFinding(raw, { surroundingSnippet: line.trim() }));
      }
    }
  }

  return findings;
}
