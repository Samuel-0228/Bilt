// ─── Groq Provider Adapter ───────────────────────────────────────────────────

import { OpenAICompatibleProvider } from "./openai-compatible.js";
import type { AIProvider, RedactedContext } from "../types.js";
import { getActiveModel } from "../config.js";

export class GroqProvider implements AIProvider {
  public readonly id = "groq" as const;
  public readonly name = "Groq";
  public readonly defaultModel = "llama-3.1-8b-instant";
  public readonly requiresApiKey = true;
  private client: OpenAICompatibleProvider;

  constructor() {
    this.client = new OpenAICompatibleProvider({
      id: this.id,
      name: this.name,
      baseUrl: "https://api.groq.com/openai/v1",
      defaultModel: this.defaultModel,
    });
  }

  async validateKey(key: string): Promise<boolean> {
    return this.client.validateKey(key);
  }

  async complete(
    prompt: string,
    context: RedactedContext,
    model?: string,
    key?: string,
    timeoutMs?: number,
  ): Promise<string> {
    const targetModel = model && model.trim() !== "" ? model.trim() : getActiveModel(this.id);
    return this.client.complete(prompt, context, targetModel, key, timeoutMs);
  }
}
