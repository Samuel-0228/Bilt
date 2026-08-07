// ─── Multi-Model Registry & Safe Resolution System ─────────────────────────────
// Defines supported & recommended models per provider with automatic compatibility normalization.

import type { AIProviderId } from "./types.js";

export interface ModelInfo {
  id: string;
  name: string;
  isDefault?: boolean;
  description: string;
  isReasoningModel?: boolean;
}

export const RECOMMENDED_MODELS: Record<AIProviderId, ModelInfo[]> = {
  openai: [
    {
      id: "gpt-4o-mini",
      name: "GPT-4o Mini (Default)",
      isDefault: true,
      description: "Fast, cost-efficient model for code health and explanations",
    },
    {
      id: "gpt-4o",
      name: "GPT-4o",
      description: "Flagship high-intelligence model",
    },
    {
      id: "gpt-4-turbo",
      name: "GPT-4 Turbo",
      description: "High accuracy legacy model",
    },
    {
      id: "o3-mini",
      name: "o3-mini",
      isReasoningModel: true,
      description: "Reasoning model for complex code analysis",
    },
    {
      id: "o1-mini",
      name: "o1-mini",
      isReasoningModel: true,
      description: "Reasoning model tailored for coding tasks",
    },
  ],
  anthropic: [
    {
      id: "claude-3-haiku-20240307",
      name: "Claude 3 Haiku (Default)",
      isDefault: true,
      description: "Fastest, lightweight Claude model",
    },
    {
      id: "claude-3-5-haiku-20241022",
      name: "Claude 3.5 Haiku",
      description: "Highly capable fast Claude model",
    },
    {
      id: "claude-3-5-sonnet-20241022",
      name: "Claude 3.5 Sonnet",
      description: "Industry benchmark for code reasoning",
    },
    {
      id: "claude-3-opus-20240229",
      name: "Claude 3 Opus",
      description: "Deepest reasoning capability",
    },
  ],
  gemini: [
    {
      id: "gemini-1.5-flash",
      name: "Gemini 1.5 Flash (Default)",
      isDefault: true,
      description: "High speed, low latency multimodal model",
    },
    {
      id: "gemini-2.0-flash",
      name: "Gemini 2.0 Flash",
      description: "Next-gen Flash model with improved speed",
    },
    {
      id: "gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
      description: "Latest Flash generation model",
    },
    {
      id: "gemini-1.5-pro",
      name: "Gemini 1.5 Pro",
      description: "Complex reasoning with large context window",
    },
  ],
  openrouter: [
    {
      id: "meta-llama/llama-3.1-8b-instruct:free",
      name: "Llama 3.1 8B Instruct (Free Default)",
      isDefault: true,
      description: "Free fast open weights model",
    },
    {
      id: "google/gemini-2.0-flash-lite-001",
      name: "Gemini 2.0 Flash Lite",
      description: "Low cost high speed OpenRouter route",
    },
    {
      id: "anthropic/claude-3.5-haiku",
      name: "Claude 3.5 Haiku (via OpenRouter)",
      description: "Fast Anthropic model via OpenRouter API",
    },
    {
      id: "openai/gpt-4o-mini",
      name: "GPT-4o Mini (via OpenRouter)",
      description: "OpenAI fast model via OpenRouter API",
    },
    {
      id: "deepseek/deepseek-r1:free",
      name: "DeepSeek R1 (Free)",
      description: "Open reasoning model route",
    },
  ],
  groq: [
    {
      id: "llama-3.1-8b-instant",
      name: "Llama 3.1 8B Instant (Default)",
      isDefault: true,
      description: "Ultra-fast inference on Groq LPUs",
    },
    {
      id: "llama-3.3-70b-versatile",
      name: "Llama 3.3 70B Versatile",
      description: "High accuracy 70B parameter model on Groq",
    },
    {
      id: "mixtral-8x7b-32768",
      name: "Mixtral 8x7B",
      description: "MoE architecture model with fast response time",
    },
    {
      id: "gemma2-9b-it",
      name: "Gemma 2 9B IT",
      description: "Google open model running on Groq hardware",
    },
  ],
  local: [
    {
      id: "local-static-v1",
      name: "Local Static Analyzer (Default)",
      isDefault: true,
      description: "Deterministic local explanation engine with no network access",
    },
  ],
};

/**
 * Check if a model is an OpenAI-style reasoning model (e.g. o1, o3 series)
 */
export function isReasoningModel(modelId: string): boolean {
  if (!modelId) return false;
  const lower = modelId.toLowerCase();
  return lower.startsWith("o1") || lower.startsWith("o3");
}

/**
 * Get default model ID for a provider
 */
export function getDefaultModel(providerId: AIProviderId): string {
  const models = RECOMMENDED_MODELS[providerId] || [];
  const defaultEntry = models.find((m) => m.isDefault);
  return defaultEntry ? defaultEntry.id : models[0]?.id || "default";
}

/**
 * Get recommended models list for a provider
 */
export function getRecommendedModels(providerId: AIProviderId): ModelInfo[] {
  return RECOMMENDED_MODELS[providerId] || [];
}
