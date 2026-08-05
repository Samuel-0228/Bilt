// ─── AI Integration Interfaces & Types ────────────────────────────────────────

import type { ScanFinding } from "../../types/index.js";

export type AIProviderId = "anthropic" | "openai" | "gemini" | "openrouter" | "groq";

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
  firstRunCompleted?: boolean;
}
