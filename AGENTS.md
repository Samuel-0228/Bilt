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

1. **Only fix what you introduced**: Focus exclusively on findings where `"introduced_by_change": true`. Do not rewrite pre-existing repository debt unless explicitly requested.
2. **Never weaken security configs**: Do not modify `.biltrc.json`, tamper with security rules, or add blanket `.gitignore` patterns to bypass checks. Bilt's tamper detector will fail the build with a hard `fail`.
3. **Respect loop escalation**: If Bilt returns exit code `4` (`status: "escalate"`), do not loop or retry. Stop and ask the human maintainer for guidance.
