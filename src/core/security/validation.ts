// ─── Input & Boundary Security Validation Engine ─────────────────────────────
// Validates all untrusted inputs across CLI arguments, configuration files,
// state files, baseline data, design briefs, AI responses, and plugin payloads
// using strict Zod schemas to prevent prototype pollution, injection, and corruption.

import { z } from "zod";
import type { BiltConfig, ScanFinding, Severity } from "../../types/index.js";
import type { LoopState } from "../loop/state.js";
import type { BaselineData } from "../scoping/baseline.js";
import type { DesignBrief } from "../design/brief/types.js";
import type { PluginManifest, PluginResult } from "../../plugins/interface.js";
import { ConfigurationError, ValidationError } from "../errors/domain.js";
import { isPathContained } from "../safety/fs-guard.js";

// ── 1. Configuration Validation ──────────────────────────────────────────────

export const BiltConfigSchema = z.object({
  ignore: z.array(z.string()).optional(),
  severityOverrides: z.record(
    z.string(),
    z.enum(["info", "warning", "critical", "low", "medium", "high", "error"])
  ).optional(),
  plugins: z.array(z.string()).optional(),
  entropyThreshold: z.number().min(0).max(8).optional(),
  historyDepth: z.number().int().min(1).max(1000).optional(),
  customRules: z.array(z.any()).optional(),
  funMode: z.boolean().optional(),
  sound: z.boolean().optional(),
  ignoreUnused: z.array(z.string()).optional(),
  framework: z.string().optional(),
  designCheck: z.record(z.string(), z.any()).optional(),
}).passthrough();

export function validateBiltConfig(raw: unknown): Partial<BiltConfig> {
  if (raw === null || typeof raw !== "object") {
    return {};
  }
  const result = BiltConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new ConfigurationError("Malformed .biltrc configuration", {
      context: { issues: result.error.issues.map((i) => i.message) },
    });
  }
  return result.data as Partial<BiltConfig>;
}

// ── 2. State Files Validation (Loop State) ───────────────────────────────────

export const IterationRecordSchema = z.object({
  iteration: z.number().int().min(0),
  timestamp: z.string(),
  fingerprints: z.array(z.string()),
});

export const LoopStateSchema = z.object({
  currentIteration: z.number().int().min(0),
  taskId: z.string().optional(),
  history: z.array(IterationRecordSchema),
});

export function validateLoopState(raw: unknown): LoopState {
  const result = LoopStateSchema.safeParse(raw);
  if (!result.success) {
    return {
      currentIteration: 0,
      history: [],
    };
  }
  return result.data;
}

// ── 3. Baseline Data Validation ──────────────────────────────────────────────

export const BaselineDataSchema = z.object({
  version: z.literal("1.0.0"),
  createdAt: z.string(),
  count: z.number().int().min(0),
  fingerprints: z.array(z.string()),
});

export function validateBaselineData(raw: unknown): BaselineData | null {
  const result = BaselineDataSchema.safeParse(raw);
  if (!result.success) {
    return null;
  }
  return result.data;
}

// ── 4. Design Brief Validation ───────────────────────────────────────────────

export const DesignBriefFieldSchema = z.object({
  value: z.any(),
  source: z.string().optional(),
  type: z.string().optional(),
}).passthrough();

export const DesignBriefSchema = z.object({
  schemaVersion: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  purpose: z.any().optional(),
  audience: z.any().optional(),
  visualDirection: z.any().optional(),
  brandColors: z.any().optional(),
  desiredFeeling: z.any().optional(),
  creativeFreedom: z.string().optional(),
}).passthrough();

export function validateDesignBrief(raw: unknown): DesignBrief | null {
  if (raw === null || typeof raw !== "object") return null;
  const result = DesignBriefSchema.safeParse(raw);
  if (!result.success) {
    return null;
  }
  return result.data as unknown as DesignBrief;
}

// ── 5. Plugin Input & Output Validation ──────────────────────────────────────

export const ScanFindingSchema = z.object({
  id: z.string(),
  severity: z.enum(["info", "warning", "critical", "low", "medium", "high"]),
  category: z.string(),
  message: z.string(),
  file: z.string(),
  line: z.number().optional(),
  column: z.number().optional(),
  ruleId: z.string().optional(),
  suggestion: z.string().optional(),
  preview: z.string().optional(),
  confidence: z.enum(["low", "medium", "high"]).optional(),
}).passthrough();

export const PluginResultSchema = z.object({
  findings: z.array(ScanFindingSchema),
});

export function validatePluginManifest(plugin: unknown): plugin is PluginManifest {
  if (plugin === null || typeof plugin !== "object") return false;
  const p = plugin as Record<string, unknown>;
  if (typeof p["name"] !== "string" || !/^[a-zA-Z0-9_-]+$/.test(p["name"])) return false;
  if (typeof p["version"] !== "string" || p["version"].length === 0) return false;
  if (typeof p["description"] !== "string") return false;
  if (typeof p["check"] !== "function") return false;
  if (p["fix"] !== undefined && typeof p["fix"] !== "function") return false;
  return true;
}

export function validatePluginResult(result: unknown): PluginResult {
  const parsed = PluginResultSchema.safeParse(result);
  if (!parsed.success) {
    return { findings: [] };
  }
  return parsed.data as PluginResult;
}

// ── 6. AI Provider Response Validation ───────────────────────────────────────

export const AIExplanationSchema = z.object({
  summary: z.string().optional(),
  whyItMatters: z.string().optional(),
  howToFix: z.string().optional(),
  canBiltFix: z.boolean().optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
}).passthrough();

export function validateAIExplanation(raw: unknown): {
  summary?: string;
  whyItMatters?: string;
  howToFix?: string;
  canBiltFix?: boolean;
  confidence?: string;
} {
  const parsed = AIExplanationSchema.safeParse(raw);
  if (!parsed.success) {
    return {};
  }
  return parsed.data;
}

// ── 7. CLI Argument & Path Boundaries Validation ─────────────────────────────

export const FormatEnum = z.enum(["human", "agent", "json", "sarif", "markdown", "text"]);

export function validateCliFormat(format?: string): "human" | "agent" | "json" | "sarif" | "markdown" | "text" {
  if (!format) return "human";
  const parsed = FormatEnum.safeParse(format.toLowerCase());
  if (!parsed.success) {
    throw new ValidationError(`Unsupported format: "${format}". Allowed: human, agent, json, sarif, markdown, text`, {
      code: "ERR_VALIDATION_CLI_ARG",
      context: { format, allowed: FormatEnum.options },
    });
  }
  return parsed.data;
}

export function validateSafeCliPath(inputPath: string, rootDir: string): string {
  if (!inputPath || inputPath.includes("\0")) {
    throw new ValidationError("Path contains invalid or null byte characters", {
      code: "ERR_VALIDATION_PATH_TRAVERSAL",
      context: { path: inputPath },
    });
  }
  if (!isPathContained(inputPath, rootDir)) {
    throw new ValidationError(`Path escapes root project directory: "${inputPath}"`, {
      code: "ERR_VALIDATION_PATH_TRAVERSAL",
      context: { path: inputPath, rootDir },
    });
  }
  return inputPath;
}
