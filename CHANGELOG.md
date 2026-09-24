# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2026-09-24

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
