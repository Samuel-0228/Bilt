// ─── Bilt AI Setup & Management Command ────────────────────────────────────────

import Enquirer from "enquirer";
import { getAllProviders, getProvider } from "../core/ai/providers/index.js";
import { getApiKey, saveApiKey, deleteApiKey, maskApiKey } from "../core/ai/storage.js";
import {
  getAIConfig,
  setAIConfig,
  recordValidation,
  getLastRequestPayload,
  getActiveModel,
  setActiveModel,
} from "../core/ai/config.js";
import { getRecommendedModels } from "../core/ai/models.js";
import type { AIProviderId } from "../core/ai/types.js";
import { colors, sectionHeader, divider, text } from "../ui/theme.js";

const enquirer = new Enquirer();

const CONSENT_TEXT_TEMPLATE = (providerName: string) => `
Bilt will send limited, redacted context to ${providerName} when you use
AI features — file types, variable name patterns, and issue categories.
Bilt never sends secret values, full file contents, or your source
code. Core scanning always stays 100% local, with or without this key.
`;

/**
 * Interactive setup flow for AI provider credentials
 */
export async function executeAISetup(): Promise<void> {
  console.log(sectionHeader("Bilt AI Setup (Optional Enhancement)"));
  console.log(text.dim("Core scanning is 100% local. AI setup applies globally to all projects on your machine."));
  console.log(divider());

  const providers = getAllProviders();
  const choices = providers.map((p) => ({
    name: p.id,
    message: `${p.name} (default: ${p.defaultModel})`,
  }));

  // 1. Select provider
  const { providerId } = (await enquirer.prompt({
    type: "select",
    name: "providerId",
    message: "Select AI Provider:",
    choices,
  })) as { providerId: AIProviderId };

  const selectedProvider = getProvider(providerId);

  let apiKey = "";
  if (selectedProvider.requiresApiKey !== false) {
    // 2. Paste API key (masked input)
    const keyPrompt = (await enquirer.prompt({
      type: "password",
      name: "apiKey",
      message: `Paste your ${selectedProvider.name} API Key:`,
    })) as { apiKey: string };
    apiKey = keyPrompt.apiKey;

    if (!apiKey || apiKey.trim() === "") {
      console.log(colors.pulseCoral.apply("❌ No API key provided. Setup cancelled."));
      return;
    }

    // 3. Validate key against provider API
    console.log(text.dim(`Validating API key with ${selectedProvider.name}...`));
    const isValid = await selectedProvider.validateKey(apiKey.trim());

    if (!isValid) {
      console.log(colors.pulseCoral.apply(`❌ API key validation failed for ${selectedProvider.name}. Check your key and network connection.`));
      console.log(text.dim("No credentials were saved."));
      return;
    }
    console.log(colors.mintClear.apply("✔ API key validated successfully!"));
  } else {
    console.log(text.dim(`${selectedProvider.name} does not require an API key.`));
  }

  // 4. Show exact consent text
  console.log(colors.amberFlag.apply(CONSENT_TEXT_TEMPLATE(selectedProvider.name)));

  const { confirm } = (await enquirer.prompt({
    type: "confirm",
    name: "confirm",
    message: "Continue?",
    initial: true,
  })) as { confirm: boolean };

  if (!confirm) {
    console.log(colors.amberFlag.apply("Setup cancelled by user. Key was not saved."));
    return;
  }

  // 5. Store key securely
  let saveRes: Awaited<ReturnType<typeof saveApiKey>> | null = null;
  if (selectedProvider.requiresApiKey !== false) {
    saveRes = await saveApiKey(providerId, apiKey.trim());
    if (!saveRes.success) {
      console.log(colors.pulseCoral.apply(`❌ Failed to store API key: ${saveRes.error}`));
      return;
    }
  }

  setAIConfig({ activeProvider: providerId });
  recordValidation(providerId);

  const storageMsg = !saveRes
    ? "Not required"
    : saveRes.storageMethod === "keyring"
      ? "OS Keyring (Windows Credential Manager / macOS Keychain / Secret Service)"
      : "AES-256-GCM encrypted file (~/.bilt/credentials)";

  console.log(divider());
  console.log(colors.mintClear.apply(`✔ Bilt AI setup complete for ${selectedProvider.name}!`));
  console.log(text.dim(`Storage method: ${storageMsg}`));
  console.log(text.dim(`Active Model: ${getActiveModel(providerId)}`));
  console.log(text.dim(`Masked Key: ${apiKey ? maskApiKey(apiKey) : "N/A"}`));
  console.log(colors.slateDim.dim("This setup applies globally across all project directories on your machine."));
}

