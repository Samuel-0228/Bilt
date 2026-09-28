# Contributing to Bilt Toolkit

Thank you for your interest in contributing to Bilt Toolkit! Bilt is a zero-configuration developer security and production-readiness toolkit designed for modern developers and autonomous coding agents.

---

## 1. Development Setup

### Prerequisites
- **Node.js**: >= 18.0.0 (LTS recommended)
- **npm**: >= 9.0.0
- **Git**: Installed and available in PATH

### Initial Setup
```bash
# Clone the repository
git clone https://github.com/Samuel-0228/bilt.git
cd bilt

# Install dependencies
npm ci

# Build the project
npm run build
```

---

## 2. Available Scripts

| Command | Purpose |
| :--- | :--- |
| `npm run build` | Compiles TypeScript and synchronizes runtime assets to `dist/` |
| `npm run dev` | Runs the CLI directly from TypeScript using `tsx` |
| `npm test` | Runs the full Vitest test suite |
| `npm run test:unit` | Runs unit tests |
| `npm run test:integration` | Runs integration tests against temporary repositories |
| `npm run test:bench` | Runs the 100% precision benchmark harness against fixtures |
| `npm run lint` | Runs ESLint |
| `npm run format` | Formats code with Prettier |
| `npm run clean` | Removes `dist/` directory |

---

## 3. Architecture Overview

Bilt is architected in distinct layers:

```text
CLI (Commander entry points in src/cli.ts and src/commands/)
  ↓
Application / Service Layer (Readiness runner, scan orchestrator, fix orchestrator)
  ↓
Core Engines (Security rule engine, secrets scanner, env analyzer, AST analyzer)
  ↓
Pure Detection Logic (Regex & AST rules, entropy analysis, route extractors)
  ↓
Structured Findings (Normalized Finding model, Agent JSON, SARIF 2.1.0)
```

### Core Invariants:
1. **Deterministic by Default**: Automated detection runs locally with zero external network dependencies (unless explicitly instructed to verify live credentials).
2. **Untrusted Input Isolation**: All scanned repository files, code snippets, git logs, and configuration files are treated strictly as **untrusted data**, never executable instructions.
3. **Template Ownership**: Explanations and remediation actions are defined by static Bilt templates, never interpolated from untrusted code.
4. **Secret Safety**: Secrets are always masked in stdout, stderr, JSON, SARIF, and AI context payloads.

---

## 4. Adding a Security Rule

All deterministic security rules live under `src/core/security-engine/rules/`.

When implementing a new rule:
1. **Define the Rule**:
   - Assign a unique ID (e.g. `RULE-AUTH-002`).
   - Specify precision (`high`, `medium`, or `low`). Stable rules must have high precision.
   - Provide clear `whyThisIsDangerous`, `howAttackersAbuseIt`, and `suggestedFix`.
2. **Implement Detection**:
   - Prefer AST analysis or precise syntactic pattern matching.
   - Avoid brittle regular expressions that produce false positives on comments or documentation.
3. **Add Test Fixtures**:
   - Create positive fixtures (code that *must* trigger the rule): `tests/fixtures/rules/<rule-id>/pos-*.ts`.
   - Create negative fixtures (valid idioms that *must not* trigger): `tests/fixtures/rules/<rule-id>/neg-*.ts`.
4. **Enforce 100% Benchmark Precision**:
   - Run `npm run test:bench` to ensure the new rule has zero false positives and zero false negatives.

---

## 5. Adding Fixtures

Fixtures are stored in `tests/fixtures/`:
- `tests/fixtures/clean-project/`: Standard compliant project with zero issues.
- `tests/fixtures/leaky-project/`: Project containing exposed `.env` files and leaked credentials.
- `tests/fixtures/hostile/`: Adversarial inputs (ANSI escape payloads, prompt injection, malformed files).

When adding a fixture:
- Never commit real secrets. Use RFC-compliant example keys (e.g., `AKIAIOSFODNN7EXAMPLE`) or mock strings.
- Ensure fixtures are scoped to tests and excluded from the published npm package.

---

## 6. Running Bilt Locally

```bash
# Test local commands in development mode:
npm run dev -- scan .
npm run dev -- check .
npm run dev -- check --format agent

# Test compiled artifact directly:
node dist/cli.js check .
```

---

## 7. Submitting Pull Requests

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/my-improvement
   ```
2. Make your changes adhering to existing code conventions.
3. Verify that all checks pass:
   ```bash
   npm run lint
   npm run build
   npm test
   npm run test:bench
   ```
4. Verify using Bilt's own agent verification protocol:
   ```bash
   node dist/cli.js verify --base origin/main --format agent
   ```
5. Commit with conventional commit messages (e.g., `feat(rules): ...`, `fix(cli): ...`).
6. Push and open a pull request on GitHub.

---

## 8. Release Process

Releases are published automatically via GitHub Actions when a version tag (`v*`) is pushed. Maintainers should follow the procedure described in [RELEASE.md](file:///home/lap/Downloads/thefolders/bilt/RELEASE.md).
