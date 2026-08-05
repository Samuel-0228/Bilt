// ─── Bilt Welcome & Onboarding Command ─────────────────────────────────────────

import { runOnboardingWizard } from "../core/onboarding/first-run.js";
import { markFirstRunCompleted } from "../core/ai/config.js";

export async function executeWelcome(): Promise<void> {
  await runOnboardingWizard();
  markFirstRunCompleted();
}
