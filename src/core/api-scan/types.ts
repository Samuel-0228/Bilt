// ─── API Scan Types ───────────────────────────────────────────────────────────
// Data structures for route detection, schema analysis, and API scanning.
// ─────────────────────────────────────────────────────────────────────────────

import type { Severity } from "../../types/index.js";

export type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD" | "ALL" | "WILDCARD";

export interface APIRouteInfo {
  id: string;
  method: HTTPMethod;
  path: string;
  handlerFile: string;
  handlerLine: number;
  framework: "express" | "fastify" | "nextjs" | "fastapi" | "django" | "rails" | "unknown";
  codeSnippet: string;
  handlerContent: string;
}

export interface ModelFieldInfo {
  name: string;
  type?: string;
  isSensitive?: boolean;
}

export interface ModelSchemaInfo {
  modelName: string;
  file: string;
  fields: ModelFieldInfo[];
}

export interface ApiScanOptions {
  severity?: Severity;
  details?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  json?: boolean;
  debug?: boolean;
}
