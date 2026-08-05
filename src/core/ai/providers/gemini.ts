// ─── Google Gemini Provider Adapter ────────────────────────────────────────────

import type { AIProvider, AIProviderId, RedactedContext } from "../types.js";
import { getActiveModel } from "../config.js";

export class GeminiProvider implements AIProvider {
  public readonly id: AIProviderId = "gemini";
  public readonly name = "Google (Gemini)";
  public readonly defaultModel = "gemini-1.5-flash";

  async validateKey(key: string): Promise<boolean> {
    if (!key || key.trim() === "") return false;
    const cleanKey = key.trim();

    // 1. Try lightweight GET /models?key=...
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`;
      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) return true;
    } catch {
      // Fall through to fallback attempt
    }

    // 2. Fallback attempt: POST generateContent with role: "user"
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.defaultModel}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "ping" }] }],
          generationConfig: { maxOutputTokens: 1 },
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
    const systemInstruction =
      "You are Bilt AI, a local-first security and project health assistant. " +
      "Analyze the provided redacted code findings and answer accurately. " +
      "Never invent secret values or unverified details not present in the redacted context.\n\n";

    const userContent = `${systemInstruction}${prompt}\n\n[Redacted Context]\n${JSON.stringify(context, null, 2)}`;

    const makeCallForModel = async (targetModel: string): Promise<string> => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${encodeURIComponent(key.trim())}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: userContent }] }],
          generationConfig: { temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`${this.name} API error (${response.status}): ${errText || response.statusText}`);
      }

      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        throw new Error(`${this.name} returned an empty response`);
      }
      return content;
    };

    try {
      return await makeCallForModel(requestedModel);
    } catch (primaryErr: any) {
      const errMsg = primaryErr?.message || String(primaryErr);
      if (requestedModel !== this.defaultModel && (errMsg.includes("404") || errMsg.includes("NOT_FOUND") || errMsg.includes("model"))) {
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
