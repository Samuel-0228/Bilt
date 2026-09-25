# `bilt check` Production Readiness — Implementation Plan

> Phase 0 — Recon complete. This document maps the 26-section specification
> onto Bilt's existing architecture.

---

## Existing Architecture Summary

| Component | Location | Reuse Strategy |
| :--- | :--- | :--- |
| CLI entry (Commander.js) | `src/cli.ts` (772 lines) | Add `check`, `explain`, `accept-risk` commands |
| Security rule engine | `src/core/security-engine/rule-engine.ts` | Reuse `SecurityRuleEngine.analyzeProject()` for automated checks |
| Security rules (9 files) | `src/core/security-engine/rules/` | Map to categories: auth, authz, input-validation, secrets |
| Scan engines (7 files) | `src/core/scan/` | Reuse env, secrets, config, dependencies, git, performance scanners |
| API scanning (7 files) | `src/core/api-scan/` | Reuse route-detector, mass-assignment, method-allowlist, content-validation |
| Route detector | `src/core/api-scan/route-detector.ts` | Extend for RouteMap (3B) |
| Ecosystem detector | `src/core/ecosystem/detector.ts` | Reuse for stack scoping (4B) |
| Finding model | `src/core/finding/types.ts` | Extend with `mode`, `status`, `whyItMatters`, `evidenceRequired` |
| Agent output | `src/core/output/formatters/agent.ts` | Extend for check output |
| SARIF output | `src/core/output/formatters/sarif.ts` | Reuse as-is |
| Loop/tamper/safety | `src/core/loop/`, `src/core/trust/`, `src/core/safety/` | Reuse for evidence validation |
| Config | `src/config/config.ts` (cosmiconfig) | Extend `BiltConfig` for check settings |
| Test framework | Vitest (57 files, 275 tests) | Add check-specific test projects |

---

## Category → Existing Engine Mapping

| Category | Mode | Existing Engine | Gap |
| :--- | :---: | :--- | :--- |
| 1. secrets-and-env | automated | `scan/secrets`, `scan/env`, `SecretAnalyzer`, `EnvAnalyzer` | None — fully covered |
| 2. auth | automated | `security-engine/rules/auth-rules.ts` (SEC-AUTH-001/002/003) | Add cookie/session/hashing checks |
| 3. authorization | guided | `security-engine/rules/authz-rules.ts` (IDOR rule) | Need guided procedure + evidence schema |
| 4. input-validation | automated | `security-engine/rules/input-validation-rules.ts` + `api-scan/content-validation.ts` | Consolidate |
| 5. api-abuse-and-cost | guided | `api-scan/` (route detection, method allowlist) | Need guided procedure for rate limiting |
| 6. database | mixed | `scan/secrets` (DB creds), `security-engine/rules/storage-networking-rules.ts` | Add guided procedure |
| 7. dependencies | automated | `scan/dependencies.ts` | Minor extension |
| 8. error-handling-logs | automated | Partial in security-engine | New checks needed |
| 9. transport-and-headers | automated | `security-engine/rules/api-config-rules.ts`, `storage-networking-rules.ts` | Consolidate |
| 10. deploy-config | automated | `scan/config.ts` | Extend |
| 11. file-uploads | guided | None | New guided procedure |
| 12. payments | guided | None (Stripe verifier exists) | New guided procedure |
| 13. privacy-and-pii | guided | None | New guided procedure |
| 14. monitoring-rollback | guided | None | New guided procedure |

---

## Stack Scoping (4B)

**Supported stacks for automated checks** (from existing engines):
- Express, Fastify, Next.js (App/Pages Router), Nuxt, SvelteKit
- FastAPI, Django REST Framework, Rails (route detection only)

**Route extractors available** (from `route-detector.ts`):
- Express/Fastify, Next.js App Router, Next.js Pages Router
- FastAPI, Django, Rails

For stacks without extractors: report `UNSUPPORTED STACK`.

---

## New Source Structure