/**
 * Display AI configuration status
 */
export async function executeAIStatus(): Promise<void> {
  console.log(sectionHeader("Bilt AI Configuration Status"));

  const config = getAIConfig();
  if (!config.activeProvider) {
    console.log(colors.amberFlag.apply("No AI provider currently configured."));
    console.log(text.dim("Run 'bilt ai setup' to enable optional AI capabilities globally."));
    return;
  }

  const activeProvider = config.activeProvider;
  const provider = getProvider(activeProvider);
  const keyInfo = await getApiKey(activeProvider);
  const activeModel = getActiveModel(activeProvider);
  const rawDate = config.lastValidated[activeProvider];
  const lastValid = rawDate ? new Date(rawDate).toLocaleString() : "Never";

  console.log(`Provider:      ${colors.vitalTeal.apply(provider.name)} (${provider.id})`);
  console.log(`Active Model:  ${text.bold(activeModel)}`);
  console.log(`Masked Key:    ${keyInfo.key ? maskApiKey(keyInfo.key) : colors.pulseCoral.apply("None")}`);
  console.log(`Key Source:    ${keyInfo.source}`);
  console.log(`Last Validated: ${lastValid}`);
}

/**
 * Switch active provider or model interactively or via arguments
 */
export async function executeAISwitch(): Promise<void> {
  const config = getAIConfig();
  console.log(sectionHeader("Bilt AI Provider & Model Switcher"));

  const { switchType } = (await enquirer.prompt({
    type: "select",
    name: "switchType",
    message: "What would you like to switch?",
    choices: [
      { name: "provider", message: "1. Switch active AI provider" },
      { name: "model", message: "2. Change model for current active provider" },
      { name: "setup", message: "3. Run full setup / Connect new API key" },
    ],
  })) as { switchType: string };

  if (switchType === "provider") {
    await executeAIProvider();
  } else if (switchType === "model") {
    await executeAIModel();
  } else {
    await executeAISetup();
  }
}

/**
 * Select or switch active AI provider
 */
export async function executeAIProvider(targetProvider?: string): Promise<void> {
  if (targetProvider && targetProvider.trim() !== "") {
    const cleanId = targetProvider.trim() as AIProviderId;
    try {
      const provider = getProvider(cleanId);
      const keyInfo = await getApiKey(cleanId);
      if (provider.requiresApiKey !== false && !keyInfo.key) {
        console.log(colors.amberFlag.apply(`No stored API key found for provider '${provider.name}'.`));
        console.log(text.dim("Run 'bilt ai setup' to enter an API key for this provider."));
        return;
      }
      setAIConfig({ activeProvider: cleanId });
      console.log(colors.mintClear.apply(`✔ Switched active AI provider to ${provider.name} (${getActiveModel(cleanId)})`));
      return;
    } catch {
      console.log(colors.pulseCoral.apply(`Invalid provider ID: '${targetProvider}'`));
      return;
    }
  }

  const providers = getAllProviders();
  const choices = providers.map((p) => ({
    name: p.id,
    message: `${p.name} (active model: ${getActiveModel(p.id)})`,
  }));

  const { selectedId } = (await enquirer.prompt({
    type: "select",
    name: "selectedId",
    message: "Select active AI Provider:",
    choices,
  })) as { selectedId: AIProviderId };

  const provider = getProvider(selectedId);
  const keyInfo = await getApiKey(selectedId);
  if (provider.requiresApiKey !== false && !keyInfo.key) {
    console.log(colors.amberFlag.apply(`No stored API key found for provider '${provider.name}'.`));
    console.log(text.dim("Launching setup to configure key..."));
    await executeAISetup();
    return;
  }

  setAIConfig({ activeProvider: selectedId });
  console.log(colors.mintClear.apply(`✔ Active AI provider updated to ${provider.name} (${getActiveModel(selectedId)})`));
}

