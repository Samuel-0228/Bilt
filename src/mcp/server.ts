import path from "node:path";
import readline from "node:readline";
import { executeScan } from "../commands/scan.js";
import { toAgentFinding } from "../core/finding/mapper.js";
import { formatAgentOutput } from "../core/output/formatters/agent.js";
import { sanitizeSnippet } from "../core/safety/sanitizer.js";
import { RULE_TEMPLATES, getRuleTemplate } from "../core/finding/templates.js";
import { ALL_SECURITY_RULES } from "../core/security-engine/rules/index.js";
import type { AgentOutput } from "../core/output/types.js";
import { VERSION } from "../version.js";

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
    name: "bilt_scan",
    description:
      "Run complete multi-domain repository health scan (secrets, env, git hygiene, dependencies, performance).",
    inputSchema: {
      type: "object",
      properties: {
        dir: {
          type: "string",
          description: "Project directory path (default: .)",
        },
        severity: {
          type: "string",
          description: "Minimum severity level (critical, warning, info)",
        },
      },
    },
  },
  {
    name: "bilt_doctor",
    description:
      "Generate comprehensive repository health report with scores across 6 health domains.",
    inputSchema: {
      type: "object",
      properties: {
        dir: {
          type: "string",
          description: "Project directory path (default: .)",
        },
      },
    },
  },
  {
    name: "bilt_explain",
    description:
      "Retrieve static, prompt-injection-safe explanation and remediation guidance for a specific rule ID or concept.",
    inputSchema: {
      type: "object",
      properties: {
        rule_id: {
          type: "string",
          description: "Rule identifier (e.g., RULE-SEC-001, SEC-AUTH-001) or concept name (e.g. auth)",
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
          silent: true,
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
          toolVersion: VERSION,
          findings: agentFindings,
          introducedOnly: Boolean(args.changed || args.base),
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(agentOutput, null, 2) },
          ],
        };
      }

      case "bilt_scan": {
        const rootDir = path.resolve(args.dir || ".");
        const scanResult = await executeScan(rootDir, {
          silent: true,
          severity: args.severity,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(scanResult, null, 2) },
          ],
        };
      }

      case "bilt_doctor": {
        const rootDir = path.resolve(args.dir || ".");
        const scanResult = await executeScan(rootDir, { silent: true });

        const summary = {
          healthScore: scanResult.healthScore,
          grade: scanResult.grade,
          domainScores: scanResult.domainScores,
          scannedFiles: scanResult.scannedFiles,
          totalFindings: scanResult.findings.length,
          framework: scanResult.framework?.displayName || "Generic",
        };

        return {
          content: [
            { type: "text", text: JSON.stringify(summary, null, 2) },
          ],
        };
      }

      case "bilt_explain": {
        const target = String(args.rule_id || args.target || "").trim();
        if (!target) {
          return {
            isError: true,
            content: [
              { type: "text", text: "Error: rule_id argument is required." },
            ],
          };
        }

        const upper = target.toUpperCase();
        if (RULE_TEMPLATES[upper]) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(RULE_TEMPLATES[upper], null, 2),
              },
            ],
          };
        }

        const secRule = ALL_SECURITY_RULES.find(
          (r) => r.id.toLowerCase() === target.toLowerCase(),
        );
        if (secRule) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(secRule, null, 2),
              },
            ],
          };
        }

        const template = getRuleTemplate(target);
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
  if (process.stdin.isTTY) {
    process.stderr.write(
      `\n  Bilt Model Context Protocol (MCP) Server v${VERSION}\n` +
      `  Status: Active on stdio (JSON-RPC 2.0)\n\n` +
      `  This server provides AI agents (Cursor, Claude Desktop, Antigravity) with native security tools.\n\n` +
      `  Configuration Examples:\n` +
      `  • Cursor (.cursor/mcp.json):\n` +
      `    {\n      "mcpServers": {\n        "bilt": {\n          "command": "npx",\n          "args": ["-y", "bilt-toolkit", "mcp"]\n        }\n      }\n    }\n\n` +
      `  • Claude Desktop (claude_desktop_config.json):\n` +
      `    {\n      "mcpServers": {\n        "bilt": {\n          "command": "npx",\n          "args": ["-y", "bilt-toolkit", "mcp"]\n        }\n      }\n    }\n\n` +
      `  Interactive Terminal Commands:\n` +
      `    'tools' or 'list'  Show registered MCP tools\n` +
      `    'test'             Run a self-test check on '.'\n` +
      `    'quit' or 'exit'   Stop server\n\n` +
      `  Waiting for JSON-RPC messages (or type a command above)...\n\n`
    );
  }

  let activeRequests = 0;
  let stdinClosed = false;

  const maybeExit = () => {
    if (stdinClosed && activeRequests === 0) {
      process.exit(0);
    }
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on("close", () => {
    stdinClosed = true;
    maybeExit();
  });

  rl.on("line", async (line) => {
    if (!line.trim()) return;

    let request: any;
    try {
      request = JSON.parse(line);
    } catch {
      if (process.stdin.isTTY) {
        const cmd = line.trim().toLowerCase();
        if (cmd === "exit" || cmd === "quit" || cmd === "q") {
          process.stderr.write("  Exiting Bilt MCP Server.\n");
          process.exit(0);
        } else if (cmd === "tools" || cmd === "list") {
          process.stderr.write(`\n  Registered MCP Tools (${MCP_TOOLS.length}):\n`);
          for (const t of MCP_TOOLS) {
            process.stderr.write(`    • ${t.name}: ${t.description}\n`);
          }
          process.stderr.write("\n");
        } else if (cmd === "test") {
          process.stderr.write("  Running self-test (bilt_check) on '.' ...\n");
          const testRes = await handleMcpToolCall("bilt_check", { dir: "." });
          process.stderr.write(`  Result received successfully (${testRes.content[0]?.text?.length} chars).\n`);
        } else if (cmd === "help" || cmd === "?") {
          process.stderr.write(
            `\n  Interactive Commands:\n` +
            `    tools    List registered tools\n` +
            `    test     Run self-test check\n` +
            `    quit     Stop server\n\n`
          );
        } else {
          process.stderr.write(
            `  [MCP Notice] Received plain text: '${line.trim()}'.\n` +
            `  Expected JSON-RPC 2.0 object. Type 'tools' to see capabilities or 'quit' to exit.\n`
          );
        }
      }
      return;
    }

    const writeResponse = (payload: any): Promise<void> => {
      return new Promise((resolve) => {
        process.stdout.write(JSON.stringify(payload) + "\n", () => resolve());
      });
    };

    activeRequests++;
    try {
      const id = request.id;
      const method = request.method;

      if (method === "tools/list") {
        const response = {
          jsonrpc: "2.0",
          id,
          result: { tools: MCP_TOOLS },
        };
        await writeResponse(response);
      } else if (method === "tools/call") {
        const toolName = request.params?.name;
        const toolArgs = request.params?.arguments || {};
        const result = await handleMcpToolCall(toolName, toolArgs);

        const response = {
          jsonrpc: "2.0",
          id,
          result,
        };
        await writeResponse(response);
      } else if (method === "initialize") {
        const response = {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            serverInfo: { name: "bilt-mcp", version: VERSION },
            capabilities: { tools: {} },
          },
        };
        await writeResponse(response);
      }
    } finally {
      activeRequests--;
      maybeExit();
    }
  });
}
