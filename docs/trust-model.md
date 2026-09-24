# Bilt Trust & Safety Model

This document outlines the security architecture, threat model, and safety guarantees of Bilt when operating in autonomous agentic coding environments.

---

## 1. Threat Model & Trust Boundaries

### Untrusted Inputs

When an AI agent (Claude Code, Cursor, Codex) works on a repository:

1. **Source Code**: Code modifications produced by the agent may contain prompt injections, ANSI escape sequences, or malicious payloads designed to subvert CI log parsers or subsequent LLM calls.
2. **Secrets & Tokens**: Raw credentials extracted or found in files must never be surfaced back into LLM contexts or CLI logs.
3. **Configuration Tampering**: Agents encountering lint or security failures may attempt to evade checks by modifying `.biltrc`, `.gitignore`, or adding blanket suppressions.

### Defense-in-Depth Measures

- **ANSI & Control Character Stripping**: All terminal escape sequences (`\x1b[...]`) and unprintable control characters are stripped from finding previews.
- **Strict Size Limits**: Untrusted code snippets are truncated to a maximum length (default 200 characters) to prevent denial of context.
- **Universal Secret Redaction**: All detected API keys, passwords, private keys, and high-entropy strings are replaced with `[REDACTED]` prior to formatting agent output.
- **Static Template Ownership**: All finding `explanation` and `agent_action` fields are static, immutable templates owned by Bilt. Zero user-controlled or repo-controlled text is interpolated into instructions.

---

## 2. Suppression Policy & Accountability

Bilt prohibits arbitrary, unexplained suppression of security findings:

### Mandatory Justification

Inline suppressions (e.g., `// bilt-ignore`) and config suppressions must supply an explicit justification:

```typescript
// bilt-ignore RULE-SEC-001 reason="Public test fixture for sandbox unit test" expires=2026-12-31
const apiKey = "SAMPLE_KEY_FOR_TESTING";
```

### Suppression Constraints

1. **Mandatory Reason**: Suppressions without a `reason` (minimum 10 characters) are rejected as invalid.
2. **Expiry Dates**: Suppressions with an expired `expires` date (ISO 8601 YYYY-MM-DD) automatically fail.
3. **Suppression Budget**: Repositories enforce a suppression budget (default max 10 active suppressions). Exceeding this budget triggers a `SUPPRESSION_BUDGET_EXCEEDED` violation to prevent alert fatigue and silent erosion of security posture.

---

## 3. Configuration Tamper Detection

The `bilt verify --base <ref>` command performs deterministic tamper detection by comparing working tree configuration against the target base branch:

### Violations Detected:

- **Rule Deletion or Disabling**: Disabling active rules or removing them from configuration.
- **Severity Downgrading**: Lowering rule severities (e.g. `critical` -> `info`).
- **Threshold Tampering**: Relaxing entropy thresholds to hide secrets.
- **Blanket Ignores**: Introducing wildcard ignore patterns (e.g. `*`, `src/**`, `app/**`) in `.biltignore` or config.

Any detected tampering returns a `tamper` violation that immediately forces `status: "fail"` (exit code 1).

---

## 4. Loop Termination & Iteration Budgeting

Autonomous agents can become trapped in infinite retry loops when unable to resolve a finding.

Bilt prevents runaway executions through deterministic loop tracking in `.bilt/loop-state.json`:

1. **Identical State Escalation**: If consecutive runs return the exact same set of finding fingerprints without progress, Bilt transitions to `status: "escalate"` (exit code 4).
2. **Iteration Budget**: Scans enforce a maximum iteration count (default 5 iterations, configurable via `--max-iterations <N>`). Once exceeded, execution halts with exit code 4.
3. **Escalation Protocol**: Upon receiving exit code 4, agents are instructed to cease modifications immediately and surface the findings to a human engineer.
