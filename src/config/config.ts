import { cosmiconfig } from "cosmiconfig";
import type { BiltConfig } from "../types/index.js";

// ─── Default Configuration (Zero-Config) ────────────────────────────────────

export const DEFAULT_CONFIG: BiltConfig = {
  ignore: [
    "node_modules/**",
    ".git/**",
    "dist/**",
    "build/**",
    "coverage/**",
    ".bilt/**",
    "venv/**",
    ".venv/**",
    "__pycache__/**",
    ".next/**",
    ".nuxt/**",
    ".cache/**",
    ".vercel/**",
    ".netlify/**",
    "*.min.js",
    "*.min.css",
    "*.map",
    "*.lock",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
  ],
  severityOverrides: {},
  plugins: [],
  entropyThreshold: 4.5,
  historyDepth: 10,
  customRules: [],
  funMode: false,
  sound: false,
};

// ─── Config Loader ───────────────────────────────────────────────────────────

const explorer = cosmiconfig("bilt", {
  searchPlaces: [
    ".biltrc",
    ".biltrc.json",
    ".biltrc.yaml",
    ".biltrc.yml",
    ".biltrc.js",
    ".biltrc.cjs",
    ".biltrc.mjs",
    "bilt.config.js",
    "bilt.config.cjs",
    "bilt.config.mjs",
    "bilt.config.ts",
  ],
});

/**
 * Load and merge user configuration with defaults.
 * If no config file exists, returns defaults (zero-config).
 */
export async function loadConfig(searchFrom?: string): Promise<BiltConfig> {
  try {
    const result = await explorer.search(searchFrom);

    if (!result || result.isEmpty) {
      return { ...DEFAULT_CONFIG };
    }

    const userConfig = result.config as Partial<BiltConfig>;

    return {
      ignore: userConfig.ignore
        ? [...DEFAULT_CONFIG.ignore, ...userConfig.ignore]
        : [...DEFAULT_CONFIG.ignore],
      severityOverrides: {
        ...DEFAULT_CONFIG.severityOverrides,
        ...userConfig.severityOverrides,
      },
      plugins: userConfig.plugins ?? DEFAULT_CONFIG.plugins,
      entropyThreshold:
        userConfig.entropyThreshold ?? DEFAULT_CONFIG.entropyThreshold,
      historyDepth: userConfig.historyDepth ?? DEFAULT_CONFIG.historyDepth,
      customRules: userConfig.customRules
        ? [...DEFAULT_CONFIG.customRules, ...userConfig.customRules]
        : [...DEFAULT_CONFIG.customRules],
      funMode: userConfig.funMode ?? DEFAULT_CONFIG.funMode,
      sound: userConfig.sound ?? DEFAULT_CONFIG.sound,
    };
  } catch {
    // If config loading fails, silently use defaults (zero-config philosophy)
    return { ...DEFAULT_CONFIG };
  }
}
