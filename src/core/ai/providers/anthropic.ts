// ─── Anthropic (Claude) Provider Adapter ──────────────────────────────────────

import type { AIProvider, AIProviderId, RedactedContext } from "../types.js";
import { getActiveModel } from "../config.js";

export class AnthropicProvider implements AIProvider {
  public readonly id: AIProviderId = "anthropic";
  public readonly name = "Anthropic (Claude)";
  public readonly defaultModel = "claude-3-haiku-20240307";

  async validateKey(key: string): Promise<boolean> {
    if (!key || key.trim() === "") return false;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key.trim(),
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.defaultModel,
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        }),
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async complete(
    prompt: string,
    context: RedactedContext,
    model?: string,
    key?: string,
    timeoutMs: number = 10000,
  ): Promise<string> {
    if (!key) {
      throw new Error(`No API key provided for ${this.name}`);
    }

    const requestedModel = (model && model.trim() !== "") ? model.trim() : getActiveModel(this.id);
    const systemPrompt =
      "You are Bilt AI, a local-first security and project health assistant. " +
      "Analyze the provided redacted code findings and answer accurately. " +
      "Never invent secret values or unverified details not present in the redacted context.";

    const userMessage = `${prompt}\n\n[Redacted Context]\n${JSON.stringify(context, null, 2)}`;

    const makeCallForModel = async (targetModel: string): Promise<string> => {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key.trim(),
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: targetModel,
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`${this.name} API error (${response.status}): ${errText || response.statusText}`);
      }

      const data = (await response.json()) as { content?: Array<{ text?: string }> };
      const content = data.content?.[0]?.text;
      if (!content) {
        throw new Error(`${this.name} returned an empty response`);
      }
      return content;
    };

    try {
      return await makeCallForModel(requestedModel);
    } catch (primaryErr: any) {
      const errMsg = primaryErr?.message || String(primaryErr);
      if (requestedModel !== this.defaultModel && (errMsg.includes("404") || errMsg.includes("not_found") || errMsg.includes("model"))) {
        try {
          return await makeCallForModel(this.defaultModel);
        } catch {
          // Fall through
        }
      }
      await new Promise((r) => setTimeout(r, 500));
      return await makeCallForModel(requestedModel);
    }
  }
}
