import type { Finding } from "../../finding/types.js";

export interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription: { text: string };
  defaultConfiguration: {
    level: "error" | "warning" | "note";
  };
  helpUri?: string;
}

export interface SarifResult {
  ruleId: string;
  level: "error" | "warning" | "note";
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region: {
        startLine: number;
        endLine: number;
      };
    };
  }>;
  fingerprints: Record<string, string>;
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

export function formatSarifOutput(
  findings: Finding[],
  toolVersion: string = "1.0.5",
): SarifReport {
  const rulesMap = new Map<string, SarifRule>();

  for (const f of findings) {
    if (!rulesMap.has(f.rule_id)) {
      rulesMap.set(f.rule_id, {
        id: f.rule_id,
        name: f.title.replace(/[^a-zA-Z0-9_-]/g, "_"),
        shortDescription: { text: f.title },
        fullDescription: { text: f.explanation },
        defaultConfiguration: {
          level: severityToSarifLevel(f.severity),
        },
        helpUri: "https://github.com/Samuel-0228/bilt",
      });
    }
  }

  const results: SarifResult[] = findings.map((f) => ({
    ruleId: f.rule_id,
    level: severityToSarifLevel(f.severity),
    message: { text: `${f.title}: ${f.explanation}` },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: f.file.replace(/\\/g, "/") },
          region: {
            startLine: f.line || 1,
            endLine: f.end_line || f.line || 1,
          },
        },
      },
    ],
    fingerprints: {
      "bilt/v1": f.fingerprint,
    },
  }));

  return {
    version: "2.1.0",
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
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
        results,
      },
    ],
  };
}
