import type { BiltConfig, ScanFinding } from "../../types/index.js";

export interface EngineContext {
  rootDir: string;
  config: BiltConfig;
  files?: Array<{ path: string; content: string }>;
  frameworksDetected?: string[];
  options?: {
    fullHistory?: boolean;
    noVerify?: boolean;
    includeTests?: boolean;
    debug?: boolean;
  };
}

export interface EngineFixResult {
  success: boolean;
  message?: string;
  modifiedFiles?: string[];
}

export interface Engine {
  id: string;
  version: string;
  description: string;
  analyze(context: EngineContext): Promise<ScanFinding[]>;
  canFix?(finding: ScanFinding): boolean;
  fix?(finding: ScanFinding, context: EngineContext): Promise<EngineFixResult>;
}
