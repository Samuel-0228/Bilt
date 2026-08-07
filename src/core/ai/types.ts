// ─── AI Integration Interfaces & Types ────────────────────────────────────────

import type { ScanFinding } from "../../types/index.js";

export type AIProviderId = "anthropic" | "openai" | "gemini" | "openrouter" | "groq" | "local";

export interface AIProviderRuntimeConfig {
  enabled?: boolean;
  timeoutMs?: number;
  retries?: number;
  maxRequestsPerMinute?: number;
}

export interface RedactedFindingContext {
  id: string;
  category: string;
  severity: string;
  file: string;
  line?: number;
  providerType?: string;
  ruleId?: string;
  classification: {
    type: string;
    context: string;
    surroundingVarName?: string;
  };
  snippet?: string;
}

export interface RedactedContext {
  projectName?: string;
  framework?: string;
  findings: RedactedFindingContext[];
}

export interface AIProvider {
  id: AIProviderId;
  name: string;
  defaultModel: string;
  requiresApiKey?: boolean;
  validateKey(key: string): Promise<boolean>;
  complete(
    prompt: string,
    context: RedactedContext,
    model?: string,
    key?: string,
    timeoutMs?: number,
  ): Promise<string>;
}

export interface StoredCredentials {
  provider: AIProviderId;
  key: string;
  updatedAt: string;
}

export interface AIConfig {
  activeProvider?: AIProviderId;
  providerModels: Record<string, string>;
  lastValidated: Record<string, string>;
  providerRuntime?: Partial<Record<AIProviderId, AIProviderRuntimeConfig>>;
  firstRunCompleted?: boolean;
}
