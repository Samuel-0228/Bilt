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

---

## DESIGN BRIEF & HUMAN-INTENT BOUNDARIES

Bilt uses a Design Brief (`.bilt/design-brief.json`) to capture authentic human design intent before UI implementation.

1. **Explicit Human-in-the-Loop Checkpoint**: The design brief represents authentic human intent. **NEVER** guess, infer from files, or autonomously synthesize fake design choices to create `.bilt/design-brief.json`.
2. **When `.bilt/design-brief.json` is not configured (`configured: false`)**:
   - Query: `npx bilt design-brief --format agent`
   - If the user asked you to use, set up, or follow a design brief: **PAUSE execution immediately** and ask the developer these 4 questions in chat:
     1. **Purpose & Audience**: What is the main purpose of this product, and who is it for?
     2. **Visual Direction**: What visual direction do you prefer? (Minimal, Bold, Technical, Playful, Luxury, Brutalist, 'Surprise me', or Custom)
     3. **Brand Colors**: Do you have specific brand colors or visual references? (Hex codes, color names, or 'Surprise me')
     4. **Desired Feeling**: When someone opens this, what should they feel? (Trustworthy, calm, energetic, technical, or 'Surprise me')
   - After the developer responds, record their authentic answers using:
     ```bash
     npx bilt design-brief set --purpose "..." --visual "..." --colors "..." --feeling "..."
     ```
     *(or write `.bilt/design-brief.json` directly)*.
   - If the user did NOT request a design brief: design creativity remains agent-controlled. Proceed using your best judgment while verifying with `npx bilt design-check`.
3. **When `.bilt/design-brief.json` is configured (`configured: true`)**:
   - Query: `npx bilt design-brief --format agent` to read the developer's authentic constraints.
   - Respect creative freedom where fields are marked "Surprise me" (`creative-freedom`).
   - Run `npx bilt design-check` after UI changes.

