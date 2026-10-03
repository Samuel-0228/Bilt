# Bilt Rules for Cursor AI

> **Installation**: `npm install -D bilt-toolkit`
> **Command**: `npx bilt` (or `bilt` if globally installed)

1. Before suggesting commits or completing agent tasks, run `npx bilt verify --base origin/main --format agent` (or `npx bilt scan --format agent --changed`).
2. Resolve only findings with `"introduced_by_change": true`.
3. Do not modify Bilt ignore patterns or lower rule severities.
4. If output status is `escalate`, cease modifications and ask the user for clarification.

---

## DESIGN QUALITY REQUIREMENT

Do not default to recognizable AI-generated website patterns.

Before implementing UI:
1. inspect the existing product
2. identify the product's actual domain and users
3. use real product behavior/data as visual inspiration
4. avoid stacking generic SaaS patterns
5. avoid decorative elements without purpose
6. make loading, empty, error, success, and disabled states intentional
7. preserve accessibility
8. run `bilt design-check`
9. address design findings
10. rerun Bilt before declaring the task complete

Do not remove or weaken Bilt rules simply to obtain a passing result.

