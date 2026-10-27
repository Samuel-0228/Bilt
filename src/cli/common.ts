import { colors, glyphs } from "../ui/theme.js";
import { redactKnownSecrets } from "../core/safety/sanitizer.js";

export function printError(error: unknown, debug?: boolean): void {
  const isDebug = debug || process.env.DEBUG === "1" || process.env.DEBUG === "true";
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = redactKnownSecrets(rawMessage);
  console.error("");
  console.error(
    colors.pulseCoral.bold(`  ${glyphs.critical} Error: ${message}`),
  );
  if (isDebug && error instanceof Error && error.stack) {
    const stackLines = error.stack.split("\n").slice(1, 6);
    for (const line of stackLines) {
      console.error(colors.slateDim.dim(`  ${redactKnownSecrets(line.trim())}`));
    }
  }
  console.error("");
}
