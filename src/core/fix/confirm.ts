// ─── Fix Confirmation Prompts ────────────────────────────────────────────────
//
// Interactive prompts to confirm destructive or irreversible fix actions.
// Uses enquirer for terminal prompts.
//
// Three tiers:
//   1. Safe actions      → no prompt, returns true immediately.
//   2. Destructive       → simple y/n confirmation.
//   3. Irreversible      → user must type the filename to confirm.
// ─────────────────────────────────────────────────────────────────────────────

import Enquirer from "enquirer";
import type { FixAction } from "../../types/index.js";

// enquirer's CJS default export needs this accessor in ESM
const enquirer = new Enquirer();

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Prompt the user to type the filename to confirm an **irreversible** action.
 *
 * Used for actions like permanently deleting a file or rewriting git history
 * where a simple y/n is not enough assurance.
 *
 * @param action   The fix action being applied.
 * @param fileName The filename the user must type to confirm.
 * @returns `true` if the user typed the correct filename, `false` otherwise.
 */
export async function requireTypedConfirmation(
  action: FixAction,
  fileName: string,
): Promise<boolean> {
  // Safe actions and test environment need no confirmation
  if (
    action.type === "safe" ||
    process.env.NODE_ENV === "test" ||
    process.env.VITEST
  )
    return true;

  const response = (await enquirer.prompt({
    type: "input",
    name: "confirm",
    message:
      `⚠️  This action is IRREVERSIBLE: ${action.description}\n` +
      `   Type "${fileName}" to confirm:`,
  })) as { confirm: string };

  return response.confirm.trim() === fileName;
}

/**
 * Prompt the user for a simple y/n confirmation for a **destructive**
 * action.
 *
 * @param action The fix action being applied.
 * @returns `true` if the user confirms, `false` otherwise.
 */
export async function requireSimpleConfirmation(
  action: FixAction,
): Promise<boolean> {
  // Safe actions and test environment need no confirmation
  if (
    action.type === "safe" ||
    process.env.NODE_ENV === "test" ||
    process.env.VITEST
  )
    return true;

  const response = (await enquirer.prompt({
    type: "confirm",
    name: "confirm",
    message: `Apply fix: ${action.description}?`,
    initial: false,
  })) as { confirm: boolean };

  return response.confirm;
}
