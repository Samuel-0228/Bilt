# Bilt

[![npm version](https://img.shields.io/badge/npm-v1.0.4-blue.svg)](https://www.npmjs.com/package/bilt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/bilt-dev/bilt)
[![Coverage Status](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/bilt-dev/bilt)

> Zero-configuration project health toolkit. Detect hardcoded secrets, resolve environment variable mismatches, enforce safe local practices, and maintain repository integrity before code reaches Git.

---

```
   ____    _   _       _____
  |  _ \  | | | |     |_   _|
  | |_) | | | | |       | |
  |  _ <  | | | |___    | |
  | |_) | |_| |_____|   |_|
  |____/
```

Bilt is a developer-focused CLI utility designed to keep environment configurations healthy, prevent credential leaks, and provide automated safety guardrails for codebases. It operates offline by default, requires zero initial configuration, and offers non-destructive automated fixes backed by full git snapshot rollback capabilities.

---

## Table of Contents

- [Quick Start](#quick-start)
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
- [Configuration (`.biltrc.json`)](#configuration-biltrcjson)
- [Plugin System](#plugin-system)
- [License](#license)

---

## Quick Start

Install Bilt globally or run directly on any repository using `npx`:

```bash
# Global installation
npm install -g bilt

# Initialize Bilt in your project root
bilt init
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

| Command | Description | Key Flags & Options |
| :--- | :--- | :--- |
| `bilt init` | Onboards repository. Scans codebase, creates a safety snapshot, applies safe auto-fixes, and prints health status. | `--verbose`, `--dry-run` |
| `bilt scan [dir]` | Audits working tree and Git history for leaked secrets, framework misconfigurations, and environment mismatches. | `--full-history`, `--json`, `--severity <level>`, `--verbose`, `--dry-run` |
| `bilt api-scan [dir]` | Executes specialized API security checks, inspecting endpoint safety, header hygiene, and key leaks. | `--json`, `--verbose`, `--dry-run` |
| `bilt fix [dir]` | Safely remediates flagged findings. Supports interactive mode, safe autopilot mode, or preview dry-runs. | `--safe`, `--dry-run`, `--verbose`, `--quiet` |
| `bilt undo [dir]` | Reverts the latest changes made by `bilt fix`. Displays snapshot diffs before restoring original files. | `--list` |
| `bilt watch [dir]` | Launches real-time background file monitor to detect secrets and environment drifts instantly on save. | `--quiet`, `--debounce <ms>`, `--poll` |
| `bilt live [dir]` | Alias for `bilt watch`. Continuous real-time security monitoring. | `--quiet`, `--debounce <ms>` |
| `bilt doctor [dir]` | Generates comprehensive repository health analysis with severity grading and actionable remediation advice. | `--card`, `--debug` |
| `bilt report [dir]` | Exports project health and security findings to Markdown or JSON format for CI/CD integration. | `--format <markdown|json>`, `--output <path>` |
| `bilt plugin <action>` | Manages custom scanning rules and extension plugins (`list`, `create`, `install`). | `--dir <path>` |
| `bilt welcome` | Interactive onboarding wizard introducing Bilt concepts and command quick-starts. | None |
| `bilt onboarding` | Alias for `bilt welcome`. Interactive wizard. | None |
| `bilt ai <subcommand>` | Manages optional local or cloud AI provider integration (`setup`, `status`, `switch`, `model`). | `setup`, `status`, `switch`, `model`, `provider`, `remove`, `test` |
| `bilt ask <question>` | Queries contextual AI assistant about specific scan findings and remediation guidance. | `--debug` |

---

## Core Command Breakdown

### 1. `scan` — Static Security & Environment Audit
Scans source files, config files, and git commit history for hardcoded tokens, secret keys, entropy spikes, and environment variable divergence.
```bash
# Basic project scan
bilt scan

# Explicit target directory
bilt scan ./src

# Detailed JSON output for tooling
bilt scan --json
```

### 2. `api-scan` — Dedicated API Security Diagnostics
Analyzes REST/GraphQL endpoints, API route handlers, authentication header checks, and client-exposed public keys.
```bash
bilt api-scan
```

### 3. `init` — Automated Project Onboarding
Sets up recommended security defaults, ignores, and health baselines for new or unconfigured repositories.
```bash
bilt init
```

### 4. `fix` — Non-Destructive Remediation
Applies fixes interactively or in safe mode. Always previews changes using `--dry-run` first to review prospective edits without mutating disk files.
```bash
# Preview changes safely without file modifications
bilt fix --dry-run

# Interactive guided fix mode
bilt fix

# Non-interactive safe mode (applies only low-risk edits)
bilt fix --safe
```

### 5. `undo` — Instant Rollback & Snapshot Recovery
Reverts modifications performed by `bilt fix` using stored local snapshots.
```bash
# Revert most recent fix operation
bilt undo

# Inspect past snapshot history
bilt undo --list
```

### 6. `watch` / `live` — Real-Time Daemon
Monitors file creation, edits, and deletions in real time. Notifies developer immediately when a secret token is saved.
```bash
# Start watcher daemon
bilt watch

# Use alias
bilt live
```

### 7. `report` — CI/CD Export & Documentation Generator
Exports structured security findings into Markdown or JSON reports.
```bash
# Standard report export
bilt report

# Explicit Markdown export
bilt report --format markdown

# JSON format export
bilt report --format json
```

### 8. `doctor` — Broad Health & Score Diagnostics
Evaluates codebase maturity, secret leaks, missing `.env.example` definitions, and framework-specific security pitfalls.
```bash
bilt doctor
```

### 9. `plugin` — Custom Rule Extensions
List available plugins or scaffold custom security rules for project-specific protocols.
```bash
# List installed plugins
bilt plugin list

# Create new custom plugin template
bilt plugin create custom-security-rule
```

### 10. `welcome` / `onboarding` — Interactive Assistant
Guided terminal interface for new developers joining a codebase.
```bash
bilt welcome
```

### 11. `ai` & `ask` — Contextual AI Assistance
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
*Verification Goal:* Ensure all subcommands and flags are correctly listed in `--help`.

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

*Critical Objective:* This step prevents standard published npm package failures (such as missing `dist/` folders, broken bin links, or improper `.npmignore` patterns) that pass locally when linked but fail when installed via npm.

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

MIT

