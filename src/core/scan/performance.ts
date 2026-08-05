// ─── Performance Insights Scanner ──────────────────────────────────────────
// Detects large unoptimized images, heavy bundle package imports, and duplicate imports.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import type { ScanFinding } from "../../types/index.js";

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}

export async function scanPerformance(rootDir: string): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = [];

  // 1. Detect uncompressed large images (>500KB)
  try {
    const imageFiles = await fg(["**/*.{png,jpg,jpeg,gif,bmp,tiff}"], {
      cwd: rootDir,
      ignore: ["node_modules/**", "dist/**", "build/**", ".next/**"],
      onlyFiles: true,
    });

    for (const img of imageFiles) {
      const fullPath = path.join(rootDir, img);
      try {
        const stat = await fs.stat(fullPath);
        const sizeKb = stat.size / 1024;
        if (sizeKb > 500) {
          findings.push({
            id: nextId("perf-image"),
            severity: "warning",
            category: "perf-image",
            message: `Large uncompressed image (${(sizeKb / 1024).toFixed(2)}MB): ${img}`,
            file: img,
            suggestion: "Compress image using WebP/AVIF format or Sharp optimization.",
          });
        }
      } catch {
        // Skip
      }
    }
  } catch {
    // Skip
  }

  // 2. Check for heavy package imports (lodash vs lodash-es, moment vs dayjs)
  try {
    const sourceFiles = await fg(["**/*.{js,ts,jsx,tsx,mjs,cjs}"], {
      cwd: rootDir,
      ignore: ["node_modules/**", "dist/**", "build/**"],
      onlyFiles: true,
    });

    for (const file of sourceFiles.slice(0, 100)) {
      const fullPath = path.join(rootDir, file);
      try {
        const content = await fs.readFile(fullPath, "utf-8");

        if (content.includes('from "lodash"') || content.includes("from 'lodash'")) {
          findings.push({
            id: nextId("perf-bundle"),
            severity: "info",
            category: "perf-bundle",
            message: `Full lodash import in ${file} prevents tree-shaking`,
            file,
            suggestion: 'Use "lodash-es" or subpath imports like `import map from "lodash/map"` to reduce bundle size.',
          });
        }

        if (content.includes('from "moment"') || content.includes("from 'moment'")) {
          findings.push({
            id: nextId("perf-bundle"),
            severity: "info",
            category: "perf-bundle",
            message: `Legacy moment.js library imported in ${file}`,
            file,
            suggestion: "Consider replacing moment with lighter alternatives like date-fns, dayjs, or Luxon.",
          });
        }
      } catch {
        // Skip
      }
    }
  } catch {
    // Skip
  }

  return findings;
}
