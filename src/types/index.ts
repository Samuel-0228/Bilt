// ─── Severity & Categories ───────────────────────────────────────────────────

export type Severity = 'critical' | 'warning' | 'info';

export type FindingCategory =
  | 'secret-detected'
  | 'env-missing'
  | 'env-unused'
  | 'env-mismatch'
  | 'env-exposed'
  | 'gitignore-missing'
  | 'framework-warning'
  | 'plugin-finding';

// ─── Scan Finding ────────────────────────────────────────────────────────────

export interface ScanFinding {
  id: string;
  severity: Severity;
  category: FindingCategory;
  message: string;
  file: string;
  line?: number;
  column?: number;
  suggestion?: string;
  provider?: ProviderInfo;
  ruleId?: string;
  /** Masked preview of the detected value */
  preview?: string;
}

// ─── Scan Result ─────────────────────────────────────────────────────────────

export interface ScanResult {
  findings: ScanFinding[];
  healthScore: number;
  grade: string;
  timestamp: Date;
  scannedFiles: number;
  framework?: FrameworkInfo;
  duration: number;
}

// ─── Secret Detection Rules ──────────────────────────────────────────────────

export interface SecretRule {
  id: string;
  name: string;
  pattern: RegExp;
  provider?: string;
  severity: Severity;
  description: string;
}

// ─── Provider Info (Rotation Help) ───────────────────────────────────────────

export interface ProviderInfo {
  name: string;
  displayName: string;
  icon: string;
  rotationUrl: string;
  docsUrl: string;
}

// ─── Fix Actions ─────────────────────────────────────────────────────────────

export type FixType = 'safe' | 'destructive' | 'irreversible';

export interface FixAction {
  id: string;
  description: string;
  type: FixType;
  /** The finding this fix addresses */
  findingId: string;
  /** Preview of what the fix will do */
  preview?: string;
  /** Function to apply the fix — returns true if successful */
  apply: () => Promise<boolean>;
}

// ─── Snapshots ───────────────────────────────────────────────────────────────

export interface SnapshotFile {
  path: string;
  content: string;
}

export interface Snapshot {
  id: string;
  timestamp: Date;
  description: string;
  files: SnapshotFile[];
}

export interface SnapshotManifest {
  id: string;
  timestamp: string;
  description: string;
  filePaths: string[];
}

// ─── Configuration ───────────────────────────────────────────────────────────

export interface BiltConfig {
  /** Glob patterns to ignore during scanning */
  ignore: string[];
  /** Severity overrides by rule ID */
  severityOverrides: Record<string, Severity>;
  /** Paths to plugin files/packages */
  plugins: string[];
  /** Entropy threshold for secret detection */
  entropyThreshold: number;
  /** Number of git commits to scan (default 10) */
  historyDepth: number;
  /** Custom secret rules */
  customRules: SecretRule[];
  /** Enable fun mode */
  funMode: boolean;
}

// ─── Framework Detection ─────────────────────────────────────────────────────

export interface FrameworkInfo {
  name: string;
  displayName: string;
  /** Prefixes that expose env vars to client bundles */
  clientExposedPrefixes: string[];
  /** Config files that identify this framework */
  configFiles: string[];
}

// ─── Plugin System ───────────────────────────────────────────────────────────

export interface PluginContext {
  /** Root directory of the project */
  rootDir: string;
  /** All files in the project (relative paths) */
  files: string[];
  /** Parsed env vars from all .env files */
  envVars: Map<string, Map<string, string>>;
  /** Git info */
  git: {
    isRepo: boolean;
    branch?: string;
  };
  /** Bilt config */
  config: BiltConfig;
}

export interface PluginResult {
  findings: ScanFinding[];
  fixes?: FixAction[];
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  check: (context: PluginContext) => Promise<PluginResult>;
  fix?: (context: PluginContext) => Promise<PluginResult>;
}

// ─── Watch Events ────────────────────────────────────────────────────────────

export interface WatchEvent {
  type: 'add' | 'change' | 'unlink';
  file: string;
  findings: ScanFinding[];
  timestamp: Date;
}

// ─── Parsed Env ──────────────────────────────────────────────────────────────

export interface ParsedEnvEntry {
  key: string;
  value: string;
  line: number;
  comment?: string;
  /** Whether the value appears to be a secret */
  isSecret?: boolean;
}

export interface ParsedEnvFile {
  filePath: string;
  entries: Map<string, ParsedEnvEntry>;
  /** Raw lines for preserving structure */
  rawLines: string[];
}

// ─── CLI Options ─────────────────────────────────────────────────────────────

export interface ScanOptions {
  fullHistory?: boolean;
  json?: boolean;
  severity?: Severity;
  verbose?: boolean;
  quiet?: boolean;
  dryRun?: boolean;
  fun?: boolean;
}

export interface FixOptions {
  safe?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  quiet?: boolean;
}

export interface WatchOptions {
  quiet?: boolean;
  debounce?: number;
}
