import { getAIConfig, getProviderRuntime, getActiveModel } from "./config.js";
import { getAllProviders } from "./providers/index.js";
import { getApiKey } from "./storage.js";
import type { AIProvider, AIProviderId, RedactedContext } from "./types.js";

export interface AIExecutionOptions {
  timeoutMs?: number;
  totalBudgetMs?: number;
}

export interface AIExecutionResult {
  providerId: AIProviderId;
  providerName: string;
  model: string;
  content: string;
  fellBack: boolean;
  attempts: number;
  errors: string[];
}

const providerRequestHistory = new Map<AIProviderId, number[]>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetriableError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("429") ||
    m.includes("rate") ||
    m.includes("503") ||
    m.includes("502") ||
    m.includes("network") ||
    m.includes("econnreset") ||
    m.includes("etimedout")
  );
}

function normalizeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function buildProviderOrder(preferred?: AIProviderId): AIProvider[] {
  const providers = getAllProviders();
  const byId = new Map(providers.map((p) => [p.id, p] as const));

  const order: AIProvider[] = [];
  if (preferred && byId.has(preferred)) {
    order.push(byId.get(preferred)!);
    byId.delete(preferred);
  }

  for (const remote of ["openai", "anthropic", "gemini", "groq", "openrouter"] as AIProviderId[]) {
    const p = byId.get(remote);
    if (p) {
      order.push(p);
      byId.delete(remote);
    }
  }

  if (byId.has("local")) {
    order.push(byId.get("local")!);
    byId.delete("local");
  }

  for (const p of byId.values()) {
    order.push(p);
  }

  return order;
}

function canUseProviderNow(providerId: AIProviderId, maxPerMinute: number): boolean {
  if (!maxPerMinute || maxPerMinute <= 0) return true;
  const now = Date.now();
  const windowStart = now - 60_000;
  const history = providerRequestHistory.get(providerId) || [];
  const fresh = history.filter((ts) => ts >= windowStart);
  providerRequestHistory.set(providerId, fresh);
  return fresh.length < maxPerMinute;
}

function recordProviderRequest(providerId: AIProviderId): void {
  const history = providerRequestHistory.get(providerId) || [];
  history.push(Date.now());
  providerRequestHistory.set(providerId, history);
}

export async function executeAICompletion(
  prompt: string,
  context: RedactedContext,
  options: AIExecutionOptions = {},
): Promise<AIExecutionResult> {
  const config = getAIConfig();
  const preferred = config.activeProvider;
  const providers = buildProviderOrder(preferred);
  const errors: string[] = [];
  const startedAt = Date.now();
  const totalBudget = options.totalBudgetMs ?? 12_000;

  for (const provider of providers) {
    const runtime = getProviderRuntime(provider.id);
    if (runtime.enabled === false) {
      continue;
    }

    const remainingBudget = totalBudget - (Date.now() - startedAt);
    if (remainingBudget <= 0) {
      errors.push("AI budget exceeded before provider execution.");
      break;
    }

    const maxPerMinute = runtime.maxRequestsPerMinute ?? 20;
    if (!canUseProviderNow(provider.id, maxPerMinute)) {
      errors.push(`${provider.name} is rate-limited locally (max ${maxPerMinute}/min).`);
      continue;
    }

    let key: string | undefined;
    if (provider.requiresApiKey !== false) {
      const keyInfo = await getApiKey(provider.id);
      if (!keyInfo.key) {
        errors.push(`${provider.name} is missing API key.`);
        continue;
      }
      key = keyInfo.key;
    }

    const retries = Math.max(0, runtime.retries ?? 1);
    const timeoutMs = Math.max(500, Math.min(options.timeoutMs ?? runtime.timeoutMs ?? 8000, remainingBudget));
    const model = getActiveModel(provider.id);

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const content = await provider.complete(prompt, context, model, key, timeoutMs);
        recordProviderRequest(provider.id);

        return {
          providerId: provider.id,
          providerName: provider.name,
          model,
          content,
          fellBack: Boolean(preferred && provider.id !== preferred),
          attempts: attempt + 1,
          errors,
        };
      } catch (err) {
        const message = `${provider.name} attempt ${attempt + 1} failed: ${normalizeError(err)}`;
        errors.push(message);

        if (attempt < retries && isRetriableError(message)) {
          await sleep(250 * (attempt + 1));
          continue;
        }
        break;
      }
    }
  }

  throw new Error(errors.join(" | ") || "No AI providers were available.");
}
