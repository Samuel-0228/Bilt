Status: ADVISORY

# Design & Anti-Vibecoding Quality

## What It Is
Detection and remediation of recognizable AI-generated/vibecoded website template patterns combined with verification of production UX fundamentals. The goal is NOT to judge whether a website is beautiful, but to identify measurable combinations of template tropes that make software look interchangeable, and provide AI coding agents with concrete instructions to build distinctive, product-specific interfaces.

## Why AI-Generated Applications Often Miss It
Why recognizable patterns emerge:
AI coding models default to the most frequent boilerplate patterns found in recent web repositories:
- Dark background with purple/violet glow as the default identity
- Repetitive 3-column feature cards with generic icons
- Stacking sparkle/wand icons for non-AI capabilities
- Formulaic SaaS copy ("The future of...", "Supercharge your workflow")
- Missing production states (loading, empty, error, success, mobile drawer, focus outlines)
Individual patterns are not inherently bad (e.g. a purple button or a rounded card), but stacking 6+ template tropes creates an unmistakable AI-generated look.

## Real-World Consequence
Websites that look heavily templated or "vibecoded" fail to build trust with users and customers. More critically, omitting empty states, accessible labels, or responsive navigation creates broken user experiences in production.

## What Bilt Can Verify
How Bilt detects them:
- Deterministic static analysis of JSX, TSX, Vue, Svelte, HTML, CSS, and Tailwind utility classes.
- Normalized intermediate representation (`DesignSnapshot`) tracking typography, colors, copy patterns, container nesting, icon frequency, and UX states.
- Combinations scoring (e.g. `GENERIC-SAAS-COMBINATION-001`) that flags template stacking while allowing isolated stylistic choices.
- Automated safe fixes for accessibility attributes and focus indicators.

## What Bilt Cannot Verify
What Bilt cannot judge:
- Subjective beauty, artistic taste, or creative expression.
- Whether a maximalist, brutalist, or retro aesthetic is right for your product.
- Projects intentionally choosing specific aesthetics can document exceptions in `.biltrc.json` with a required rationale.

## How an Agent Should Inspect It
How coding agents should respond:
1. Inspect the product's actual domain, core workflows, and end users before writing UI code.
2. Derive visual components from the application's real behavior (data tables, workflows, real previews) instead of generic decorative cards.
3. Verify that loading, empty, error, and disabled states exist for every interactive view.
4. Ensure icon buttons have accessible names (`aria-label`) and focus indicators are visible.
5. Run `bilt design-check --format agent` and resolve findings before completing the task.
6. If the agent loop escalator triggers (exit code 4), stop automated retries immediately and ask the user for direction.

## What a Secure Implementation Should Look Like
Examples of intentional vs template-driven design:
- Template-driven: 12 rounded cards + purple gradient text + radial background orbs + sparkle icons + bento grid + fake testimonials + dead-link CTA buttons.
- Intentional: Coherent typographic scale, domain-specific data visualization or workflow preview, authentic screenshots, intentional whitespace, complete empty/error states, and full keyboard/screen-reader accessibility.
