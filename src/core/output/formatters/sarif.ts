import type { Finding } from "../../finding/types.js";

export interface SarifRule {
  id: string;
  name?: string;
  shortDescription: { text: string };
  fullDescription: { text: string };
  help: {
    text: string;
    markdown?: string;
  };
  defaultConfiguration: {
    level: "error" | "warning" | "note";
  };
  properties?: {
    tags?: string[];
    precision?: "very-high" | "high" | "medium" | "low";
    "security-severity"?: string;
  };
  helpUri?: string;
}

export interface SarifResult {
  ruleId: string;
  ruleIndex?: number;
  level: "error" | "warning" | "note";
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: {
        uri: string;
        uriBaseId?: string;
      };
      region: {
        startLine: number;
        startColumn: number;
        endLine: number;
        endColumn: number;
      };
    };
  }>;
  partialFingerprints?: Record<string, string>;
  fingerprints?: Record<string, string>;
}

export interface SarifReport {
  version: "2.1.0";
  $schema: string;
  runs: Array<{
    tool: {
      driver: {
        name: string;
        version: string;
        informationUri: string;
        rules: SarifRule[];
      };
    };
    originalUriBaseIds?: Record<string, { uri: string }>;
    columnKind?: "utf16CodeUnits";
    results: SarifResult[];
  }>;
}

function severityToSarifLevel(severity: string): "error" | "warning" | "note" {
  switch (severity) {
    case "critical":
      return "error";
    case "warning":
      return "warning";
    default:
      return "note";
  }
}

function severityToSecurityScore(severity: string): string {
  switch (severity) {
    case "critical":
      return "9.0";
    case "warning":
      return "5.5";
    default:
      return "2.0";
  }
}

function precisionToSarif(precision: string): "very-high" | "high" | "medium" | "low" {
  switch (precision) {
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
      return "low";
    default:
      return "high";
  }
}

export function formatSarifOutput(
  findings: Finding[],
  toolVersion: string = "1.0.5",
): SarifReport {
  const rulesMap = new Map<string, SarifRule>();
  const ruleIndices = new Map<string, number>();

  let ruleIndexCounter = 0;
  for (const f of findings) {
    if (!rulesMap.has(f.rule_id)) {
      const sanitizedName = f.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 255);
      const helpText = `${f.title}\n\n${f.explanation}${f.agent_action ? `\n\nSuggested Fix: ${f.agent_action}` : ""}`;
      const helpMarkdown = `### ${f.title}\n\n${f.explanation}${f.agent_action ? `\n\n**Suggested Fix**: ${f.agent_action}` : ""}`;

      rulesMap.set(f.rule_id, {
        id: f.rule_id,
        name: sanitizedName,
        shortDescription: { text: f.title.slice(0, 1024) },
        fullDescription: { text: f.explanation.slice(0, 1024) },
        help: {
          text: helpText,
          markdown: helpMarkdown,
        },
        defaultConfiguration: {
          level: severityToSarifLevel(f.severity),
        },
        properties: {
          tags: ["security", f.category].filter(Boolean) as string[],
          precision: precisionToSarif(f.precision),
          "security-severity": severityToSecurityScore(f.severity),
        },
        helpUri: "https://github.com/Samuel-0228/bilt",
      });
      ruleIndices.set(f.rule_id, ruleIndexCounter++);
    }
  }

  const results: SarifResult[] = findings.map((f) => {
    const normalizedFile = f.file
      .replace(/^[./\\]+/, "")
      .replace(/\\/g, "/");

    const startLine = f.line > 0 ? f.line : 1;
    const endLine = f.end_line && f.end_line >= startLine ? f.end_line : startLine;

    return {
      ruleId: f.rule_id,
      ruleIndex: ruleIndices.get(f.rule_id),
      level: severityToSarifLevel(f.severity),
      message: { text: `${f.title}: ${f.explanation}` },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: normalizedFile,
              uriBaseId: "%SRCROOT%",
            },
            region: {
              startLine,
              startColumn: 1,
              endLine,
              endColumn: 80,
            },
          },
        },
      ],
      partialFingerprints: {
        primaryLocationLineHash: f.fingerprint,
      },
      fingerprints: {
        "bilt/v1": f.fingerprint,
      },
    };
  });

  return {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "bilt",
            version: toolVersion,
            informationUri: "https://github.com/Samuel-0228/bilt",
            rules: Array.from(rulesMap.values()),
          },
        },
        originalUriBaseIds: {
          "%SRCROOT%": {
            uri: "file:///",
          },
        },
        columnKind: "utf16CodeUnits",
        results,
      },
    ],
  };
}
