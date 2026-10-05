# Bilt Agent Protocol — Reference (Schema Version `"1"`)

> **Core Principle**: Bilt is not an AI that reviews an AI.  
> Bilt is a **deterministic verification and control layer** that an AI coding agent operates against.
>
> `Bilt detects → AI explains → Agent acts → Bilt verifies`

---

## Authority Model

| Actor | Role |
|-------|------|
| **Bilt** | Authority — deterministic scanner and control plane |
| **Agent** | Executor — acts only on what Bilt says |
| **Developer** | Final authority — escalation target when loops occur |

The agent MUST NOT self-assess whether a finding is fixed.  
The agent MUST run `verificationCommand` from each finding's `agentAction` and let Bilt decide.

---

## Every `--format agent` Command Returns This Schema

```ts
interface AgentResponse {
  schemaVersion: "1";           // stable; increment only for breaking changes
  toolVersion: string;          // installed bilt-toolkit version

  status:
    | "pass"          // ✅ All clear. Zero introduced violations. Commit / PR OK.
    | "fail"          // ❌ Hard failure. MUST fix before proceeding.
    | "needs-review"  // ⚠️  Heuristic finding. Non-blocking but requires human review.
    | "escalate"      // 🔴 Loop detected. HALT. Explain to human maintainer.
    | "error";        // 🔴 Internal Bilt error. Review escalation.detail.

  summary: {
    total: number;
    blocking: number;
    high: number;
    medium: number;
    low: number;
    needsReview: number;
  };

  findings: Finding[];

  nextAction: {
    type:
      | "fix"       // Agent MUST apply fixes for findingIds
      | "review"    // Agent MUST present findings to human for decision
      | "verify"    // Agent MUST re-run bilt check after previous fixes
      | "rerun"     // Agent MUST re-run bilt check (external change)
      | "escalate"  // Agent MUST stop — loop detected
      | "none";     // ✅ All clear — commit / open PR

    findingIds: string[];   // IDs of findings to act on
    instruction: string;    // Human-readable reinforcement
  };

  execution: {
    command: string;        // full CLI command that produced this output
    projectRoot: string;    // absolute path of scanned project root
    durationMs: number;     // wall-clock scan time
  };

  progress?: {              // present when previousFingerprints available
    previous: number;       // findings in previous run
    current: number;        // findings in this run
    resolved: string[];     // fingerprints resolved since last run
    introduced: string[];   // fingerprints new since last run
    regressed: string[];    // fingerprints that re-appeared
    net: number;            // current - previous (negative = improvement)
  };

  escalation?: {            // only when status === "escalate"
    reason:
      | "no-progress"       // N runs, same fingerprints — stuck
      | "oscillation"       // A→B→A→B thrashing
      | "budget-exhausted"  // iteration budget exceeded
      | "tamper-detected"   // Bilt config was weakened
      | "unknown";
    detail: string;
  };

  disclaimer: string;
}
```

---

## Exit Codes

| Exit Code | Status | Agent Action |
|-----------|--------|-------------|
| `0` | `pass` | All clear — commit or PR OK |
| `1` | `fail` | Hard failure — fix findings in `nextAction.findingIds` |
| `2` | `needs-review` | Non-blocking — present to human; do NOT auto-fix |
| `4` | `escalate` | **HALT** — stop automated retries, explain to human maintainer |

> Exit code `3` is reserved for internal Bilt errors.

---

## Finding Schema

```ts
interface Finding {
  id?: string;              // content-normalized hash (set at output time)
  ruleId: string;           // e.g. "CHECK-AUTH-001"
  category: string;         // e.g. "authentication"
  mode: "automated" | "guided";
  severity: "critical" | "high" | "medium" | "low" | "info";
  precision: "high" | "medium" | "low";
  maturity: "stable" | "experimental";
  status: "fail" | "needs-review" | "pass";
  lifecycleStatus: "open" | "in-progress" | "verifying" | "resolved" | "suppressed";

  title: string;
  whyItMatters: string;
  technicalDetail: string;

  agentAction: {
    objective: string;          // What to achieve
    allowedChanges: string[];   // What the agent MAY do
    forbiddenChanges: string[]; // What the agent MUST NOT do
    filesToInspect: string[];   // Files to read before acting
    verificationCommand: string; // Run this after changes; Bilt re-detects
  };

  fixable: boolean;
  locations: Array<{
    file: string;
    startLine?: number;
    endLine?: number;
    context?: string;           // function name, route, component name
  }>;

  fingerprint: string;          // content-normalized SHA256 prefix
  introduced_by_change?: boolean;
}
```

