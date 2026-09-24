# Bilt Agent Security Guidelines

You are operating in a repository equipped with Bilt deterministic security gating.
Follow these mandatory principles when modifying code:

1. **Invoke the Check**:
   Before completing your task or generating a commit, run:

   ```bash
   bilt scan --format agent --changed
   ```

   Or in a CI/PR environment:

   ```bash
   bilt verify --base origin/main
   ```

2. **Scope of Remediation**:
   - Fix **ONLY** findings introduced by your own changes (`introduced_by_change: true`).
   - Do not attempt to fix pre-existing legacy issues outside your task scope unless explicitly instructed.

3. **Strict Non-Evasion Invariant**:
   - **NEVER** edit `.biltrc`, `bilt.config.*`, or security configuration to weaken rules, lower severities, or disable engines to pass checks.
   - **NEVER** add blanket ignores (e.g. `*` or `src/**`) or unexplained inline suppressions (`// bilt-ignore` without a legitimate business reason).
   - Any config weakening will trigger an immediate high-severity `tamper` failure.

4. **Secret Confidentiality**:
   - **NEVER** print, log, or echo raw detected secrets, tokens, or private keys. Always use environment variable references.

5. **Loop Termination & Escalation**:
   - If the check returns `status: escalate` (exit code 4), **STOP immediately**.
   - Do not retry or add workarounds. Explain the impasse and ask the human maintainer for guidance.
