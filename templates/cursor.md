# Bilt Rules for Cursor AI

1. Before suggesting commits or completing agent tasks, run `bilt scan --format agent --changed`.
2. Resolve only findings with `"introduced_by_change": true`.
3. Do not modify Bilt ignore patterns or lower rule severities.
4. If output status is `escalate`, cease modifications and ask the user for clarification.
