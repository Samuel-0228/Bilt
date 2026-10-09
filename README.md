# Bilt

[![npm version](https://img.shields.io/badge/npm-v1.1.5-blue.svg)](https://www.npmjs.com/package/bilt-toolkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/Samuel-0228/bilt)
[![Coverage Status](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/Samuel-0228/bilt)

> **Bilt is the production-readiness gate for software built with AI coding agents.**
> 
> AI coding agents (Claude, ChatGPT, Cursor, Codex) can build web applications quickly, but vibecoders and autonomous agents often miss critical security, authentication, and architectural guardrails before shipping.
> Bilt automatically verifies what can be verified deterministically, guides AI agents through what requires professional review, and enforces an honest production-readiness gate before exposing code to real users.

---

```
   ____    _   _       _____
  |  _ \  | | | |     |_   _|
  | |_) | | | | |       | |
  |  _ <  | | | |___    | |
  | |_) | |_| |_____|   |_|
  |____/
```

Bilt is an automated readiness check, not a certified security audit. A "production-ready" result means known common gaps were checked and not found; it does not guarantee the absence of vulnerabilities. Bilt helps identify common security and production-readiness gaps and guides deeper review where automated verification is not possible.

---

## The Production Readiness Command

Run Bilt's pre-production readiness gate:

```bash
# Human-readable production gate report
bilt check

# Agent-native JSON format for coding assistants (Claude Code, Cursor, Codex, CI)
bilt check --format agent

# Scoped to uncommitted changes
bilt check --format agent --changed

# Learn concepts and inspection procedures
bilt explain authorization
bilt explain api-abuse-and-cost
```

### Production Readiness Taxonomy

Bilt classifies production readiness across 14 deterministic and guided categories:

| Category | Mode | Enforcement | Description |
| :--- | :---: | :---: | :--- |
| **`secrets-and-env`** | Automated | **ENFORCED** | Hardcoded API keys, database credentials, committed `.env`, client secret leakage. |
| **`auth`** | Automated | **ENFORCED** | Plaintext passwords, JWT verification, missing expiration, insecure cookies, auth stubs. |
| **`authorization`** | Guided | **GUIDED** | ID-based resource ownership, tenant isolation, role checks, admin privileges. |
| **`input-validation`** | Automated | **ENFORCED** | SQL/Command injection, path traversal, unsafe HTML rendering, mutating schema validation. |
| **`api-abuse-and-cost`** | Guided | **GUIDED** | Unauthenticated expensive AI calls, rate limiting, request size limits, proxy abuse. |
| **`database`** | Mixed | **PARTIAL** | Database credentials, client-db boundaries, SSL transport, backup & PITR strategy. |
| **`dependencies`** | Automated | **PARTIAL** | Lockfile presence, package manager consistency, supply-chain checks. |
| **`error-handling-logs`** | Automated | **PARTIAL** | Stack trace leakage in HTTP responses, credential/token logging. |
| **`transport-and-headers`** | Automated | **PARTIAL** | Wildcard CORS with credentials, HTTP security headers (Helmet). |
| **`deploy-config`** | Automated | **PARTIAL** | Production debug flags (`NODE_ENV=development`), browser source-map exposure. |
| **`file-uploads`** | Guided | **COMING SOON** | MIME allowlists, file size limits, storage isolation. |
| **`payments`** | Guided | **COMING SOON** | Webhook signature verification, server-side validation, zero raw card handling. |
| **`privacy-and-pii`** | Guided | **COMING SOON** | PII data encryption at rest, retention, and deletion flows. |
| **`monitoring-rollback`** | Guided | **COMING SOON** | Error reporting SDK (Sentry), observability, rollback procedures. |

> [!IMPORTANT]
> **Stack Scoping (Section 4B):**
> Bilt v1 fully enforces automated checks for: **Express, Fastify, Next.js (App & Pages Router), Nuxt, SvelteKit, FastAPI, Django REST Framework, and Rails**.
> Guided checks are language-agnostic since they instruct a human/agent procedure, but their completeness verification requires a route extractor for the detected stack. For any detected stack without a route extractor or without automated rule support, `bilt check` reports `UNSUPPORTED STACK — guided review required, route completeness cannot be verified`.

### Risk Acceptance vs. Suppression (Section 8B)

Suppression (`// bilt-ignore`) means *"this finding is incorrect (false positive)"*.
Risk acceptance (`bilt accept-risk`) means *"this finding is correct and we are deliberately accepting the operational risk to ship"*.

```bash
bilt accept-risk RULE-ID --reason "Legacy endpoint to be retired in Q4" --owner "BackendTeam" [--expires 2026-12-31]
```

* **Mandatory Category Invariant**: The 6 core categories (`secrets-and-env`, `auth`, `authorization`, `input-validation`, `api-abuse-and-cost`, `database`) **CANNOT** bypass the production gate via risk acceptance. They must be resolved or suppressed with an explicit false-positive justification.
* Accepted risks remain visible in every report under the `ACCEPTED RISK` section.

---

## Table of Contents

- [Quick Start](#quick-start)
  - [Installation](#installation)
  - [First Steps](#first-steps)
- [Health Report Visualizer](#health-report-visualizer)
- [CLI Command Reference](#cli-command-reference)
- [Core Command Breakdown](#core-command-breakdown)
- [Recommended Workflows](#recommended-workflows)
- [End-to-End Testing & QA Guide](#end-to-end-testing--qa-guide)
  - [1. Local Build & Link Setup](#1-local-build--link-setup)
  - [2. Creating a Disposable Test Blueprint](#2-creating-a-disposable-test-blueprint)
  - [3. Command Verification Matrix](#3-command-verification-matrix)
  - [4. Final CLI Smoke Test Sequence](#4-final-cli-smoke-test-sequence)
  - [5. Pre-Release npm Package Packaging Pipeline](#5-pre-release-npm-package-packaging-pipeline)
- [Core Features & Safety Net](#core-features--safety-net)
- [Agent-Native Security & Verification](#agent-native-security--verification)
  - [Claude Code & Cursor Integration](#claude-code--cursor-integration)
  - [Model Context Protocol (MCP) Server](#model-context-protocol-mcp-server)
  - [Exit Codes & Deterministic Status Model](#exit-codes--deterministic-status-model)
- [Configuration (`.biltrc.json`)](#configuration-biltrcjson)
- [Plugin System](#plugin-system)
- [License](#license)

---

## Quick Start

### Installation

Install **`bilt-toolkit`** from npm using your preferred package manager:

```bash
# Option 1: Install as a project devDependency (Recommended for teams, CI & AI agents)
npm install -D bilt-toolkit

# Option 2: Install globally to run the 'bilt' command anywhere
npm install -g bilt-toolkit

# Option 3: Install from GitHub Packages
# (Requires @samuel-0228:registry=https://npm.pkg.github.com in .npmrc)
npm install -D @samuel-0228/bilt-toolkit
```

> [!IMPORTANT]
> **Package Name vs. CLI Binary Command:**
> - On npm, the package is **`bilt-toolkit`** (`npm i bilt-toolkit`).
> - On GitHub Packages, the package is scoped as **`@samuel-0228/bilt-toolkit`**.
> - Regardless of registry, the executable binary in your terminal is **`bilt`** (or **`npx bilt`**).

### First Steps

After installing `bilt-toolkit`, use the **`bilt`** command to run checks:

```bash
# 1. Initialize Bilt guardrails, templates & .gitignore protection
bilt init
# (or if installed locally: npx bilt init)

# 2. Run a full security and health scan
bilt scan

# 3. For coding agents / CI: verify changes introduced against base branch
bilt verify --base origin/main --format agent
```

Running `bilt init` executes an automated health scan, constructs `.gitignore` protection rules, scaffolds required environment variable templates, and displays a summary health report.

---

## Health Report Visualizer

When executing health checks or initialization, Bilt outputs an intuitive diagnostic card:

```
+--------------------------------------------------+
|                                                  |
|   BILT HEALTH REPORT                             |
|                                                  |
|   Score: 92/100              Grade: A            |
|   ======================...  92%                 |
|                                                  |
|   [PASS] Secrets: Clean                          |
|   [WARN] Env vars: 2 missing in .env             |
|   [PASS] .gitignore: OK                          |
|   [PASS] Framework: Next.js detected             |
|                                                  |
+--------------------------------------------------+
```

---

## CLI Command Reference

Bilt commands are organized into distinct functional layers:

### 1. Verification & Production Readiness
| Command | Description | Key Options |
| :--- | :--- | :--- |
| `bilt check [dir]` | Comprehensive pre-production readiness verification. Categorizes findings across security, architecture, and design. | `--format <human\|agent\|json>`, `--changed`, `--base <ref>`, `--categories <list>` |
| `bilt verify [dir]` | Git diff-scoped CI/PR verification with tamper detection and iteration budgeting for agents. | `--base <ref>`, `--format <agent\|sarif\|text>`, `--max-iterations <N>` |
| `bilt scan [dir]` | Audits working tree and Git history for leaked secrets, framework misconfigurations, and environment divergence. | `--changed`, `--base <ref>`, `--format <agent\|sarif\|json\|text>`, `--full-history`, `--json` |
| `bilt api-scan [dir]` | Static API security checks, inspecting endpoint safety, method allowlists, and header hygiene. | `--json`, `--verbose`, `--dry-run` |

### 2. Autonomous Remediation & Debt Management
| Command | Description | Key Options |
| :--- | :--- | :--- |
| `bilt fix [dir]` | Safely remediates flagged findings. Supports interactive mode, safe autopilot mode, or preview dry-runs. | `--safe`, `--dry-run`, `--verbose`, `--quiet` |
| `bilt undo [dir]` | Instant snapshot rollback: reverts the latest changes made by `bilt fix`. | `--list` |
| `bilt baseline create [dir]` | Captures pre-existing repository debt into `.bilt/baseline.json` so agents focus solely on new diffs. | `--json` |
| `bilt accept-risk <id>` | Explicitly accepts operational risk for a specific finding with a documented rationale and owner. | `--reason "<explanation>"`, `--owner "<team>"`, `--expires <date>` |

### 3. Design Quality & Direction
| Command | Description | Key Options |
| :--- | :--- | :--- |
| `bilt design-check [dir]` | Detects generic AI/template website patterns and checks accessibility/UX states. Includes `--fix` safe repair. | `--format <human\|agent\|json>`, `--fix`, `--changed`, `--base <ref>` |
| `bilt design-brief [dir]` | Captures authentic human design intent (purpose, visual direction, colors, feeling) to guide AI coding agents. | `show`, `edit`, `set`, `--format <human\|agent>`, `--non-interactive` |
| `bilt explain <topic>` | Interactive guidance, architectural patterns, and code snippets for flagged categories or rules. | `<category\|ruleId>` |

### 4. AI Agent Supervision & Control Plane
| Command | Description | Key Options |
| :--- | :--- | :--- |
| `bilt loop <subcommand> [dir]` | Manages agent supervision loop state and prevents infinite looping/thrashing (`reset`, `status`). | `reset`, `status`, `--json` |
| `bilt prompt` | Outputs modular system prompt security guidelines for coding agents (Claude Code, Cursor, Codex). | `--agent <claude\|cursor\|default>` |
| `bilt mcp` | Starts the Model Context Protocol (MCP) stdio server for native AI tool calling in agent IDEs. | None |

### 5. Continuous Monitoring & Diagnostics
| Command | Description | Key Options |
| :--- | :--- | :--- |
| `bilt watch [dir]` *(alias: `live`)* | Background daemon monitoring file events in real time on save. | `--quiet`, `--debounce <ms>`, `--poll` |
| `bilt doctor [dir]` | Comprehensive repository health analysis with severity grading and shareable health card. | `--card`, `--owasp`, `--debug` |
| `bilt report [dir]` | Exports project health and security findings to Markdown or JSON for CI/CD artifacts. | `--format <markdown\|json>`, `--output <path>` |

### 6. Setup, Extensions & AI Assistant
| Command | Description | Key Options |
| :--- | :--- | :--- |
| `bilt init [dir]` | Zero-friction onboarding: scans repo, applies safe `.gitignore` and `.env.example`, and configures `AGENTS.md`. | `--agent [name]`, `--dry-run`, `--force` |
| `bilt plugin <action>` | Manages custom scanning rules and extension plugins (`list`, `create`, `install`). | `--dir <path>` |
| `bilt welcome` *(alias: `onboarding`)* | Interactive terminal onboarding wizard introducing Bilt concepts. | None |
| `bilt ai <subcommand>` | Manages optional local/cloud AI provider keys and audits redaction (`setup`, `status`, `switch`, `model`). | `setup`, `status`, `switch`, `model`, `provider`, `remove`, `test` |
| `bilt ask <question>` | Queries contextual AI assistant about scan findings with automatic secret redaction. | `--debug` |

---

## Core Command Breakdown

### `scan` — Static Security & Environment Audit

Scans source files, config files, and git commit history for hardcoded tokens, secret keys, entropy spikes, and environment variable divergence.

```bash
# Basic project scan
bilt scan

# Explicit target directory
bilt scan ./src

# Detailed JSON output for tooling
bilt scan --json
```

### `api-scan` — Dedicated API Security Diagnostics

Analyzes REST/GraphQL endpoints, API route handlers, authentication header checks, and client-exposed public keys.

```bash
bilt api-scan
```

### `fix` — Non-Destructive Remediation

Applies fixes interactively or in safe mode. Always previews changes using `--dry-run` first to review prospective edits without mutating disk files.

```bash
# Preview changes safely without file modifications
bilt fix --dry-run

# Interactive guided fix mode
bilt fix

# Non-interactive safe mode (applies only low-risk edits)
bilt fix --safe
```

### `undo` — Instant Rollback & Snapshot Recovery

Reverts modifications performed by `bilt fix` using stored local snapshots.

```bash
# Revert most recent fix operation
bilt undo

# Inspect past snapshot history
bilt undo --list
```

### `baseline` — Legacy Debt Isolation

Snapshots existing repository debt into `.bilt/baseline.json` so developers and AI coding agents focus strictly on introduced diffs (`introduced_by_change: true`).

```bash
# Capture current findings as a baseline
bilt baseline create

# Output JSON result
bilt baseline create --json
```

### `design-check` — Anti-Vibecoding & Production UX Detection

> **Bilt can detect when an interface is heavily dependent on recognizable AI-generated design patterns.**

The goal is **NOT** to decide whether a website is beautiful.
Bilt does not enforce one visual style (such as brutalism, minimalism, or maximalism).
Instead, Bilt detects measurable combinations of template tropes and AI-generated design formulas that make websites look interchangeable, then provides coding agents with concrete instructions to make interfaces intentional, product-specific, and distinctive.

#### CLI Usage

```bash
# Run human-readable design check
bilt design-check

# Run against a specific directory
bilt design-check ./frontend

# Agent JSON mode with stable versioned schema
bilt design-check --format agent

# Scoped to uncommitted git changes
bilt design-check --changed

# Apply deterministic safe automated fixes (accessibility labels, focus outlines, placeholder cleanup)
bilt design-check --fix

# Learn how design genericity is evaluated
bilt explain design
bilt explain design-genericity
```

#### Categories & Example Rules

| Category | Rule ID | Severity | Description |
| :--- | :--- | :---: | :--- |
| **`design-genericity`** | `GENERIC-SAAS-COMBINATION-001` | **HIGH** | Stacking rounded cards, gradients, radial orbs, sparkle icons, and generic copy formulas. |
| **`design-genericity`** | `VIBECODED-LANDING-PAGE-001` | **MEDIUM** | Formulaic landing page: Eyebrow → Giant Heading → 2 CTA Buttons → 3 Cards → Fake Testimonial. |
| **`design-genericity`** | `DESIGN-VISUAL-001` | **MEDIUM** | Excessive gradient text headings and multi-gradient buttons. |
| **`design-genericity`** | `DESIGN-VISUAL-002` | **LOW** | Default purple-on-black SaaS aesthetic. |
| **`design-genericity`** | `DESIGN-VISUAL-005` | **MEDIUM** | Decorative sparkle/wand icons on non-AI features. |
| **`content-quality`** | `CONTENT-QUALITY-001` | **MEDIUM** | Generic marketing slogans ("Supercharge your workflow", "The future of..."). |
| **`content-quality`** | `CONTENT-QUALITY-003` | **MEDIUM** | Unverified placeholder customer testimonials ("CEO at TechCorp"). |
| **`accessibility`** | `A11Y-UI-001` | **HIGH** | Icon-only button missing accessible name (`aria-label`). *(Auto-fixable)* |
| **`accessibility`** | `A11Y-UI-002` | **MEDIUM** | Outline suppressed (`outline-none`) without `focus-visible:` ring. *(Auto-fixable)* |
| **`accessibility`** | `A11Y-UI-003` | **MEDIUM** | Image missing `alt` attribute. *(Auto-fixable)* |
| **`production-ux`** | `UX-STATE-001` | **MEDIUM** | Application views missing loading or skeleton states. |
| **`production-ux`** | `UX-STATE-003` | **MEDIUM** | Desktop navigation bar missing mobile drawer/menu. |
| **`production-ux`** | `UX-STATE-004` | **HIGH** | Permanent delete actions without confirmation dialog. |

#### Intentional Exceptions & Baselines

Projects intentionally choosing specific aesthetics (e.g. purple theme, Geist font, or minimal cards) can document exceptions in `.biltrc.json`. **Every exception requires an explicit documented reason**:

```json
{
  "designCheck": {
    "ignore": [
      "DESIGN-VISUAL-002"
    ],
    "reason": {
      "DESIGN-VISUAL-002": "Product brand guidelines intentionally designate violet as primary accent."
    }
  }
}
```

* Suppressions without a documented reason are rejected.
* Blanket suppression (`ignoreAll: true` or `ignore: ["*"]`) is prohibited.
* Suppressed findings remain visible in reports under *Intentional Exceptions*.

#### Agent Loop Protection

If an autonomous coding agent makes repeated changes across consecutive iterations without resolving design findings, Bilt detects the impasse, halts automated loops with `status: "escalate"` (exit code 4), and instructs the agent to ask the human maintainer for guidance.

---

### `design-brief` — Developer Design Direction & Intent

> **Allow developers to provide concise, intentional design direction before AI agents build or redesign user interfaces.**

The Design Brief prevents generic, cookie-cutter interfaces by capturing 3–4 high-level design preferences and making them accessible to agents via deterministic JSON and prompt injection.

- **Non-blocking & advisory**: Brief-consistency checks are always advisory and never block security gates.
- **Creative freedom**: Selecting *"Surprise me"* explicitly grants the agent full creative latitude and generates zero constraints.
- **Fail-soft**: Missing briefs simply leave creative freedom in agent control with zero false-positive warnings.

#### CLI Usage

```bash
# Run interactive 4-question questionnaire
bilt design-brief

# Inspect existing brief in human-readable format
bilt design-brief show

# Update an existing brief
bilt design-brief edit

# Output stable JSON for autonomous agents
bilt design-brief --format agent

# Non-interactive check (does not prompt or invent answers)
bilt design-brief --non-interactive
```

---

### `loop` — Agent Supervision & Loop State

Inspects or resets the runaway agent loop supervisor and iteration counter.

```bash
# Inspect current iteration count, history, and escalation status
bilt loop status

# Machine-readable JSON output
bilt loop status --json

# Reset runaway loop counter
bilt loop reset
```

---

### `watch` / `live` — Real-Time Background Daemon

Monitors file creation, edits, and deletions in real time. Notifies developers immediately when a secret token or environment drift is detected on save.

```bash
# Start watcher daemon
bilt watch

# Use alias
bilt live
```

### `doctor` — Broad Health & Score Diagnostics

Evaluates codebase maturity, secret leaks, missing `.env.example` definitions, and framework-specific security pitfalls.

```bash
# Holistic health report
bilt doctor

# Generate markdown health card
bilt doctor --card
```

### `report` — CI/CD Export & Documentation Generator

Exports structured security findings into Markdown or JSON reports.

```bash
# Standard report export
bilt report

# Explicit Markdown export
bilt report --format markdown

# JSON format export
bilt report --format json
```

### `init` — Automated Project Onboarding

Sets up recommended security defaults, ignores, and health baselines for new or unconfigured repositories.

```bash
# Initialize Bilt guardrails, .gitignore, and .env.example
bilt init

# Configure agent guidelines for specific assistants (Claude, Cursor, default)
bilt init --agent claude
```

### `plugin` — Custom Rule Extensions

List available plugins or scaffold custom security rules for project-specific protocols.

```bash
# List installed plugins
bilt plugin list

# Create new custom plugin template
bilt plugin create custom-security-rule
```

### `welcome` / `onboarding` — Interactive Assistant

Guided terminal interface for new developers joining a codebase.

```bash
bilt welcome
```

### `ai` & `ask` — Contextual AI Assistance

Inspect findings and request step-by-step remediation advice without exposing raw credentials.

```bash
# Configure AI provider
bilt ai setup

# Query AI on current scan findings
bilt ask "What is the highest severity vulnerability in this codebase?"
```

---

## Recommended Workflows

### Standard Developer Workflow

```bash
# 1. Inspect repository health state
bilt scan

# 2. Review diagnostic score & details
bilt doctor

# 3. Preview recommended fixes safely
bilt fix --dry-run

# 4. Apply non-destructive fixes
bilt fix --safe

# 5. Rollback anytime if needed
bilt undo

# 6. Keep active watcher running during feature development
bilt watch
```

---

## End-to-End Testing & QA Guide

This section outlines a rigorous quality assurance methodology for testing Bilt commands locally, validating edge cases, and verifying npm release builds prior to distribution.

### 1. Local Build & Link Setup

Validate compilation and register the local CLI binary into your global environment:

```bash
# Navigate to Bilt CLI repository root
npm install
npm run build
npm link

# Verify global CLI registration
bilt --version
bilt --help
```

_Verification Goal:_ Ensure all subcommands and flags are correctly listed in `--help`.

---

### 2. Creating a Disposable Test Blueprint

To thoroughly test security scanning and remediation without affecting real codebases, build a disposable, deliberately vulnerable test project:

```bash
mkdir bilt-test-project
cd bilt-test-project
git init

# 1. Create .env with sensitive test credentials
cat > .env <<'EOF'
DATABASE_URL=postgresql://admin:password123@localhost:5432/mydb
SUPABASE_SERVICE_ROLE_KEY=super-secret-service-role-key
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
NEXT_PUBLIC_API_URL=http://localhost:3000
EOF

# 2. Create .env.example with intentional variable mismatches
cat > .env.example <<'EOF'
DATABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_API_URL=
MISSING_VARIABLE=
EOF

# 3. Create code file containing hardcoded secret strings
cat > app.js <<'EOF'
const password = "super-secret-password";
const apiKey = "sk_test_example_secret_key";
console.log(password);
EOF

# 4. Create package.json
cat > package.json <<'EOF'
{
  "name": "bilt-test-project",
  "version": "1.0.0",
  "scripts": {
    "dev": "node app.js"
  }
}
EOF

# 5. Commit initial baseline state to Git
git add .
git commit -m "initial test project baseline"
```

---

### 3. Command Verification Matrix

Execute each test phase below in the disposable environment to verify expected behaviors:

#### A. `scan` Audit Verification

- Command: `bilt scan` and `bilt scan .`
- **Verify:**
  - Hardcoded secret keys in `app.js` are identified (`sk_test_...`).
  - Mismatched variables between `.env` and `.env.example` are logged.
  - File system remains unmodified (`git status` shows clean working tree).

#### B. `api-scan` Verification

- Command: `bilt api-scan .`
- **Verify:** API checks run dedicated validation logic distinct from basic pattern scanning and handle API key exposures cleanly.

#### C. `init` Onboarding Verification

- Command:
  ```bash
  mkdir ../bilt-init-test && cd ../bilt-init-test && git init
  echo 'API_KEY=super-secret-test-key' > .env
  echo 'API_KEY=' > .env.example
  bilt init
  ```
- **Verify:**
  - Safe guardrails (such as `.gitignore` entries) are added.
  - Snapshot is recorded.
  - `git status` and `git diff` reveal safe, expected modifications.

#### D. `fix` & `--dry-run` Verification

- Command:
  ```bash
  cd ../bilt-test-project
  bilt fix --dry-run
  ```
- **Verify:** Output previews intended changes, but `git status` confirms **zero disk changes**.
- Command: `bilt fix` (interactive) and `bilt fix --safe` (autopilot).
- **Verify:** Safe fixes are applied, snapshot is created in `.bilt/snapshots/`.

#### E. `undo` Snapshot Rollback Verification

- Command: `bilt undo` immediately after `bilt fix`.
- **Verify:** `git status` and `git diff` confirm repository returned to exact state prior to fix.
- Command: Run `bilt undo` a second time.
- **Verify:** Second invocation handles empty snapshot queue gracefully without throwing unhandled exceptions or reporting fake reverts.

#### F. `watch` / `live` Real-Time Daemon Verification

- Command: `bilt watch` (or alias `bilt live`).
- Test Actions (in a second terminal):
  - Append secret: `echo 'AWS_SECRET_ACCESS_KEY=super-secret-value' >> test.env` (Verify scan triggers immediately).
  - Edit secret: `echo 'STRIPE_SECRET_KEY=sk_live_fake_test_secret' >> test.env` (Verify re-scan triggers).
  - Delete file: `rm test.env` (Verify watcher handles deletion gracefully without crashing).
  - Terminate: Press `Ctrl+C` (Verify daemon shuts down cleanly).

#### G. `report` Export Verification

- Command: `bilt report --format markdown` and `bilt report --format json`.
- **Verify:** Generated `.md` and `.json` files match findings reported by `scan` and `doctor`.

#### H. `doctor` Diagnostic Breakdown

- Command: `bilt doctor .`
- **Verify:** Outputs holistic health score, grade, categorized diagnostic warnings, and advice.

#### I. `plugin` Lifecycle Test

- Command: `bilt plugin list` and `bilt plugin create test-plugin`.
- **Verify:** Command template files are generated cleanly. Any unreleased plugin action prints clear experimental notices rather than failing silently.

#### J. `welcome` Resilience Test

- Command: `bilt welcome` and alias `bilt onboarding`.
- **Verify:** Interactive setup handles edge cases seamlessly (e.g. missing `.env`, uninitialized Git repos, existing finding lists, or abrupt Ctrl+C exit).

#### K. `ai` & `ask` Confidentiality Verification

- Command: `bilt ask "What security issues were found?"` without AI setup.
- **Verify:** Fails informatively with clean diagnostic guidance.
- Command: Configure provider and run `bilt ask "How should I fix the highest severity issue?"`.
- **Verify:** Answers are strictly scoped to local scan findings, and **Bilt never prints raw API keys or secret values** to output streams, logs, or reports.

---

### 4. Final CLI Smoke Test Sequence

Run this consolidated smoke test suite after making code or documentation updates:

```bash
bilt --version
bilt --help
bilt scan .
bilt api-scan .
bilt doctor .
bilt report .
bilt fix --dry-run .
bilt undo .
bilt plugin list
bilt welcome
bilt ai --help
```

---

### 5. Pre-Release npm Package Packaging Pipeline

Before publishing to npm, verify that the release tarball contains all necessary build artifacts (`dist`, `bin`, types) and excludes internal scratch files:

```bash
# 1. Build and dry-run package from Bilt repository root
npm test
npm run build
npm pack --dry-run
npm pack

# 2. Create isolated test directory outside Bilt source tree
mkdir ../bilt-package-test
cd ../bilt-package-test
npm init -y

# 3. Install packed tarball directly
npm install ../bilt/*.tgz

# 4. Verify binary execution from node_modules/.bin
npx bilt --version
npx bilt --help
npx bilt scan .
npx bilt doctor .
npx bilt api-scan .
```

_Critical Objective:_ This step prevents standard published npm package failures (such as missing `dist/` folders, broken bin links, or improper `.npmignore` patterns) that pass locally when linked but fail when installed via npm.

---

## Core Features & Safety Net

### Real-Time Protection Daemon

Bilt goes beyond traditional git commit hooks. The background watcher daemon monitors file system events on save, providing immediate feedback before code ever enters the git staging area.

### Non-Destructive Snapshot Engine

- **Automated Snapshots:** Created inside `.bilt/snapshots/` before any file modification.
- **Explicit Prompts:** Interactive confirmation required for destructive actions.
- **Instant Reversion:** Revert edits seamlessly with `bilt undo`.

### Framework & Prefix Awareness

Detects framework paradigms (Next.js, Vite, CRA, Nuxt, Django, Rails) and flags sensitive server keys assigned to public prefixes (e.g. `NEXT_PUBLIC_` or `VITE_`) as critical leaks.

### False Positive Suppression

Use inline or block comments to explicitly mark safe public keys or mock test values:

```env
# bilt:allow
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Agent-Native Security & Verification

Bilt provides a first-class, deterministic security and testing layer purpose-built for autonomous AI coding agents (Claude Code, Cursor, Codex, CI pipelines).

### Non-Negotiable Invariants

1. **Deterministic Detection**: Detection is 100% deterministic code analysis. AI never decides whether code is secure; AI agents only consume structured findings.
2. **Precision Over Coverage**: Rules are tier-rated (`high`, `medium`, `low`) and maturity-flagged (`stable`, `experimental`). Only `stable` + `high-precision` rules can produce a hard FAIL. Medium-precision heuristics yield `needs_review`.
3. **Untrusted Agent & Hostile Input Protection**: All code snippets are sanitized, length-capped, and free of ANSI escape sequences. Raw secrets are universally redacted (`[REDACTED]`).
4. **Non-Evasion & Anti-Tamper Guardrails**: Configuration files (`.biltrc`, `bilt.config.*`) and ignore patterns are verified against the base branch with `bilt verify --base <ref>`. Unapproved config weakening or blanket ignores fail immediately.
5. **Loop Termination Guarantee**: Monitored iteration history (`.bilt/loop-state.json`) halts execution with `status: "escalate"` (exit code 4) if an agent loops without making progress.

### Quick Setup for Agents

Install **`bilt-toolkit`** into the project:

```bash
npm install -D bilt-toolkit
```

Initialize agent guidelines and hooks:

```bash
npx bilt init --agent
```

Or view the agent guidelines prompt directly:

```bash
npx bilt prompt --agent claude
```

### Scoped Verification for Changed Files

Instruct your coding agent to verify only its own modifications:

```bash
npx bilt verify --base origin/main --format agent
# or for uncommitted working tree edits:
npx bilt scan --format agent --changed
```

### Claude Code & Cursor Integration

#### Claude Code (`.claude/hooks.json`)

Configure Claude Code to automatically run Bilt verification on turn completion:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-hooks.json",
  "hooks": {
    "Stop": [
      {
        "type": "command",
        "command": "npx bilt verify --base origin/main --format agent"
      }
    ]
  }
}
```

#### Cursor (`.cursorrules` or `AGENTS.md`)

Add verification rules to `AGENTS.md` or `.cursorrules`:

```markdown
# Agent Verification Guidelines

Install: `npm install -D bilt-toolkit`
Execute: `npx bilt check --format agent` (or `npx bilt verify --base origin/main --format agent`)

1. Before completing tasks or proposing commits, run verification.
2. DO NOT merely summarize findings and quit:
   - Run `npx bilt design-check --fix` and `npx bilt fix --safe` for auto-fixable issues.
   - Run `npx bilt baseline create` if onboarding an existing codebase with legacy debt.
   - Query `npx bilt design-brief --format agent` before modifying UI.
3. Remediate ONLY findings marked with `"introduced_by_change": true`.
4. Never weaken `.biltrc` or add unapproved blanket ignores.
5. If output status is `"escalate"` (exit code 4), stop immediately and request human review.
```

### Model Context Protocol (MCP) Server

Launch Bilt's native MCP server over stdio for IDEs and agents:

```bash
bilt mcp
```

Exposes tools:

- `bilt_check`: Run scoped security scan returning structured agent output.
- `bilt_explain`: Retrieve rule documentation and static remediation templates.
- `bilt_list_rules`: Enumerate registered rules, precision tiers, and maturity flags.

### Exit Codes & Deterministic Status Model

| Exit Code | Status         | Meaning                                                         | Action for AI Agent                        |
| :-------: | :------------- | :-------------------------------------------------------------- | :----------------------------------------- |
|   **0**   | `pass`         | Clean or only non-blocking findings                             | Proceed to completion / commit             |
|   **1**   | `fail`         | Stable high-precision rule violation or configuration tampering | Remediate findings before proceeding       |
|   **2**   | `needs_review` | Medium-precision finding requiring human review                 | Request human review / guidance            |
|   **3**   | `error`        | Tool error, invalid arguments, or parse error                   | Fix command invocation                     |
|   **4**   | `escalate`     | Runaway loop detected or max iterations budget exceeded         | Stop immediately and prompt human engineer |

For detailed documentation, refer to:

- [Threat & Trust Model](docs/trust-model.md)
- [Rule Authoring Guide](docs/rules.md)
- [CLI Exit Codes Reference](docs/exit-codes.md)
- [Agent JSON Schema](src/core/output/schemas/agent.schema.json)

---

## Configuration (`.biltrc.json`)

Customize Bilt settings using `.biltrc.json` in project root:

```json
{
  "ignore": ["tests/fixtures/**", "legacy-code/**"],
  "entropyThreshold": 4.5,
  "historyDepth": 15,
  "severityOverrides": {
    "env-mismatch": "warning",
    "dockerfile-leak": "critical"
  },
  "customRules": [
    {
      "id": "custom-org-token",
      "name": "Custom Organization Token",
      "pattern": "org-token-[a-f0-9]{16}",
      "severity": "critical"
    }
  ]
}
```

---

## Plugin System

Extend Bilt with custom rules for unique project files:

```typescript
import type { PluginManifest, PluginContext } from "bilt";

export const customPlugin: PluginManifest = {
  name: "bilt-plugin-custom",
  check: async (context: PluginContext) => {
    return {
      findings: [
        {
          id: "custom-leak",
          severity: "warning",
          category: "plugin-finding",
          message: "Custom pattern match detected",
          file: "config.json",
        },
      ],
    };
  },
};
```

---

## License

MIT © [Samuel](https://x.com/shmuelnog)
