// ─── Bilt Agent Supervisor State Machine ──────────────────────────────────────
// Main supervisory controller for `bilt watch` / `bilt watch --format agent`.
// Tracks project state transitions:
// IDLE -> OBSERVING -> CHANGE DETECTED -> ANALYZING -> VERIFYING -> PROGRESS/REGRESSION -> PASS/ESCALATE
// ─────────────────────────────────────────────────────────────────────────────

import path from "node:path";
import type { CheckResult } from "../readiness/check-runner.js";
import { runChecks } from "../readiness/check-runner.js";
import { formatAgentCheckOutput } from "../readiness/formatters/agent.js";
import type { AgentResponse, EscalationReason } from "../agent/protocol.js";
import { getOrStartSession, updateSessionState, type AgentSession } from "../agent/session.js";
import { recordChangeIteration, type ChangeRecord } from "../loop/ledger.js";
import { checkLoopProgress } from "../loop/state.js";
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
  ledgerRecord?: ChangeRecord;
}

export class BiltSupervisor {
  private rootDir: string;
  private state: SupervisorState = "IDLE";
  private session!: AgentSession;
  private isProcessing = false;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  public async initialize(): Promise<AgentSession> {
    this.session = await getOrStartSession(this.rootDir);
    this.state = "OBSERVING";
    return this.session;
  }

  public getState(): SupervisorState {
    return this.state;
  }

  /**
   * Handle modified files event, execute verification pass, update change ledger,
   * check loop thrashing/regressions, and return structured AgentResponse payload.
   */
  public async handleFileChanges(
    changedFiles: string[],
    isAgentFormat = false,
  ): Promise<SupervisorStatusPayload> {
    if (this.isProcessing) {
      // Coalesce overlapping change events
      return this.buildPayload([], await runChecks({ dir: this.rootDir }), "OBSERVING");
    }

    this.isProcessing = true;
    this.state = "CHANGE_DETECTED";

    try {
      this.state = "ANALYZING";
      const checkResult = await runChecks({ dir: this.rootDir });

      this.state = "VERIFYING";
      const currentFps = checkResult.findings.map((f) => f.fingerprint);

      // Loop / Thrashing check
      const loopCheck = await checkLoopProgress(this.rootDir, currentFps).catch(() => null);

      let escalationReason:
        | { reason: import("../agent/protocol.js").EscalationReason; detail: string }
        | undefined;

      if (loopCheck?.shouldEscalate) {
        escalationReason = {
          reason: "no-progress",
          detail: loopCheck.escalationReason || "Supervision loop escalation triggered.",
        };
      }

      // Record in Change Ledger
      const prevFps = this.session.previousFingerprints || [];
      const ledgerRecord = await recordChangeIteration(
        this.rootDir,
        this.session.id,
        this.session.iteration + 1,
        prevFps,
        currentFps,
        changedFiles,
      );

      // Update Supervisor State
      if (escalationReason) {
        this.state = "ESCALATE";
      } else if (checkResult.gate.status === "production-ready") {
        this.state = "PASS";
      } else if (ledgerRecord.state === "regressed") {
        this.state = "REGRESSION";
      } else if (ledgerRecord.state === "progress") {
        this.state = "PROGRESS";
      } else {
        this.state = "FINDINGS_GENERATED";
      }

      // Update session state
      const sessionStatus =
        this.state === "PASS"
          ? "passed"
          : this.state === "ESCALATE"
            ? "escalated"
            : "active";

      this.session = await updateSessionState(this.rootDir, currentFps, sessionStatus);

      // Build AgentResponse
      const response = formatAgentCheckOutput(
        checkResult,
        VERSION,
        "bilt watch --format agent",
        this.rootDir,
        prevFps,
      );

      if (escalationReason) {
        response.status = "escalate";
        response.escalation = escalationReason;
        response.nextAction = {
          type: "escalate",
          findingIds: [],
          instruction:
            "HALT automated retries. Bilt supervisor detected a loop or regression. Stop and explain the situation to the human developer.",
        };
      }

      const payload = this.buildPayload(changedFiles, checkResult, this.state, response, ledgerRecord);

      if (isAgentFormat) {
        console.log(JSON.stringify(payload, null, 2));
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
    ledgerRecord?: ChangeRecord,
  ): SupervisorStatusPayload {
    const finalResponse =
      response ||
      formatAgentCheckOutput(
        result,
        VERSION,
        "bilt watch --format agent",
        this.rootDir,
      );

    return {
      supervisorState: state,
      session: this.session,
      lastChangedFiles: changedFiles,
      response: finalResponse,
      ledgerRecord,
    };
  }
}
