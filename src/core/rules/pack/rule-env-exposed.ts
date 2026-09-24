import path from "node:path";
import type { Finding } from "../../finding/types.js";
import { toAgentFinding } from "../../finding/mapper.js";
import type { ScanFinding } from "../../../types/index.js";

const CLIENT_PREFIXES = [
  "NEXT_PUBLIC_",
  "VITE_",
  "REACT_APP_",
  "GATSBY_",
  "NUXT_PUBLIC_",
];

const SENSITIVE_KEYWORDS = [
  "SECRET",
  "PRIVATE",
  "PASSWORD",
  "TOKEN",
  "API_KEY",
  "AUTH",
  "CREDENTIAL",
  "SERVICE_ROLE",
];

export function evaluateEnvExposure(
  filePath: string,
  content: string,
): Finding[] {
  const findings: Finding[] = [];
  const normalizedPath = filePath.replace(/\\/g, "/");
  const basename = path.basename(normalizedPath).toLowerCase();

  // 1. Committed .env file check (excluding .env.example, .env.template, .env.sample)
  const isEnvFile = basename.startsWith(".env") || basename.endsWith(".env");
  const isSafeEnvExample =
    basename.includes("example") ||
    basename.includes("template") ||
    basename.includes("sample");

  if (isEnvFile && !isSafeEnvExample) {
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();
      if (!line || line.startsWith("#")) continue;

      const equalIdx = line.indexOf("=");
      if (equalIdx > 0) {
        const key = line.substring(0, equalIdx).trim();
        const val = line.substring(equalIdx + 1).trim();

        const isSensitiveKey = SENSITIVE_KEYWORDS.some((kw) =>
          key.toUpperCase().includes(kw),
        );

        if (val.length > 5 && isSensitiveKey) {
          const raw: ScanFinding = {
            id: `env-committed-${Date.now()}-${i}`,
            ruleId: "RULE-ENV-001",
            severity: "critical",
            category: "env-exposed",
            message: `Sensitive environment variable '${key}' found in committed environment file '${basename}'`,
            file: filePath,
            line: i + 1,
            preview: line,
            suggestion:
              "Add .env to .gitignore and use .env.example with dummy placeholders.",
          };
          findings.push(toAgentFinding(raw, { surroundingSnippet: line }));
        }
      }
    }
  }

  // 2. Client prefix exposure check (e.g. NEXT_PUBLIC_SECRET_KEY, VITE_DB_PASSWORD)
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    for (const prefix of CLIENT_PREFIXES) {
      if (line.includes(prefix)) {
        for (const kw of SENSITIVE_KEYWORDS) {
          const pattern = new RegExp(
            `${prefix}[A-Za-z0-9_]*${kw}[A-Za-z0-9_]*`,
            "i",
          );
          if (pattern.test(line)) {
            const raw: ScanFinding = {
              id: `env-client-exposed-${Date.now()}-${i}`,
              ruleId: "RULE-ENV-001",
              severity: "critical",
              category: "env-exposed",
              message: `Sensitive variable exposed to client bundle with '${prefix}' prefix`,
              file: filePath,
              line: i + 1,
              preview: line,
              suggestion:
                "Do not prefix secret server-side variables with frontend bundle prefixes.",
            };
            findings.push(toAgentFinding(raw, { surroundingSnippet: line }));
            break;
          }
        }
      }
    }
  }

  return findings;
}