### Fingerprint Stability Guarantee

Fingerprints are computed as `SHA256(ruleId + normalizedFilePath + normalizedEvidence)`.

**Line numbers are intentionally excluded.** This means:
- Fingerprints survive refactoring and code movement
- The same bug at a different line = same fingerprint
- Resolution is confirmed by Bilt re-running the detector, not by the agent self-assessing

---

## The Agent Decision Loop

```
bilt check --format agent
        │
        ▼
  read response.status
        │
   ┌────┴──────────────────┐
   │                       │
"pass"                  "fail" / "needs-review"
   │                       │
   ▼                       ▼
 STOP              read response.nextAction.type
 commit/PR                 │
                    ┌──────┴──────────────┐
                    │                     │
                  "fix"               "review"
                    │                     │
                    ▼                     ▼
            act on findingIds      show findings to human
                    │              wait for decision
                    ▼                     │
            run verificationCommand        │
                    │                     │
                    ▼                     ▼
            re-run bilt check      re-run bilt check
            --format agent          --format agent
                    │
                 "escalate"
                    │
                    ▼
           HALT — do NOT retry
           explain to human maintainer
```

---

## Critical Rules for Agents

### ✅ MUST do

1. **Read `nextAction.type` first** — it is the authoritative instruction. Never decide what to do next independently.
2. **Only fix findings in `nextAction.findingIds`** — don't speculatively fix others.
3. **Run `agentAction.verificationCommand` after changes** — never self-assess resolution.
4. **Stop on `escalate`** — halt retries immediately, explain to human.
5. **Focus on `introduced_by_change: true`** — don't rewrite pre-existing debt unless asked.

### ❌ MUST NOT do

1. **Never self-assess** — "I changed the file" ≠ "the problem is fixed". Re-run Bilt.
2. **Never modify `.biltrc.json`** — tamper detector triggers exit code `4`.
3. **Never add `.gitignore` patterns** to bypass Bilt checks.
4. **Never auto-suppress** — `accept-risk` requires explicit human reason and owner.
5. **Never loop** — if Bilt returns `escalate`, stop. No retries.

---

## Supported Commands with `--format agent`

```bash
bilt check --format agent [--changed] [--base <ref>]
bilt scan --format agent [--changed]
bilt design-check --format agent
bilt verify --base <ref> --format agent
bilt doctor --format agent
```

All return the `AgentResponse` schema above.

---

## Remediation Workflow

### Step 1 — Auto-fix (run first)
```bash
npx bilt design-check --fix
npx bilt fix --safe
```

### Step 2 — Baseline pre-existing debt (on first onboarding)
```bash
npx bilt baseline create
```

### Step 3 — Query design intent before any UI changes
```bash
npx bilt design-brief --format agent
```
If `configured: false`, pause and ask the developer the 4 Design Intent questions.

### Step 4 — Investigate guided requirements
```bash
npx bilt explain <category>   # e.g. bilt explain monitoring-rollback
```

### Step 5 — Re-verify
```bash
npx bilt check --format agent
```
Do not declare complete until status is `"pass"` or all remaining issues are accepted with developer approval.

---

## Source

- Protocol builder: [`src/core/agent/protocol.ts`](../src/core/agent/protocol.ts)  
- Finding schema: [`src/core/readiness/finding.ts`](../src/core/readiness/finding.ts)  
- Agent contract tests: [`tests/agent/protocol-contract.test.ts`](../tests/agent/protocol-contract.test.ts)
