import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const assetDirectories = [
  {
    from: path.join(rootDir, "src/concepts"),
    to: path.join(rootDir, "dist/concepts"),
  },
  {
    from: path.join(rootDir, "src/core/rules/providers/knowledge"),
    to: path.join(rootDir, "dist/core/rules/providers/knowledge"),
  },
  {
    from: path.join(rootDir, "src/core/output/schemas"),
    to: path.join(rootDir, "dist/core/output/schemas"),
  },
];

for (const { from, to } of assetDirectories) {
  if (fs.existsSync(from)) {
    fs.mkdirSync(to, { recursive: true });
    fs.cpSync(from, to, { recursive: true });
    console.log(`[copy-assets] Copied ${path.relative(rootDir, from)} -> ${path.relative(rootDir, to)}`);
  } else {
    console.warn(`[copy-assets] Warning: Source directory does not exist: ${from}`);
  }
}
