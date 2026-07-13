# 🏗️ BILT

[![npm version](https://img.shields.io/badge/npm-v1.0.0-blue.svg)](https://www.npmjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](<>)
[![Coverage Status](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](<>)

> **Zero-configuration project health toolkit.** Catch secrets, fix environment variable issues, and keep your local repository clean before it ever reaches Git — with a safety net.

---

```
   ____    _   _       _____
  |  _ \  | | | |     |_   _|
  | |_) | | | | |       | |
  |  _ <  | | | |___    | |
  | |_) | |_| |_____|   |_|
  |____/
```

Bilt is a developer-focused utility designed to keep environment configurations healthy and prevent credentials leaks. It runs offline, requires zero configuration, and provides interactive, safe auto-fixing.

---

## 🚀 Quick Start

Initialize Bilt on your current project in one command:

```bash
npx bilt init
```

This runs a full scan, hooks up a `.gitignore` guardrail, drafts template environment files, and prints a summary of your repository health.

---

## 📦 Terminal Health Report Example

When you scan your project, Bilt prints a beautiful health report card:

```
╭──────────────────────────────────────────────────╮
│                                                  │
│   🏗️  BILT HEALTH REPORT                         │
│                                                  │
│   Score: 92/100              Grade: A            │
│   ██████████████████████░░░  92%                 │
│                                                  │
│   ✓ Secrets: Clean                               │
│   ⚠ Env vars: 2 missing in .env                  │
│   ✓ .gitignore: OK                               │
│   ✓ Framework: Next.js detected                  │
│                                                  │
╰──────────────────────────────────────────────────╯
```

---

## 🛠️ CLI Commands & Options

| Command           | Description                                                                                                                                                                                | Core Options                                                                                                        |
| :---------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| **`bilt init`**   | Zero-friction onboarding. Scans the project, creates a local backup snapshot, auto-fixes safe issues (like missing `.gitignore` files or environment templates), and prints a health card. | None                                                                                                                |
| **`bilt scan`**   | Scans the working tree and git history for credential leaks, framework issues, and environment mismatches.                                                                                 | `--full-history` (scan all commits), `--json` (machine output), `--severity <level>` (filter), `--verbose`, `--fun` |
| **`bilt fix`**    | Safely applies automated fixes. Can be run in interactive mode (prompts on every non-safe fix) or auto-pilot.                                                                              | `--safe` (apply safe fixes only), `--dry-run` (preview changes), `--verbose`, `--quiet`                             |
| **`bilt undo`**   | Reverts the last set of changes made by `bilt fix`. Shows a colored line-by-line diff and requires confirmation before restoring.                                                          | None                                                                                                                |
| **`bilt watch`**  | Runs a file-watching background daemon. Monitors your files as you edit and save them, instantly flagging secrets or env issues in real-time.                                              | `--quiet`, `--debounce <ms>` (default: 300ms)                                                                       |
| **`bilt doctor`** | Displays a detailed, comprehensive health breakdown categorized by severity with explicit recommendations.                                                                                 | `--card` (outputs markdown summary), `--fun`                                                                        |

---

## ✨ Key Features & Differentiators

### 1. Real-time Protection (File Watcher Daemon)

Unlike traditional scanner hooks that only run during commits, Bilt has a file watcher daemon (`bilt watch`) that detects leaks **the moment you type or save a file**. If you accidentally paste a Stripe secret key into `config.js`, Bilt immediately triggers a terminal notification:

> 🔴 Stripe API Key detected in `config.js` line 12 — want me to move it to `.env`?

### 2. The Safety Undo Net

Bilt is the only tool that cannot accidentally corrupt your codebase.

- Before applying any change that edits files, modifies git history, or removes items, Bilt automatically takes a local file snapshot stored under `.bilt/snapshots/`.
- Every irreversible fix requires typing `confirm` to proceed.
- If something breaks, simply run **`bilt undo`** to view the diff and restore your files to their exact pre-fix state.

### 3. Framework-Aware Intelligence

Bilt automatically inspects your dependencies and configuration files to detect the framework you are using (Next.js, Vite, Create React App, Django, Rails, etc.).
It understands which prefixes expose variables to the browser bundle (e.g. `NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`). If a secret is placed inside a variable with one of these prefixes, it flags it as a **critical vulnerability** since it will be leaked to web browsers.

### 4. Interactive Secret Rotation Assistance

When a secret is found, Bilt maps the credential to its specific SaaS provider (Stripe, AWS, OpenAI, GitHub, Supabase, Twilio, SendGrid, etc.) and provides a direct, clickable deep-link to the exact rotation settings console so you can revoke the token immediately.

### 5. False Positive Management

If a credential check is a false positive (such as a public key meant for client-side use), you can tell Bilt to ignore the line.
Add a comment containing `# gitleaks:allow` or `# bilt:allow` on the line itself, or on the line directly above it:

```env
# gitleaks:allow
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## ⚙️ Configuration (`.biltrc.json`)

Bilt is zero-config by default, but you can customize it by placing a `.biltrc.json` file in your project root:

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
      "id": "my-custom-token",
      "name": "Custom Organization Token",
      "pattern": "org-token-[a-f0-9]{16}",
      "severity": "critical"
    }
  ],
  "funMode": true
}
```

---

## 🔌 Extensible Plugin System

Bilt allows developers to write custom plugins to scan specialized files (e.g. Terraform configs, Dockerfiles).

### Example Plugin Interface

```typescript
import type { PluginManifest, PluginContext } from "bilt";

export const myPlugin: PluginManifest = {
  name: "bilt-plugin-custom",
  check: async (context: PluginContext) => {
    // Scan files in context.projectDir
    return {
      findings: [
        {
          id: "custom-leak",
          severity: "warning",
          category: "plugin-finding",
          message: "Custom pattern match found",
          file: "config.json",
        },
      ],
    };
  },
};
```

---

## 📄 License

MIT © [Samuel Yeshambel](https://github.com/Samuel-0228)
