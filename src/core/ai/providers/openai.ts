// ─── OpenAI Provider Adapter ───────────────────────────────────────────────────

import { OpenAICompatibleProvider } from "./openai-compatible.js";
import type { AIProvider, RedactedContext } from "../types.js";

export class OpenAIProvider implements AIProvider {
  public readonly id = "openai" as const;
  public readonly name = "OpenAI";
  public readonly defaultModel = "gpt-4o-mini";
  private client: OpenAICompatibleProvider;

  constructor() {
    this.client = new OpenAICompatibleProvider({
      id: this.id,
      name: this.name,
      baseUrl: "https://api.openai.com/v1",
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
    return this.client.complete(prompt, context, model || this.defaultModel, key, timeoutMs);
  }
}
