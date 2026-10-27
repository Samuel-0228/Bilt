import { promises as fs } from "node:fs";
import path from "node:path";
import type { DesignBrief } from "./types.js";

function getBriefPath(rootDir: string): string {
  return path.join(rootDir, ".bilt", "design-brief.json");
}

export async function readDesignBrief(rootDir: string): Promise<DesignBrief | null> {
  try {
    const briefPath = getBriefPath(rootDir);
    const content = await fs.readFile(briefPath, "utf-8");
    return JSON.parse(content) as DesignBrief;
  } catch {
    return null; // Fail-soft on missing or malformed JSON
  }
}

export async function writeDesignBrief(rootDir: string, brief: DesignBrief): Promise<void> {
  const biltDir = path.join(rootDir, ".bilt");
  await fs.mkdir(biltDir, { recursive: true });
  const briefPath = getBriefPath(rootDir);
  await fs.writeFile(briefPath, JSON.stringify(brief, null, 2), "utf-8");
}

export async function clearDesignBrief(rootDir: string): Promise<void> {
  try {
    const briefPath = getBriefPath(rootDir);
    await fs.unlink(briefPath);
  } catch {
    // Ignore error if it doesn't exist
  }
}
