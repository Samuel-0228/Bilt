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
| **`needs_review`** | `2` | **Requires Human Input**. For UI/Design or missing Design Brief, this is **STRICTLY BLOCKING**: you MUST pause mid-session and ask the developer in chat before touching or completing UI. NEVER defer to an end-of-session summary. |
| **`escalate`** | `4` | Runaway loop detected (consecutive attempts yielded identical findings with no progress). **Halt automated retries immediately** and explain the situation to the human maintainer. |

---

## 2A. Mandatory Pre-Implementation Gate for UI / Frontend Work

**CRITICAL TIMING RULE**: Coding agents must **NEVER** write, scaffold, or generate UI code before obtaining the human developer's design intent. Do NOT design the UI first and report questions at the end of the session.

Whenever a task involves creating, modifying, or refactoring UI components, pages, views, layouts, or styling:

1. **Check Design Brief FIRST (before touching any UI files)**:
   ```bash
   npx bilt design-brief --format agent
   ```
2. **If unconfigured (`configured: false`)**:
   - **DO NOT WRITE A SINGLE LINE OF UI CODE.**
   - **PAUSE EXECUTION IMMEDIATELY MID-SESSION.**
   - Prompt the developer in chat with the 4 Design Intent questions:
     1. **Purpose & Audience**: What is the main purpose of this product, and who is it for?
     2. **Visual Direction**: What visual direction do you prefer? (Minimal, Bold, Technical, Playful, Luxury, Brutalist, 'Surprise me', or Custom)
     3. **Brand Colors**: Do you have specific brand colors or visual references? (Hex codes, color names, or 'Surprise me')
     4. **Desired Feeling**: When someone opens this, what should they feel? (Trustworthy, calm, energetic, technical, or 'Surprise me')
   - **Wait for the developer's response.**
   - Save their answers:
     ```bash
     npx bilt design-brief set --purpose "..." --visual "..." --colors "..." --feeling "..."
     ```
3. **Use the context to design authentic UI**:
   - Only AFTER the brief is saved, proceed to implement the UI using the developer's authentic constraints or creative freedom choice.
   - Do NOT treat design intent questions as an end-of-session summary. They are a **pre-condition** for designing the UI.

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

## 6. DESIGN BRIEF & MANDATORY HUMAN-INTENT CHECKPOINT

Bilt uses a Design Brief (`.bilt/design-brief.json`) to capture authentic human design intent before UI implementation.

1. **Explicit Human-in-the-Loop Checkpoint**: The design brief represents authentic human intent. **NEVER** guess, infer from files, or autonomously synthesize fake design choices to create `.bilt/design-brief.json`.
2. **MANDATORY CHECKPOINT WHEN UNCONFIGURED (`configured: false`)**:
   - Query: `npx bilt design-brief --format agent`
   - Whenever design quality findings are detected, UI refactoring is needed, or preparing a website for production:
     **YOU MUST PAUSE EXECUTION IMMEDIATELY AND ASK THE DEVELOPER THESE 4 DESIGN INTENT QUESTIONS IN CHAT**:
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
   - Respect creative freedom where fields are marked "Surprise me" (`creative-freedom`).
   - Refactor generic AI templates into authentic domain UI matching the brief.
   - Run `npx bilt design-check` after UI changes.
4. **DO NOT DEFER QUESTIONS TO THE END OF THE SESSION**:
   - A critical failure mode of AI coding agents is implementing generic UI first, and then dumping the 4 questions in an end-of-session 'Needs Review' summary.
   - This defeats the entire purpose of the Design Brief. You must ask the questions BEFORE creating or altering UI files so you have the necessary context to design the UI.

