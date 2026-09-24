import path from "node:path";
import readline from "node:readline";
import { executeScan } from "../commands/scan.js";
import { toAgentFinding } from "../core/finding/mapper.js";
import { formatAgentOutput } from "../core/output/formatters/agent.js";
import { sanitizeSnippet } from "../core/safety/sanitizer.js";
import { RULE_TEMPLATES, getRuleTemplate } from "../core/finding/templates.js";
import type { AgentOutput } from "../core/output/types.js";

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export const MCP_TOOLS: MCPToolDefinition[] = [
  {
    name: "bilt_check",
    description:
      "Run deterministic security checks against the repository or git diff scope, returning structured agent feedback.",
    inputSchema: {
      type: "object",
      properties: {
        dir: {
          type: "string",
          description: "Project directory path (default: .)",
        },
        changed: {
          type: "boolean",
          description: "Scan only files modified in working tree vs HEAD",
        },
        base: {
          type: "string",
          description: "Base git ref to compare against (e.g. origin/main)",
        },
        snippets: {
          type: "boolean",
          description: "Include sanitized untrusted code snippets",
        },
      },
    },
  },
  {
    name: "bilt_explain",
    description:
      "Retrieve static, prompt-injection-safe explanation and remediation guidance for a specific rule ID.",
    inputSchema: {
      type: "object",
      properties: {
        rule_id: {
          type: "string",
          description: "Rule identifier (e.g., RULE-SEC-001, RULE-AUTH-001)",
        },
      },
      required: ["rule_id"],
    },
  },
  {
    name: "bilt_list_rules",
    description:
      "List all active deterministic security rules, precision tiers, and maturity flags.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

/**
 * Handle execution of an MCP tool call.
 */
export async function handleMcpToolCall(
  name: string,
  args: Record<string, any> = {},
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  try {
    switch (name) {
      case "bilt_check": {
        const rootDir = path.resolve(args.dir || ".");
        const scanResult = await executeScan(rootDir, {
          changed: args.changed,
          base: args.base,
          quiet: true,
        });

        const agentFindings = scanResult.findings.map((f) =>
          toAgentFinding(f, {
            introducedByChange: f.introducedByChange !== false,
            untrustedSnippet:
              args.snippets && f.preview
                ? sanitizeSnippet(f.preview, 200)
                : undefined,
          }),
        );

        const agentOutput: AgentOutput = formatAgentOutput({
          toolVersion: "1.0.5",
          findings: agentFindings,
          introducedOnly: Boolean(args.changed || args.base),
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(agentOutput, null, 2) },
          ],
        };
      }

      case "bilt_explain": {
        const ruleId = String(args.rule_id || "").trim();
        if (!ruleId) {
          return {
            isError: true,
            content: [
              { type: "text", text: "Error: rule_id argument is required." },
            ],
          };
        }

        const template = getRuleTemplate(ruleId);
        return {
          content: [{ type: "text", text: JSON.stringify(template, null, 2) }],
        };
      }

      case "bilt_list_rules": {
        const rules = Object.values(RULE_TEMPLATES).map((r) => ({
          rule_id: r.rule_id,
          title: r.title,
          category: r.category,
          severity: r.severity,
          precision: r.precision,
          maturity: r.maturity,
        }));

        return {
          content: [{ type: "text", text: JSON.stringify(rules, null, 2) }],
        };
      }

      default:
        return {
          isError: true,
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
        };
    }
  } catch (err: any) {
    return {
      isError: true,
      content: [
        { type: "text", text: `Tool error: ${err.message || String(err)}` },
      ],
    };
  }
}

/**
 * Start the MCP JSON-RPC stdio server.
 */
export function startMcpServer(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on("line", async (line) => {
    if (!line.trim()) return;

    let request: any;
    try {
      request = JSON.parse(line);
    } catch {
      return;
    }

    const id = request.id;
    const method = request.method;

    if (method === "tools/list") {
      const response = {
        jsonrpc: "2.0",
        id,
        result: { tools: MCP_TOOLS },
      };
      process.stdout.write(JSON.stringify(response) + "\n");
    } else if (method === "tools/call") {
      const toolName = request.params?.name;
      const toolArgs = request.params?.arguments || {};
      const result = await handleMcpToolCall(toolName, toolArgs);

      const response = {
        jsonrpc: "2.0",
        id,
        result,
      };
      process.stdout.write(JSON.stringify(response) + "\n");
    } else if (method === "initialize") {
      const response = {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: { name: "bilt-mcp", version: "1.0.5" },
          capabilities: { tools: {} },
        },
      };
      process.stdout.write(JSON.stringify(response) + "\n");
    }
  });
}
