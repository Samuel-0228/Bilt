import path from "node:path";
import { promises as fs } from "node:fs";

export interface BaselineData {
  version: "1.0.0";
  createdAt: string;
  count: number;
  fingerprints: string[];
}

export function getBaselinePath(rootDir: string): string {
  return path.join(rootDir, ".bilt", "baseline.json");
}

export async function createBaseline(
  rootDir: string,
  fingerprints: string[],
): Promise<string> {
  const biltDir = path.join(rootDir, ".bilt");
  await fs.mkdir(biltDir, { recursive: true });

  const baselinePath = getBaselinePath(rootDir);
  const uniqueFps = Array.from(new Set(fingerprints)).sort();

  const data: BaselineData = {
    version: "1.0.0",
    createdAt: new Date().toISOString(),
    count: uniqueFps.length,
    fingerprints: uniqueFps,
  };

  await fs.writeFile(baselinePath, JSON.stringify(data, null, 2), "utf-8");
  return baselinePath;
}

export async function loadBaseline(
  rootDir: string,
): Promise<Set<string> | null> {
  const baselinePath = getBaselinePath(rootDir);
  try {
    const raw = await fs.readFile(baselinePath, "utf-8");
    const data = JSON.parse(raw) as BaselineData;
    if (Array.isArray(data.fingerprints)) {
      return new Set(data.fingerprints);
    }
    return null;
  } catch {
    return null;
  }
}

export function isFingerprintInBaseline(
  fingerprint: string,
  baseline: Set<string> | null,
): boolean {
  if (!baseline) return false;
  return baseline.has(fingerprint);
}
