import { isPlainMode } from "./theme.js";

/**
 * Play a subtle sound notification for critical findings.
 * Uses the standard terminal bell (\x07).
 */
export function playSound(): void {
  // Never play sound in plain mode (CI, piping, NO_COLOR)
  if (isPlainMode() || process.env.NO_COLOR) {
    return;
  }
  process.stdout.write("\x07");
}
