Status: ADVISORY

# Design Genericity & Anti-Vibecoding

## What It Is
Detection and avoidance of recognizable AI-generated/vibecoded website template patterns and verification of production UX fundamentals. The goal is NOT to decide whether a website is beautiful, but to detect recognizable template patterns that frequently make AI-built websites look interchangeable and give coding agents actionable recommendations to make the interface intentional, product-specific, and distinctive.

## Why AI-Generated Applications Often Miss It
Why recognizable patterns emerge:
AI agents default to pervasive boilerplate templates: purple-and-black styling, radial orbs, bento grids, repetitive three-column feature cards, sparkle icons, and generic copy formulas. Isolated patterns are not inherently bad; stacking multiple recognizable template patterns together triggers genericity warnings.

## Real-World Consequence
Stacking generic template patterns produces interfaces that look untrustworthy, prototype-like, or artificial to discerning users. Missing UX states and inaccessible controls break user workflows and create legal or usability blockers.

## What Bilt Can Verify
How Bilt detects them:
Static analysis of JSX/TSX/CSS files building a normalized `DesignSnapshot` tracking measurable evidence counts (gradients, icons, card nesting, copy formulas, missing production states). Independent rules and combination detectors evaluate the snapshot deterministically.

## What Bilt Cannot Verify
What Bilt cannot judge:
Bilt does NOT judge subjective beauty, artistic intent, brand taste, or emotional resonance. It does not enforce a single visual style. Documented exceptions with reasons can be specified in `.biltrc.json`.

## How an Agent Should Inspect It
How agents should respond:
1. Identify the product's actual domain and users.
2. Use real product behavior and data as visual inspiration rather than generic decorative elements.
3. Ensure essential production states (loading, empty, error, disabled) are intentional.
4. Run `bilt design-check` and address findings before declaring completion.

## What a Secure Implementation Should Look Like
Examples of intentional vs template-driven design:
- Template-driven: Formulaic hero + 3-card grid + glowing borders + fake testimonials + generic SaaS slogans.
- Intentional: Purposeful layout structured around real user tasks, clear visual hierarchy, authentic product previews, and verified accessibility.
