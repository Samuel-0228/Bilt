// ─── Shared OpenAI-Compatible Provider Adapter ───────────────────────────────

import type { AIProviderId, RedactedContext } from "../types.js";
import { isReasoningModel } from "../models.js";

export interface OpenAICompatibleOptions {
  id: AIProviderId;
  name: string;
  baseUrl: string;
  defaultModel: string;
  extraHeaders?: Record<string, string>;
}

export class OpenAICompatibleProvider {
  public readonly id: AIProviderId;
  public readonly name: string;
  public readonly defaultModel: string;
  private readonly baseUrl: string;
  private readonly extraHeaders: Record<string, string>;

  constructor(options: OpenAICompatibleOptions) {
    this.id = options.id;
    this.name = options.name;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.defaultModel = options.defaultModel;
    this.extraHeaders = options.extraHeaders || {};
  }

  /**
   * Validate API key by fetching available models or making a lightweight query.
   */
  async validateKey(key: string): Promise<boolean> {
    if (!key || key.trim() === "") return false;

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key.trim()}`,
          ...this.extraHeaders,
        },
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch {
      // Fallback: test with a minimal dry request if /models fails or is restricted
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key.trim()}`,
            ...this.extraHeaders,
          },
          body: JSON.stringify({
            model: this.defaultModel,
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1,
          }),
          signal: AbortSignal.timeout(5000),
        });

        return response.ok;
      } catch {
        return false;
      }
    }
  }

  /**
   * Generate text completion given prompt and redacted context with multi-model safety.
   */
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

    const requestedModel = (model && model.trim() !== "") ? model.trim() : this.defaultModel;

    const makeCallForModel = async (targetModel: string): Promise<string> => {
      const isReasoning = isReasoningModel(targetModel);
      const systemText =
        "You are Bilt AI, a local-first security and project health assistant. " +
        "Analyze the provided redacted code findings and answer accurately. " +
        "Never invent secret values or unverified details not present in the redacted context.";

      const formattedUserMessage = `${prompt}\n\n[Redacted Context]\n${JSON.stringify(context, null, 2)}`;

      const messages = isReasoning
        ? [
            {
              role: "user",
              content: `[System Instruction]\n${systemText}\n\n[User Query]\n${formattedUserMessage}`,
            },
          ]
        : [
            { role: "system", content: systemText },
            { role: "user", content: formattedUserMessage },
          ];

      const bodyPayload: Record<string, any> = {
        model: targetModel,
        messages,
      };

      // Reasoning models (o1/o3) reject temperature parameter in OpenAI API
      if (!isReasoning) {
        bodyPayload.temperature = 0.2;
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key.trim()}`,
          ...this.extraHeaders,
        },
        body: JSON.stringify(bodyPayload),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`${this.name} API error (${response.status}): ${errText || response.statusText}`);
      }

      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error(`${this.name} returned an empty response`);
      }
      return content;
    };

    // Primary call with requested model
    try {
      return await makeCallForModel(requestedModel);
    } catch (primaryErr: any) {
      const errMsg = primaryErr?.message || String(primaryErr);

      // If requested model is non-default and failed with 404 / model mismatch, retry with defaultModel
      if (requestedModel !== this.defaultModel && (errMsg.includes("404") || errMsg.includes("model"))) {
        try {
          return await makeCallForModel(this.defaultModel);
        } catch {
          // Fall through to throw original error
        }
      }

      // Retry requested model once after short backoff for transient errors
      await new Promise((r) => setTimeout(r, 500));
      return await makeCallForModel(requestedModel);
    }
  }
}
