# Bilt

[![npm version](https://img.shields.io/badge/npm-v1.0.2-blue.svg)](https://www.npmjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/Samuel-0228/Bilt)
[![Coverage Status](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/Samuel-0228/Bilt)

> Zero-configuration project health toolkit. Detect hardcoded secrets, resolve environment variable mismatches, and maintain repository cleanliness before code reaches Git.

---

```
   ____    _   _       _____
  |  _ \  | | | |     |_   _|
  | |_) | | | | |       | |
  |  _ <  | | | |___    | |
  | |_) | |_| |_____|   |_|
  |____/
```

Bilt is a developer-focused CLI utility designed to keep environment configurations healthy, prevent credential leaks, and provide automated safety mechanisms for codebases. It operates offline by default, requires zero configuration, and provides interactive, non-destructive automated fixes with full rollback capabilities.

---

## Quick Start

Initialize Bilt on your current repository with a single command:

```bash
npx bilt init
```

This command performs a comprehensive repository scan, sets up `.gitignore` guardrails, generates template environment files, and displays a summary report of your codebase health.

---

## Health Report Example

When running a scan or initializing a repository, Bilt generates a clean health card:

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

## CLI Commands Reference

| Command | Description | Key Options |
| :--- | :--- | :--- |
| `bilt init` | Onboarding initialization. Scans project, creates a snapshot, applies safe auto-fixes, and displays health status. | None |
| `bilt scan [dir]` | Scans working tree and git history for credential leaks, framework issues, and environment mismatches. | `--full-history`, `--json`, `--severity <level>`, `--verbose`, `--dry-run`, `--no-verify` |
| `bilt fix [dir]` | Safely applies automated fixes. Supports interactive confirmation or safe autopilot mode. | `--safe`, `--dry-run`, `--verbose`, `--quiet` |
| `bilt undo [dir]` | Reverts changes made by `bilt fix`. Displays diff previews before restoring snapshots. | `--list` (show past snapshots) |
| `bilt watch [dir]` | Runs a background file-watching daemon to detect secrets and environment errors as files are saved. | `--quiet`, `--debounce <ms>`, `--poll` |
| `bilt doctor [dir]` | Generates a detailed health diagnostic report categorized by severity with action recommendations. | `--card`, `--debug` |
| `bilt report [dir]` | Exports project health data to Markdown or JSON format for CI pipelines or documentation. | `--format <markdown|json>`, `--output <path>` |
| `bilt plugin <action>` | Manages custom scanning plugins (install, list, create). | `--dir <path>` |
| `bilt welcome` | Launches an interactive onboarding guide and quick-start menu. | None |
| `bilt ai <subcommand>` | Manages optional AI integration (provider setup, model selection, status checks). | `setup`, `status`, `switch`, `model`, `provider`, `remove`, `test`, `last-request` |
| `bilt ask <question>` | Asks AI assistant questions contextualized by the project's scan findings. | `--debug` |

---

## Core Features

### Real-Time Protection Daemon
Unlike traditional pre-commit hooks that only execute during git commits, Bilt includes a file watcher daemon (`bilt watch`). It monitors file system changes in real time and alerts developers immediately when sensitive tokens or key mismatches are saved.

### Non-Destructive Safety Net
Bilt ensures automated fixes never corrupt your repository:
* Snapshot Creation: Before modifying files, Bilt records a snapshot in `.bilt/snapshots/`.
* Explicit Confirmation: High-risk operations require manual user confirmation.
* Full Rollback: Run `bilt undo` to inspect diffs and revert files to their pre-fix state.

### Framework Awareness
Bilt detects popular frameworks (Next.js, Vite, Create React App, Django, Rails, etc.) and understands variable scope rules. It flags sensitive credentials assigned to public-facing prefixes (such as `NEXT_PUBLIC_` or `VITE_`) as critical vulnerabilities before client bundles are built.

### False Positive Exclusions
To suppress false positives (such as public keys intended for client-side use), append inline or block ignore comments:

```env
# bilt:allow
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Configuration (`.biltrc.json`)

Bilt operates zero-config out of the box, but can be customized using `.biltrc.json` in the root directory:

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

## Extensible Plugin System

Custom plugins can be created to scan domain-specific file formats (e.g., Terraform manifests, Kubernetes configs):

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

MIT (c) [Samuel Yeshambel](https://github.com/Samuel-0228)
