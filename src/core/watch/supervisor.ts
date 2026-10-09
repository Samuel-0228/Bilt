// ─── Bilt Agent Supervisor State Machine ──────────────────────────────────────
// Main supervisory controller for `bilt watch` / `bilt watch --format agent`.
// Tracks project state transitions:
// START SESSION -> BASELINE -> DETECT CHANGES -> RUN RELEVANT CHECKS ->
// COMPARE WITH PREVIOUS STATE -> REPORT PROGRESS -> DETECT REGRESSION/NO-PROGRESS/TAMPERING ->
// ALLOW CONTINUE / ESCALATE
// ─────────────────────────────────────────────────────────────────────────────

import path from "node:path";
import type { CheckResult } from "../readiness/check-runner.js";
import { runChecks } from "../readiness/check-runner.js";
import { formatAgentCheckOutput } from "../readiness/formatters/agent.js";
import type { AgentResponse, EscalationReason } from "../agent/protocol.js";
import {
  getOrStartSession,
  recordSessionIteration,
  type AgentSession,
  type SessionIterationResult,
} from "../agent/session.js";
import type { ReadinessCategory } from "../readiness/taxonomy.js";
import { detectTampering } from "../trust/tamper.js";
import { VERSION } from "../../version.js";

export type SupervisorState =
  | "IDLE"
  | "OBSERVING"
  | "CHANGE_DETECTED"
  | "ANALYZING"
  | "FINDINGS_GENERATED"
  | "VERIFYING"
  | "PROGRESS"
  | "REGRESSION"
  | "PASS"
  | "ESCALATE";

export interface SupervisorStatusPayload {
  supervisorState: SupervisorState;
  session: AgentSession;
  lastChangedFiles: string[];
  response: AgentResponse;
  allowedToContinue: boolean;
  delta?: SessionIterationResult["delta"];
}

export class BiltSupervisor {
  private rootDir: string;
  private state: SupervisorState = "IDLE";
  private session!: AgentSession;
  private isProcessing = false;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  /**
   * START SESSION & BASELINE:
   * Initialize session, execute initial baseline scan, and enter OBSERVING state.
   */
  public async initialize(): Promise<AgentSession> {
    this.session = await getOrStartSession(this.rootDir);
    this.state = "OBSERVING";
    return this.session;
  }

  public getState(): SupervisorState {
    return this.state;
  }

  /**
   * Determine targeted check categories based on changed file patterns
   * to avoid unnecessarily scanning unaffected systems.
   */
  private determineRelevantCategories(
    changedFiles: string[],
  ): ReadinessCategory[] | undefined {
    if (changedFiles.length === 0) return undefined;

    const categories = new Set<ReadinessCategory>();

    for (const file of changedFiles) {
      const lower = file.toLowerCase();
      const ext = path.extname(lower);

      if (
        lower.includes(".env") ||
        lower.includes(".gitignore") ||
        lower.includes("secret") ||
        lower.includes("key")
      ) {
        categories.add("secrets-and-env");
      }

      if (
        lower.includes("package.json") ||
        lower.includes("pnpm-lock") ||
        lower.includes("package-lock") ||
        lower.includes("yarn.lock")
      ) {
        categories.add("dependencies");
      }

      if (
        [".tsx", ".jsx", ".html", ".css", ".scss", ".vue", ".svelte"].includes(ext) ||
        lower.includes("/ui/") ||
        lower.includes("/components/")
      ) {
        categories.add("design-quality");
      }

      if ([".ts", ".js", ".mjs", ".cjs", ".py", ".go"].includes(ext)) {
        if (
          lower.includes("auth") ||
          lower.includes("login") ||
          lower.includes("jwt") ||
          lower.includes("session")
        ) {
          categories.add("auth");
          categories.add("authorization");
        }
        if (
          lower.includes("route") ||
          lower.includes("api") ||
          lower.includes("controller") ||
          lower.includes("endpoint") ||
          lower.includes("server")
        ) {
          categories.add("auth");
          categories.add("authorization");
          categories.add("input-validation");
          categories.add("api-abuse-and-cost");
        }
        if (
          lower.includes("db") ||
          lower.includes("schema") ||
          lower.includes("migration") ||
          lower.includes("model")
        ) {
          categories.add("database");
        }
        if (
          lower.includes("log") ||
          lower.includes("error") ||
          lower.includes("sentry")
        ) {
          categories.add("error-handling-logs");
        }
      }
    }

    if (categories.size > 0 && categories.size <= 5) {
      return Array.from(categories);
    }
    return undefined;
  }