/**
 * Select or switch model for active AI provider
 */
export async function executeAIModel(targetModel?: string): Promise<void> {
  const config = getAIConfig();
  if (!config.activeProvider) {
    console.log(colors.amberFlag.apply("No AI provider currently configured. Run 'bilt ai setup' first."));
    return;
  }

  const activeProvider = config.activeProvider;
  const provider = getProvider(activeProvider);

  if (targetModel && targetModel.trim() !== "") {
    const cleanModel = targetModel.trim();
    setActiveModel(activeProvider, cleanModel);
    console.log(colors.mintClear.apply(`✔ Active model for ${provider.name} set to '${cleanModel}'`));
    return;
  }

  const recommended = getRecommendedModels(activeProvider);
  const choices = [
    ...recommended.map((m) => ({
      name: m.id,
      message: `${m.name} — ${m.description}`,
    })),
    { name: "custom", message: "Enter custom model ID string..." },
  ];

  const { choice } = (await enquirer.prompt({
    type: "select",
    name: "choice",
    message: `Select model for ${provider.name}:`,
    choices,
  })) as { choice: string };

  let chosenModel = choice;
  if (choice === "custom") {
    const { customInput } = (await enquirer.prompt({
      type: "input",
      name: "customInput",
      message: "Enter custom model name (e.g. gpt-4-turbo or claude-3-5-sonnet):",
    })) as { customInput: string };

    if (!customInput || customInput.trim() === "") {
      console.log(colors.amberFlag.apply("No model entered. Model unchanged."));
      return;
    }
    chosenModel = customInput.trim();
  }

  setActiveModel(activeProvider, chosenModel);
  console.log(colors.mintClear.apply(`✔ Updated active model for ${provider.name} to '${chosenModel}'`));
}

/**
 * Remove stored AI provider key
 */
export async function executeAIRemove(): Promise<void> {
  const config = getAIConfig();
  if (!config.activeProvider) {
    console.log(colors.amberFlag.apply("No AI provider currently configured to remove."));
    return;
  }

  const activeProvider = config.activeProvider;
  await deleteApiKey(activeProvider);
  setAIConfig({ activeProvider: undefined });

  console.log(colors.mintClear.apply(`✔ Removed API key and configuration for provider '${activeProvider}'.`));
}

/**
 * Re-test validation on configured API key
 */
export async function executeAITest(): Promise<void> {
  const config = getAIConfig();
  if (!config.activeProvider) {
    console.log(colors.amberFlag.apply("No AI provider configured. Run 'bilt ai setup' first."));
    return;
  }

  const provider = getProvider(config.activeProvider);
  if (provider.requiresApiKey === false) {
    console.log(colors.mintClear.apply(`✔ ${provider.name} is available (offline deterministic mode).`));
    return;
  }

  const keyInfo = await getApiKey(config.activeProvider);
  if (!keyInfo.key) {
    console.log(colors.pulseCoral.apply(`No API key found for provider '${config.activeProvider}'.`));
    return;
  }

  const activeModel = getActiveModel(config.activeProvider);
  console.log(text.dim(`Testing API key for ${provider.name} (model: ${activeModel})...`));

  const isValid = await provider.validateKey(keyInfo.key);
  if (isValid) {
    recordValidation(config.activeProvider);
    console.log(colors.mintClear.apply(`✔ API key for ${provider.name} is valid and working.`));
  } else {
    console.log(colors.pulseCoral.apply(`❌ Validation failed for ${provider.name}. Key may be expired or revoked.`));
  }
}

/**
 * Display last redacted AI payload for auditing
 */
export async function executeAILastRequest(): Promise<void> {
  console.log(sectionHeader("Bilt AI Last Request Audit Payload"));
  const payload = getLastRequestPayload();

  if (!payload) {
    console.log(colors.amberFlag.apply("No AI requests have been sent yet."));
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
}
