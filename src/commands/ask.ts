// ─── Bilt Ask Command ──────────────────────────────────────────────────────────
// Conversational AI assistant query scoped to current project's redacted scan findings.

import { executeScan } from "./scan.js";
import { redactForAI } from "../core/ai/redact.js";
import { getAIConfig } from "../core/ai/config.js";
import { executeAICompletion } from "../core/ai/runtime.js";
import { colors, sectionHeader, divider, text } from "../ui/theme.js";

export async function executeAsk(
  question: string,
  dir: string = ".",
  opts: { debug?: boolean } = {},
): Promise<void> {
  if (!question || question.trim() === "") {
    console.log(colors.amberFlag.apply("Please provide a question. Example: bilt ask \"why is my service role key dangerous?\""));
    return;
  }

  // 1. Check AI configuration & stored key
  const config = getAIConfig();
  if (!config.activeProvider) {
    console.log(colors.amberFlag.apply("No AI provider configured."));
    console.log(text.dim("Run 'bilt ai setup' to connect an AI provider for conversational assistance."));
    return;
  }

  // 2. Perform quiet local scan to gather current context
  console.log(text.dim(`Gathering project context and scanning ${dir}...`));
  const scanResult = await executeScan(dir, {
    quiet: true,
    retainSecrets: true,
  });

  // 3. Pass through strict redaction pipeline
  const redactedContext = redactForAI({
    findings: scanResult.findings,
    framework: scanResult.framework?.displayName,
    projectName: dir,
  });

  if (opts.debug) {
    console.log(sectionHeader("Debug: Redacted Context Payload"));
    console.log(JSON.stringify(redactedContext, null, 2));
    console.log(divider());
  }

  // 4. Query AI provider with clear error handling
  console.log(text.dim("Querying AI providers with failover..."));

  try {
    const result = await executeAICompletion(question, redactedContext, {
      timeoutMs: 8000,
      totalBudgetMs: 10000,
    });

    console.log(sectionHeader(`Bilt AI Answer (${result.providerName})`));
    console.log(result.content);
    if (result.fellBack) {
      console.log(text.dim(`(Fallback used from configured provider '${config.activeProvider}' to '${result.providerId}')`));
    }
    console.log(divider());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(colors.pulseCoral.apply(`❌ AI Query Failed: ${message}`));
    console.log(text.dim("Bilt continued locally. Run 'bilt ai provider local' to force deterministic offline mode."));
  }
}