  /**
   * Handle modified files event, execute scoped verification pass, update session state,
   * detect regressions & anti-tamper, and stream structured AgentResponse.
   */
  public async handleFileChanges(
    changedFiles: string[],
    isAgentFormat = false,
  ): Promise<SupervisorStatusPayload> {
    if (this.isProcessing) {
      const fallbackCheck = await runChecks({ dir: this.rootDir });
      return this.buildPayload([], fallbackCheck, "OBSERVING");
    }

    this.isProcessing = true;
    this.state = "CHANGE_DETECTED";

    try {
      this.state = "ANALYZING";

      // 1. Anti-tamper inspection on modified files
      const tamperFindings = await detectTampering(this.rootDir, "HEAD~1").catch(() => []);
      const criticalTamper = tamperFindings.find((t) => t.severity === "critical");

      // 2. Scoped execution of relevant checks
      const relevantCategories = this.determineRelevantCategories(changedFiles);
      const checkResult = await runChecks({
        dir: this.rootDir,
        categories: relevantCategories,
      });

      this.state = "VERIFYING";
      const currentFps = checkResult.findings.map((f) => f.fingerprint);

      // 3. Compare with previous state & track session progression
      const sessionResult = await recordSessionIteration(this.rootDir, currentFps, {
        changedFiles,
        tamperDetected: Boolean(criticalTamper),
        tamperDetail: criticalTamper?.message,
        isCleanPass: checkResult.gate.status === "production-ready" && !criticalTamper,
      });

      this.session = sessionResult.session;

      // 4. Determine supervisor state
      if (sessionResult.escalation) {
        this.state = "ESCALATE";
      } else if (checkResult.gate.status === "production-ready" && !criticalTamper) {
        this.state = "PASS";
      } else if (sessionResult.delta.regressions.length > 0) {
        this.state = "REGRESSION";
      } else if (sessionResult.delta.resolved.length > sessionResult.delta.introduced.length) {
        this.state = "PROGRESS";
      } else {
        this.state = "FINDINGS_GENERATED";
      }

      // 5. Construct canonical AgentResponse
      const response = formatAgentCheckOutput(
        checkResult,
        VERSION,
        "bilt watch --format agent",
        this.rootDir,
        this.session.previousFingerprints,
        this.session,
        sessionResult.escalation,
        sessionResult.delta.regressions,
      );

      if (criticalTamper && response.status !== "escalate") {
        response.status = "fail";
        response.allowedToContinue = false;
        response.nextAction = {
          type: "fix",
          findingIds: ["TAMPER-CONFIG"],
          instruction: `CRITICAL: Anti-tamper violation detected: ${criticalTamper.message}. Revert configuration tampering immediately.`,
        };
      }

      const payload = this.buildPayload(
        changedFiles,
        checkResult,
        this.state,
        response,
        sessionResult.delta,
      );

      if (isAgentFormat) {
        console.log(JSON.stringify(payload.response, null, 2));
      }

      return payload;
    } finally {
      this.isProcessing = false;
      if (this.state !== "ESCALATE" && this.state !== "PASS") {
        this.state = "OBSERVING";
      }
    }
  }

  private buildPayload(
    changedFiles: string[],
    result: CheckResult,
    state: SupervisorState,
    response?: AgentResponse,
    delta?: SessionIterationResult["delta"],
  ): SupervisorStatusPayload {
    const finalResponse =
      response ||
      formatAgentCheckOutput(
        result,
        VERSION,
        "bilt watch --format agent",
        this.rootDir,
        this.session?.previousFingerprints,
        this.session,
      );

    return {
      supervisorState: state,
      session: this.session,
      lastChangedFiles: changedFiles,
      response: finalResponse,
      allowedToContinue: finalResponse.allowedToContinue,
      delta,
    };
  }
}
