// ─── Provider Registry ────────────────────────────────────────────────────────

import type { AIProvider, AIProviderId } from "../types.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";
import { GeminiProvider } from "./gemini.js";
import { OpenRouterProvider } from "./openrouter.js";
import { GroqProvider } from "./groq.js";
import { LocalProvider } from "./local.js";

const providerInstances: Record<AIProviderId, AIProvider> = {
  anthropic: new AnthropicProvider(),
  openai: new OpenAIProvider(),
  gemini: new GeminiProvider(),
  openrouter: new OpenRouterProvider(),
  groq: new GroqProvider(),
  local: new LocalProvider(),
};

export function getProvider(id: AIProviderId): AIProvider {
  const provider = providerInstances[id];
  if (!provider) {
    throw new Error(`Unknown AI provider: '${id}'`);
  }
  return provider;
}

export function getAllProviders(): AIProvider[] {
  return Object.values(providerInstances);
}
