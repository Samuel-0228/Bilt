// ─── Bilt Ask Command ──────────────────────────────────────────────────────────
// Conversational AI assistant query scoped to current project's redacted scan findings.

import { executeScan } from "./scan.js";
import { redactForAI } from "../core/ai/redact.js";
import { getAIConfig } from "../core/ai/config.js";
import { getApiKey } from "../core/ai/storage.js";
import { getProvider } from "../core/ai/providers/index.js";
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

  const { key } = await getApiKey(config.activeProvider);
  if (!key) {
    console.log(colors.amberFlag.apply(`No API key found for provider '${config.activeProvider}'.`));
    console.log(text.dim("Run 'bilt ai setup' to re-enter your API key."));
    return;
  }

  const provider = getProvider(config.activeProvider);

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
  console.log(text.dim(`Querying ${provider.name} (${provider.defaultModel})...`));

  try {
    const answer = await provider.complete(question, redactedContext, undefined, key, 10000);

    console.log(sectionHeader(`Bilt AI Answer (${provider.name})`));
    console.log(answer);
    console.log(divider());
  } catch (err: any) {
    console.log(colors.pulseCoral.apply(`❌ AI Query Failed: ${err?.message || String(err)}`));
    console.log(text.dim("Bilt core scanner remains fully functional locally."));
  }
}
