# Bilt Agent Security Guidelines

> **Installation**: `npm install -D bilt-toolkit`
> **Command**: `npx bilt` (or `bilt` if globally installed)

You are operating in a repository equipped with Bilt deterministic engineering supervision.
Bilt is an active verification layer inside your development loop. Treat Bilt's structured machine-readable output as authoritative project feedback.

Follow these 10 mandatory operating principles:

1. **Use Bilt during implementation**: Run Bilt checks incrementally while developing:
   ```bash
   npx bilt check --changed --format agent
   ```
   Or against target branch / PR base:
   ```bash
   npx bilt check --base origin/main --format agent
   # or: npx bilt scan --format agent --changed
   ```

2. **Verify before considering task complete**: Never declare your task complete without running Bilt checks.

3. **Treat structured output as authoritative**:
   - Inspect `status` and `allowedToContinue`. If `allowedToContinue` is `false`, you are NOT done.
   - Read `nextAction`: follow `nextAction.type` and `nextAction.instruction`.

4. **Fix blocking/high findings**: Address all findings referenced in `nextAction.findingIds`.

5. **Follow exact remediation constraints**: Follow `objective`, `allowedChanges`, and `forbiddenChanges` on each finding.

6. **Strict non-evasion invariant**:
   - NEVER edit `.biltrc`, `bilt.config.*`, or security configuration to weaken rules, lower severities, or disable engines to pass checks.
   - NEVER add blanket ignores (e.g. `*` or `src/**`) or unexplained inline suppressions (`// bilt-ignore`). Tampering triggers immediate escalation.
   - NEVER print or echo raw secret values. Always use environment variable references.

7. **Re-run Bilt after changes**: Execute each finding's `verification` command (or `npx bilt check --format agent`) after editing code. Only Bilt verifies resolution.

8. **Watch for regressions**: Inspect `session.regressions`. If a previously resolved finding re-appears, prioritize fixing it immediately.

9. **Stop when Bilt reports escalate**: If Bilt returns `status: "escalate"` (exit code 4), STOP immediately. Explain the impasse to the human developer. Do not retry random edits.

10. **Ask the developer when human decision is needed**: When `status` is `needs-review` or `nextAction.type` is `review`, present the findings to the developer and wait for guidance. For missing Design Brief or UI/Design work, this is **STRICTLY BLOCKING**: you MUST pause mid-session and ask the developer before touching UI. NEVER defer questions to an end-of-session summary.

---

## AUTONOMOUS REMEDIATION PROTOCOL (DO NOT MERELY REPORT AND HALT)

CRITICAL INSTRUCTION FOR CODING AGENTS:
Do NOT merely print a summary of findings and stop. A result of NOT READY or NEEDS REVIEW is a call to action.
When Bilt reports findings, you MUST execute the following remediation loop:

1. **Auto-Fix Immediate Issues**:
   Before manual changes, immediately run:
   ```bash
   npx bilt design-check --fix
   npx bilt fix --safe
   ```
   This automatically repairs focus rings (`outline-none`), missing `aria-label`, missing `alt` attributes, gradient text on headings, radial blur orbs, extreme radii, and `.env` drift.

2. **Handle Pre-Existing Codebase Debt (Baselining)**:
   - For backend architectural debt (database backup strategy, external Sentry monitoring, PII policies):
     ```bash
     npx bilt baseline create
     ```
     This captures pre-existing infrastructure debt into `.bilt/baseline.json`.
   - **CRITICAL UI WARNING**: **DO NOT USE BASELINE TO SILENCE UI OR DESIGN DEFECTS**. UI genericity and design flaws MUST be actively refactored into authentic, domain-specific UI with real data density.

3. **Follow the Design Brief for UI Changes**:
   If design quality issues are flagged (`design-genericity`, uniform card grids, typography):
   - Check `npx bilt design-brief --format agent`.
   - If `configured: false`, PAUSE and ask the developer the 4 Design Intent questions.
   - Refactor repetitive generic AI tropes into intentional, distinctive UI.
   - Run `npx bilt design-check` until clean.

