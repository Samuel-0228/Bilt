# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.5] - 2026-10-03

### Added & Enhanced - Anti-Passive Auditor Trap Architecture

- **Action Plan in Readiness Check**: Enhanced `bilt check` human output with an explicit, high-visibility `ACTION PLAN FOR DEVELOPERS & AI CODING AGENTS` detailing runnable commands (`bilt design-check --fix`, `bilt fix --safe`, `bilt baseline create`, `bilt design-brief --format agent`, `bilt explain <rule>`).
- **Machine-Readable Agent Directive**: Enhanced `bilt check --format agent` JSON output with top-level `agentInstruction` and structured `actionPlan` arrays containing executable bash commands and remediation reasons.
- **Autonomous Agent Remediation Protocol**: Codified the mandatory `AUTONOMOUS REMEDIATION PROTOCOL (DO NOT MERELY REPORT AND HALT)` across `AGENTS.md`, `templates/default.md`, `templates/claude.md`, `templates/cursor.md`, and `init-agent.ts`.
- **Integrated Agent Onboarding in `init`**: `bilt init` now automatically scaffolds `AGENTS.md` and agent hooks alongside `.gitignore` and `.env.example`, unifying repository hygiene and agent governance into a single command.
- **Reporter Next Steps**: Updated `bilt init` completion output to highlight `check`, `baseline`, and `design-check --fix`.

## [1.1.2] - 2026-09-28

### Fixed
- **npm Package Packaging**: Explicitly added `README.md` and `LICENSE` to the `files` array in `package.json` to ensure immediate and reliable rendering on npmjs.com package pages.

## [1.1.1] - 2026-09-28

### Added & Fixed - Hardening & AI Agent Ergonomics

- **Framework-Aware Dependency Detection**: Automatic framework heuristic detection (Next.js, Remix, Vite, Nuxt, Astro, SvelteKit) eliminates false-positive `dep-unused` warnings for framework runtimes like `react-dom` in Next.js.
- **Configurable `ignoreUnused` & Framework Presets**: Added `ignoreUnused: string[]` and `framework: string` in `.biltrc.json` to allow granular dependency overrides.
- **Supabase SSR Cookie Security Analysis**: Suppressed false positives for cookie options forwarded dynamically through `@supabase/ssr` (`createServerClient`, `setAll(cookiesToSet)`). Added context-aware diagnostics and official `getAll`/`setAll` code snippets when static cookies lack required flags.
- **Resilient CLI Argument Parsing for `accept-risk`**: Supports flexible flag ordering, positional IDs, `--id <id>`, `--finding <id>`, and multi-word reasons. Provides actionable error diagnostics with examples and fuzzy matching for approximate rule IDs.
- **Infinite Loop & Agent Oscillation Prevention**: Upgraded agent loop detection to escalate on $N \ge 3$ consecutive duplicate iterations and detect $A \to B \to A \to B$ oscillation thrashing, terminating cleanly with exit code 4 (`status: "escalate"`). Persists state in `.bilt/.agent-state.json` and `.bilt/loop-state.json`.

## [1.1.0] - 2026-09-25

### Added - Production Readiness Gate for AI-Built Software

- **`bilt check` Production Gate**: Added new primary pre-production verification command (`bilt check`) with `--format human|agent|json`, `--changed`, and `--base` flags. Evaluates applications against an honest 14-category production readiness gate.
- **14-Category Readiness Taxonomy**: Implemented canonical taxonomy across 14 security, data, and infrastructure domains:
  - Enforced (automated): `secrets-and-env`, `auth`, `input-validation`.
  - Guided: `authorization`, `api-abuse-and-cost`.
  - Partial: `database`, `dependencies`, `error-handling-logs`, `transport-and-headers`, `deploy-config`.
  - Coming Soon: `file-uploads`, `payments`, `privacy-and-pii`, `monitoring-rollback`.
- **Mandatory Category Invariant**: Defined 6 core categories (`secrets-and-env`, `auth`, `authorization`, `input-validation`, `api-abuse-and-cost`, `database`) that must be verified or fixed before production gate passes.
- **Automated Ground-Truth Route Map (3B)**: Independent route extraction engine covering Express, Fastify, Next.js (App & Pages Router), FastAPI, Django, and Rails, cross-checking guided agent claims against actual endpoints.
- **Evidence Fabrication Heuristics (14B)**: Enforced anti-gaming validation on guided check submissions:
  - Completeness verification against canonical route map.
  - Uniqueness checks preventing duplicate evidence locations.
  - Existence verification ensuring every reported line exists in the repository.
  - Timing checks flagging unrealistically rapid evidence generation.
