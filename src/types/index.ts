// ─── Severity & Categories ───────────────────────────────────────────────────

export type Severity = "critical" | "warning" | "info" | "passed";

export type FindingCategory =
  | "secret-detected"
  | "env-missing"
  | "env-unused"
  | "env-mismatch"
  | "env-exposed"
  | "gitignore-missing"
  | "framework-warning"
  | "plugin-finding";

export type VerificationState = "verified-live" | "verified-dead" | "unverified";

export type ConfidenceBucket = "low" | "medium" | "high";

export interface ProviderKnowledge {
  provider: string;
  type: string;
  whatItIs: string;
  why: string;
  safeAsPublic: boolean;
  action: string;
  docsUrl: string;
}

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
  /** Liveness verification state of a detected credential */
  verificationState?: VerificationState;
  /** Raw secret value (removed before serializing to user-facing results) */
  secret?: string;
  /** Context-aware confidence level */
  confidence?: ConfidenceBucket;
  /** The 5-question provider knowledge block */
  knowledge?: ProviderKnowledge;
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

export type FixType = "safe" | "destructive" | "irreversible";

export type FixRisk = "Low" | "High" | "Critical";

export interface FixPlan {
  steps: string[];
  estimatedTime: string;
  risk: FixRisk;
  requiresConfirmation?: string;
  instructions?: string;
}

export interface FixResult {
  success: boolean;
  stepsApplied: string[];
  error?: string;
}

export interface VerificationResult {
  passed: boolean;
  message: string;
}

export interface Fix {
  id: string;
  type: FixType;
  findingId: string;
  description: string;
  preview(): Promise<FixPlan>;
  apply(): Promise<FixResult>;
  verify(): Promise<VerificationResult>;
  undo(): Promise<void>;
}

// Deprecated in favor of the new Fix interface
export interface FixAction {
  id: string;
  description: string;
  type: FixType;
  findingId: string;
  preview?: string;
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
  /** Play subtle terminal sound on critical findings */
  sound?: boolean;
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
  type: "add" | "change" | "unlink";
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
  details?: boolean;
  noVerify?: boolean;
  debug?: boolean;
  retainSecrets?: boolean;
}

export interface FixOptions {
  safe?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  debug?: boolean;
}

export interface WatchOptions {
  quiet?: boolean;
  debounce?: number;
  poll?: boolean;
}
