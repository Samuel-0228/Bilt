import path from "node:path";
import { executeScan } from "./scan.js";
import { toAgentFinding } from "../core/finding/mapper.js";
import { createBaseline } from "../core/scoping/baseline.js";
import { colors, glyphs } from "../ui/theme.js";

export async function executeBaselineCreate(
  dir: string = ".",
  options: { json?: boolean } = {},
): Promise<string> {
  const rootDir = path.resolve(dir);
  const scanResult = await executeScan(rootDir, { quiet: true });

  const fingerprints = scanResult.findings.map((f) => {
    const af = toAgentFinding(f);
    return af.fingerprint;
  });

  const baselineFile = await createBaseline(rootDir, fingerprints);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          success: true,
          baselineFile,
          fingerprintsCount: fingerprints.length,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("");
    console.log(
      `  ${colors.mintClear.apply(glyphs.passed)} Baseline created with ${colors.vitalTeal.bold(
        String(fingerprints.length),
      )} fingerprints.`,
    );
    console.log(`  Saved to: ${colors.slateDim.dim(baselineFile)}`);
    console.log("");
  }

  return baselineFile;
}