- **Distinct Risk Acceptance Mechanism (8B)**: Added `bilt accept-risk <id> --reason "..." --owner "<name>" [--expires <date>]` storing formally accepted non-mandatory risks in `.bilt/accepted-risk.json`. Explicitly forbids risk acceptance on mandatory categories.
- **Concepts & Educational Layer**: Added `bilt explain <category>` with 14 comprehensive markdown concept guides explaining real-world consequences and remediation steps for AI-built software.
- **Non-Suppressible Disclaimer (15B)**: Every `bilt check` output guarantees explicit signaling: *"Bilt is an automated readiness check, not a certified security audit. A 'production-ready' result means known common gaps were checked and not found; it does not guarantee the absence of vulnerabilities."*
- **File-Hash Caching & Safety Bounds (16B)**: Added SHA-256 content caching in `.bilt/cache/readiness-cache.json` and 1MB per-file scanning size guardrails.
- **Strict Integer Schema Versioning (9B)**: Machine-readable agent output (`--format agent`) uses integer `schemaVersion: 1` with backward-compatible additive evolution guarantees.

## [1.0.5] - 2026-09-24

### Added - Agent-Native Security & Testing Interface

- **Engine Architecture & Wrappers**: Introduced modular `Engine` interface (`src/core/engine/types.ts`) and wrapped existing checks (secrets, security rules, API scan, env/gitignore) without altering legacy interfaces.
- **Finding Model & Stable Fingerprints**: Added normalized `Finding` model with explicit precision tiers (`high`, `medium`, `low`), maturity flags (`stable`, `experimental`), and SHA-256 content fingerprints immune to line shifts and line deletions.
- **Static Template Ownership**: Enforced that finding explanations and remediation actions are owned strictly by static Bilt templates—never interpolated from untrusted repository text.
- **Git-Aware Scoping & Baseline**: Added `--changed` and `--base <ref>` flags to scope analysis strictly to newly modified lines and files. Added `bilt baseline create` to freeze legacy repository debt into `.bilt/baseline.json`.
- **Versioned Agent JSON Schema & Formatter**: Published `src/core/output/schemas/agent.schema.json` and agent output formatter emitting machine-readable results with exit codes 0 through 4 (`pass`, `fail`, `needs_review`, `error`, `escalate`).
- **SARIF 2.1.0 Formatter & Ingestion**: Added SARIF 2.1.0 export (`--format sarif`) and ingest adapter (`importSarif`) allowing external static analysis results to be ingested into Bilt's finding model.
- **Untrusted Agent & Hostile Input Protection**: Implemented ANSI and terminal control character stripping, max snippet length limits (200 chars), and universal secret redaction (`[REDACTED]`). Tested against hostile prompt injection and payload fixtures.
- **Suppression Policy & Accountability**: Added suppression parser requiring explicit `reason` (>= 10 chars), expiration dates (`expires`), and an active repository suppression budget to prevent silent security decay.
- **Anti-Tamper Detection & Verification**: Added `bilt verify --base <ref>` to detect tampering with configuration files (`.biltrc`, `bilt.config.*`, `.biltignore`), lowered severities, relaxed thresholds, and blanket wildcard ignores.
- **Loop Termination & Iteration Budgeting**: Implemented `.bilt/loop-state.json` to monitor agent iterations, halting runaway loops with `status: "escalate"` (exit code 4) upon consecutive duplicate runs or budget exhaustion.
- **Deterministic Rule Pack**: Implemented 6 precision-crafted security rules:
  - `RULE-SEC-001`: Hardcoded secrets detection (High precision, Stable).
  - `RULE-ENV-001`: Committed environment files and frontend prefix leaks (High precision, Stable).
  - `RULE-AUTH-001`: Missing route authentication middleware (High precision, Stable).
  - `RULE-INPUT-001`: Missing input validation on request bodies (High precision, Stable).
  - `RULE-HTTP-001`: Wildcard HTTP method matchers (High precision, Stable).
  - `RULE-IDOR-001`: Client-controlled role and object identifiers (Medium precision, Experimental - emits `needs_review`).
    Every rule is backed by positive and negative test fixtures.
- **Model Context Protocol (MCP) Server**: Added native MCP stdio server (`bilt mcp`) exposing `bilt_check`, `bilt_explain`, and `bilt_list_rules` for Claude Code, Cursor, and MCP-compatible agents.
- **Agent Initialization & Prompt Templates**: Added `bilt init --agent` with diff preview and overwrite safeguards, generating `AGENTS.md` and `.claude/hooks.json`. Added `bilt prompt [--agent <name>]` loading modular templates from `templates/`.
- **CI Verification Workflow**: Added `.github/workflows/verify.yml` with diff-scoped verify execution, SARIF export, and GitHub Code Scanning upload.
- **Precision Benchmark Harness**: Added `tests/bench/benchmark.ts` and `npm run test:bench` enforcing a strict 100% precision gate on all stable rules across all fixtures.