```
src/
  commands/
    check.ts              # NEW: bilt check command
    explain.ts            # NEW: bilt explain <category>
    accept-risk.ts        # NEW: bilt accept-risk <id>

  core/
    readiness/
      taxonomy.ts         # 14 categories, metadata, modes
      check-runner.ts     # orchestrates automated + guided checks
      readiness-gate.ts   # production gate logic (Section 8)
      finding.ts          # BiltCheckFinding (extends Finding)
      evidence.ts         # guided evidence schema + validation
      evidence-validator.ts  # fabrication heuristics (14B)
      route-map.ts        # RouteMap extraction (3B)
      risk-acceptance.ts  # accept-risk mechanism (8B)
      cache.ts            # file-hash caching (16B)
      disclaimer.ts       # non-suppressible disclaimer (15B)
      formatters/
        human.ts          # human-readable output
        agent.ts          # JSON agent output

    readiness/
      checks/
        secrets-and-env.ts
        auth.ts
        authorization.ts
        input-validation.ts
        api-abuse-and-cost.ts
        database.ts
        dependencies.ts
        error-handling-logs.ts
        transport-and-headers.ts
        deploy-config.ts
        file-uploads.ts
        payments.ts
        privacy-and-pii.ts
        monitoring-rollback.ts

  concepts/               # markdown concept docs for bilt explain
    secrets-and-env.md
    auth.md
    authorization.md
    input-validation.md
    api-abuse-and-cost.md
    database.md
    dependencies.md
    error-handling-logs.md
    transport-and-headers.md
    deploy-config.md
    file-uploads.md
    payments.md
    privacy-and-pii.md
    monitoring-rollback.md
```

---

## Phase Execution Plan

### Phase 1 — Core Foundation
- `src/core/readiness/taxonomy.ts` — 14 categories, modes, metadata
- `src/core/readiness/finding.ts` — BiltCheckFinding model (Section 6)
- `src/core/readiness/readiness-gate.ts` — gate logic (Section 8)
- `src/core/readiness/check-runner.ts` — orchestrator
- `src/core/readiness/disclaimer.ts` — fixed disclaimer text (15B)

### Phase 2 — Integrate Existing Engines
- `src/core/readiness/checks/secrets-and-env.ts` — wrap existing scan/secrets + scan/env
- `src/core/readiness/checks/auth.ts` — wrap auth-rules + add cookie/session/hashing
- `src/core/readiness/checks/input-validation.ts` — wrap input-validation-rules + content-validation
- `src/core/readiness/checks/dependencies.ts` — wrap scan/dependencies
- `src/core/readiness/checks/transport-and-headers.ts` — wrap api-config-rules
- `src/core/readiness/checks/deploy-config.ts` — wrap scan/config
- `src/core/readiness/checks/error-handling-logs.ts` — new automated checks
- `src/core/readiness/checks/database.ts` — mixed: automated DB creds + guided

### Phase 3 — Guided Procedures
- `src/core/readiness/evidence.ts` — evidence schema
- `src/core/readiness/evidence-validator.ts` — fabrication heuristics (14B)
- `src/core/readiness/route-map.ts` — RouteMap from route-detector (3B)
- `src/core/readiness/checks/authorization.ts` — guided procedure
- `src/core/readiness/checks/api-abuse-and-cost.ts` — guided procedure
- `src/core/readiness/checks/file-uploads.ts` — guided procedure
- `src/core/readiness/checks/payments.ts` — guided procedure
- `src/core/readiness/checks/privacy-and-pii.ts` — guided procedure
- `src/core/readiness/checks/monitoring-rollback.ts` — guided procedure

### Phase 4 — CLI Commands
- `src/commands/check.ts` — bilt check with --format, --changed, --base
- `src/core/readiness/formatters/human.ts` — human output
- `src/core/readiness/formatters/agent.ts` — agent JSON output
- Register in `src/cli.ts`

### Phase 5 — explain + prompt
- 14 concept markdown files in `src/concepts/`
- `src/commands/explain.ts` — bilt explain <category>
- Update `src/commands/prompt.ts` — add check instructions

### Phase 6 — Risk Acceptance
- `src/core/readiness/risk-acceptance.ts` — accept-risk storage
- `src/commands/accept-risk.ts` — CLI command
- Integration with gate logic

### Phase 7 — Evidence Validation + Safety
- Evidence fabrication heuristics (completeness, uniqueness, existence, timing)
- Cache system (16B)
- Agent schema versioning (9B)

### Phase 8 — Fixtures + Tests
- `tests/fixtures/insecure-app/` — deliberately vulnerable app
- `tests/fixtures/secure-app/` — clean app
- Unit tests for each check, gate logic, evidence validation
- Integration tests for `bilt check` end-to-end

### Phase 9 — Self-Test
- Update CI to run `bilt check --format agent`
- Add accepted-risk entries for test fixtures

### Phase 10 — Documentation
- Update README
- Update CHANGELOG
- Schema documentation

### Phase 11 — Package Verification
- npm pack + smoke test

---

## Key Design Decisions

1. **BiltCheckFinding extends existing Finding** — additive, no breaking changes
2. **Check runner delegates to existing engines** — no duplicate detection logic
3. **RouteMap reuses route-detector.ts** — no new framework support beyond what exists
4. **Gate logic is conservative** — 6 mandatory categories cannot be risk-accepted
5. **Guided checks never auto-pass** — always needs-review without evidence
6. **Schema version is integer** — additive fields don't bump
7. **Disclaimer is non-suppressible** — appended to every output
