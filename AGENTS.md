# AGENTS.md — Instructions for Autonomous Coding Agents

> **Tool**: Bilt Project Health & Security Verification
> **npm Package**: [`bilt-toolkit`](https://www.npmjs.com/package/bilt-toolkit)
> **CLI Binary**: `bilt` (or `npx bilt`)

This repository uses **`bilt-toolkit`** for deterministic security analysis, code hygiene, and pull request verification.

---

## 1. Installation

If `bilt` is not available in the environment:

```bash
# In the project root (adds to package.json devDependencies):
npm install -D bilt-toolkit

# Or globally:
npm install -g bilt-toolkit
```

> **Note**: The package name on npm is **`bilt-toolkit`**. The executable command it provides in your shell or npm scripts is **`bilt`**.

---

## 2. Agent Verification Protocol

Before declaring a task complete, proposing commits, or opening a pull request:

### Step 1: Run Verification
Run Bilt against the target base branch (e.g. `origin/main` or `HEAD~1`):

```bash
npx bilt verify --base origin/main --format agent
```
*(Or `bilt verify ...` if installed globally)*

For uncommitted working tree edits:
```bash
npx bilt scan --format agent --changed
```

### Step 2: Handle the Response Status

| Status | Exit Code | Agent Action |
| :--- | :---: | :--- |
| **`pass`** | `0` | All clear. Zero introduced security violations. Proceed to commit or submit PR. |
| **`fail`** | `1` | Hard security failure. Review the `"findings"` array, locate `"agent_action"`, apply the suggested fix, and re-run verification. |
| **`needs_review`** | `2` | Heuristic / medium-precision finding requiring human judgment. Non-blocking for automated PRs unless team policy specifies otherwise. |
| **`escalate`** | `4` | Runaway loop detected (consecutive attempts yielded identical findings with no progress). **Halt automated retries immediately** and explain the situation to the human maintainer. |

---

## 3. Strict Rules for Coding Agents

1. **Only fix what you introduced (Backend / Infrastructure)**: For security and architectural checks, focus on findings where `"introduced_by_change": true`.
2. **UI Transformation Mandate**: Design quality, UI genericity, accessibility, and UX completeness findings are **NEVER** pre-existing debt that can be ignored or baselined away. When tasked with improving or making a project production-ready, you MUST actively inspect the UI files flagged by Bilt, run `npx bilt design-check --fix`, refactor template tropes into authentic domain UI, and achieve a passing design check.
3. **Never weaken security configs**: Do not modify `.biltrc.json`, tamper with security rules, or add blanket `.gitignore` patterns to bypass checks. Bilt's tamper detector will fail the build with a hard `fail`.
4. **Respect loop escalation**: If Bilt returns exit code `4` (`status: "escalate"`), do not loop or retry. Stop and ask the human maintainer for guidance.

---

## 4. AUTONOMOUS REMEDIATION PROTOCOL (DO NOT MERELY REPORT AND HALT)

**CRITICAL INSTRUCTION FOR CODING AGENTS**:
Do NOT merely print a summary of findings and stop. A result of `NOT READY` or `NEEDS REVIEW` is an active engineering instruction, not a stopping point.
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

## 5. DESIGN QUALITY REQUIREMENT

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

## 6. DESIGN BRIEF & HUMAN-INTENT BOUNDARIES

Bilt uses a Design Brief (`.bilt/design-brief.json`) to capture authentic human design intent before UI implementation.

1. **Explicit Human-in-the-Loop Checkpoint**: The design brief represents authentic human intent. **NEVER** guess, infer from files, or autonomously synthesize fake design choices to create `.bilt/design-brief.json`.
2. **When `.bilt/design-brief.json` is not configured (`configured: false`)**:
   - Query: `npx bilt design-brief --format agent`
   - If the user asked you to use, set up, or follow a design brief: **PAUSE execution immediately** and ask the developer these 4 questions in chat:
     1. **Purpose & Audience**: What is the main purpose of this product, and who is it for?
     2. **Visual Direction**: What visual direction do you prefer? (Minimal, Bold, Technical, Playful, Luxury, Brutalist, 'Surprise me', or Custom)
     3. **Brand Colors**: Do you have specific brand colors or visual references? (Hex codes, color names, or 'Surprise me')
     4. **Desired Feeling**: When someone opens this, what should they feel? (Trustworthy, calm, energetic, technical, or 'Surprise me')
   - After the developer responds, record their authentic answers using:
     ```bash
     npx bilt design-brief set --purpose "..." --visual "..." --colors "..." --feeling "..."
     ```
     *(or write `.bilt/design-brief.json` directly)*.
   - If the user did NOT request a design brief: design creativity remains agent-controlled. Proceed using your best judgment while verifying with `npx bilt design-check`.
3. **When `.bilt/design-brief.json` is configured (`configured: true`)**:
   - Query: `npx bilt design-brief --format agent` to read the developer's authentic constraints.
   - Respect creative freedom where fields are marked "Surprise me" (`creative-freedom`).
   - Run `npx bilt design-check` after UI changes.

