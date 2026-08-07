// ─── Local Provider Adapter ─────────────────────────────────────────────────
//
// Deterministic, fully local provider used as guaranteed fallback when
// remote AI providers are unavailable.

import type { AIProvider, AIProviderId, RedactedContext } from "../types.js";

export class LocalProvider implements AIProvider {
  public readonly id: AIProviderId = "local";
  public readonly name = "Local (Deterministic)";
  public readonly defaultModel = "local-static-v1";
  public readonly requiresApiKey = false;

  async validateKey(_key: string): Promise<boolean> {
    return true;
  }

  async complete(
    prompt: string,
    context: RedactedContext,
  ): Promise<string> {
    const findingsCount = context.findings.length;
    const framework = context.framework || "unknown";
    const primary = context.findings[0];

    const primaryLine = primary
      ? `Top finding: ${primary.category} (${primary.severity}) in ${primary.file}${primary.line ? `:${primary.line}` : ""}.`
      : "No findings were available in context.";

    return [
      "Bilt Local Explain Mode",
      "",
      `Question: ${prompt}`,
      `Framework: ${framework}`,
      `Findings in scope: ${findingsCount}`,
      primaryLine,
      "",
      "Remote AI provider was unavailable or disabled. This local response is deterministic and does not require network access.",
    ].join("\n");
  }
}