4. **Investigate Guided Requirements**:
   For architectural findings (authorization, error monitoring, database recovery):
   - Run `npx bilt explain <category>` (e.g. `npx bilt explain monitoring-rollback`) for implementation guides and code snippets.
   - Implement the required pattern, or if the user intentionally defers it, guide the user to run `npx bilt accept-risk <ruleId> --reason "..." --owner "..."`.

5. **Re-Verify Before Declaring Completion**:
   Always re-run:
   ```bash
   npx bilt check --format agent
   ```
   Do not declare the task complete until the status reaches `production-ready` (exit code 0) or all remaining issues have been addressed with the user.

---

## DESIGN QUALITY REQUIREMENT

Do not default to recognizable AI-generated website patterns.

Before implementing UI:
1. inspect the existing product
2. identify the product's actual domain and users
3. use real product behavior/data as visual inspiration
4. avoid stacking generic SaaS patterns
5. avoid decorative elements without purpose
6. make loading, empty, error, success, and disabled states intentional
7. preserve accessibility
8. run `bilt design-check`
9. address design findings
10. rerun Bilt before declaring the task complete

Do not remove or weaken Bilt rules simply to obtain a passing result.

---

## DESIGN BRIEF & MANDATORY HUMAN-INTENT CHECKPOINT

Bilt uses a Design Brief (`.bilt/design-brief.json`) to capture authentic human design intent before UI implementation.

1. **Explicit Human-in-the-Loop Checkpoint**: The design brief represents authentic human intent. **NEVER** guess, infer from files, or autonomously synthesize fake design choices to create `.bilt/design-brief.json`.
2. **MANDATORY PRE-IMPLEMENTATION GATE (BEFORE WRITING ANY UI)**:
   - **CRITICAL TIMING**: NEVER write or scaffold UI code before obtaining design intent. Do NOT design the UI first and report questions at the end of the session.
   - Query: `npx bilt design-brief --format agent`
   - Whenever a task involves creating, modifying, or refactoring UI, or when design quality findings are detected:
     **YOU MUST PAUSE EXECUTION IMMEDIATELY MID-SESSION AND ASK THE DEVELOPER THESE 4 DESIGN INTENT QUESTIONS IN CHAT**:
     1. **Purpose & Audience**: What is the main purpose of this product, and who is it for?
     2. **Visual Direction**: What visual direction do you prefer? (Minimal, Bold, Technical, Playful, Luxury, Brutalist, 'Surprise me', or Custom)
     3. **Brand Colors**: Do you have specific brand colors or visual references? (Hex codes, color names, or 'Surprise me')
     4. **Desired Feeling**: When someone opens this, what should they feel? (Trustworthy, calm, energetic, technical, or 'Surprise me')
   - **DO NOT SKIP THIS INTERVIEW**. You cannot produce authentic domain UI without knowing the actual domain, user persona, and aesthetic goals. Never guess or fabricate answers.
   - After the developer responds, record their authentic answers using:
     ```bash
     npx bilt design-brief set --purpose "..." --visual "..." --colors "..." --feeling "..."
     ```
     *(or write `.bilt/design-brief.json` directly)*.
3. **When `.bilt/design-brief.json` is configured (`configured: true`)**:
   - Query: `npx bilt design-brief --format agent` to read the developer's authentic constraints.
   - Use their answers as the active context to design authentic UI.
   - Respect creative freedom where fields are marked "Surprise me" (`creative-freedom`).
   - Refactor generic AI templates into authentic domain UI matching the brief.
   - Run `npx bilt design-check` after UI changes.
4. **DO NOT DEFER QUESTIONS TO THE END OF THE SESSION**:
   - A critical failure mode of AI coding agents is implementing generic UI first, and then dumping the 4 questions in an end-of-session 'Needs Review' summary.
   - This defeats the entire purpose of the Design Brief. You must ask the questions BEFORE creating or altering UI files so you have the necessary context to design the UI.

