// ─── Core Logging Abstraction ────────────────────────────────────────────────
// Deterministic, structured diagnostic logger for Bilt internals.
// Keeps machine-readable stdout clean by routing diagnostic logs to stderr.
// ─────────────────────────────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export interface LogEntry {
  level: LogLevel;
  namespace?: string;
  message: string;
  args: unknown[];
  timestamp: number;
}

export type LogSink = (entry: LogEntry) => void;

const LOG_LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

function resolveDefaultLogLevel(): LogLevel {
  if (process.env.BILT_DEBUG === "1" || process.env.BILT_DEBUG === "true") {
    return "debug";
  }
  const envLevel = process.env.BILT_LOG_LEVEL?.toLowerCase();
  if (envLevel && envLevel in LOG_LEVEL_SEVERITY) {
    return envLevel as LogLevel;
  }
  return "warn";
}

export class Logger {
  private level: LogLevel;
  private namespace?: string;
  private customSink?: LogSink;

  constructor(options?: { level?: LogLevel; namespace?: string; sink?: LogSink }) {
    this.level = options?.level ?? resolveDefaultLogLevel();
    this.namespace = options?.namespace;
    this.customSink = options?.sink;
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  public getLevel(): LogLevel {
    return this.level;
  }

  public isDebugEnabled(): boolean {
    return LOG_LEVEL_SEVERITY[this.level] <= LOG_LEVEL_SEVERITY.debug;
  }

  public child(namespace: string): Logger {
    const combinedNamespace = this.namespace
      ? `${this.namespace}:${namespace}`
      : namespace;
    return new Logger({
      level: this.level,
      namespace: combinedNamespace,
      sink: this.customSink,
    });
  }

  public setSink(sink?: LogSink): void {
    this.customSink = sink;
  }

  public debug(message: string, ...args: unknown[]): void {
    this.emit("debug", message, args);
  }

  public info(message: string, ...args: unknown[]): void {
    this.emit("info", message, args);
  }

  public warn(message: string, ...args: unknown[]): void {
    this.emit("warn", message, args);
  }

  public error(message: string, ...args: unknown[]): void {
    this.emit("error", message, args);
  }

  private emit(level: LogLevel, message: string, args: unknown[]): void {
    if (LOG_LEVEL_SEVERITY[level] < LOG_LEVEL_SEVERITY[this.level]) {
      return;
    }

    const entry: LogEntry = {
      level,
      namespace: this.namespace,
      message,
      args,
      timestamp: Date.now(),
    };

    if (this.customSink) {
      this.customSink(entry);
      return;
    }

    // Default sink: write to process.stderr to preserve stdout integrity for machine formats
    const prefix = this.namespace ? `[${this.namespace}] ` : "";
    const formatted = `${prefix}${message}`;
    if (args.length > 0) {
      if (level === "error") {
        console.error(formatted, ...args);
      } else if (level === "warn") {
        console.warn(formatted, ...args);
      } else {
        console.error(formatted, ...args);
      }
    } else {
      if (level === "error") {
        console.error(formatted);
      } else if (level === "warn") {
        console.warn(formatted);
      } else {
        console.error(formatted);
      }
    }
  }
}

export const logger = new Logger();
