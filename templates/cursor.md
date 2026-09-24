# Bilt Rules for Cursor AI

> **Installation**: `npm install -D bilt-toolkit`
> **Command**: `npx bilt` (or `bilt` if globally installed)

1. Before suggesting commits or completing agent tasks, run `npx bilt verify --base origin/main --format agent` (or `npx bilt scan --format agent --changed`).
2. Resolve only findings with `"introduced_by_change": true`.
3. Do not modify Bilt ignore patterns or lower rule severities.
4. If output status is `escalate`, cease modifications and ask the user for clarification.
