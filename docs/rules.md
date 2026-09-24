# Bilt Rule Authoring Guide

This guide describes how to author deterministic, agent-native rules for Bilt.

## Core Philosophy: Precision Over Coverage

Bilt prioritizes **precision over recall**. Coding agents (Claude Code, Cursor, Codex) cannot reliably assess the legitimacy of noisy warnings. A single false positive can derail an agent into infinite debugging loops or incorrect workarounds.

Therefore, rules must adhere to the following invariants:

1. **Zero Guesses**: Rules must detect unambiguous, deterministic violations.
2. **Positive & Negative Fixtures**: Every rule must ship with positive (detection required) and negative (false positive avoidance required) test fixtures.
3. **Template-Owned Explanations**: Explanations and remediation instructions must be static templates owned by Bilt—never interpolated from untrusted repository content.

---

## Rule Metadata Structure

Rules must define explicit precision and maturity tiers:

```typescript
export interface RuleTemplate {
  rule_id: string; // Unique identifier, e.g., "RULE-SEC-001"
  title: string; // Human-readable title
  explanation: string; // Static explanation of the vulnerability
  agent_action: string; // Precise, unambiguous instruction for the agent
  severity: "critical" | "warning" | "info";
  precision: "high" | "medium" | "low";
  maturity: "stable" | "experimental";
  category: string;
}
```

### Precision Tiers

- **`high`**: Deterministic detection with zero known false positives. Only high-precision rules are allowed to block agent execution or produce a `fail` status.
- **`medium`**: Strong heuristic with potential context dependence (e.g. IDOR detection where role logic could be handled elsewhere). Always yields `needs_review`, never a hard `fail`.
- **`low`**: Advisory hints. Emitted as `info` or filtered out from agent blocking status.

### Maturity Lifecycle

- **`experimental`**: New rules under evaluation. Cannot produce a hard `fail`—only `needs_review`.
- **`stable`**: Graduated rules that have achieved 100% precision on the benchmark harness (`npm run test:bench`). Only `stable` + `high` rules can produce exit code 1 (`fail`).

---

## Stable Fingerprints

To prevent findings from shifting when lines above are modified by the agent, fingerprints are calculated using a SHA-256 digest of stable properties:

```typescript
sha256(
  `${rule_id}:${normalized_relative_path}:${normalized_symbol_or_context}:${normalized_code_hash}`,
);
```

- **Line Numbers Excluded**: Fingerprints are completely independent of line numbers.
- **Whitespace Invariant**: Code snippets are trimmed and whitespace-collapsed before hashing.

---

## Fixture Requirement

For every rule added, corresponding test fixtures must be created in `tests/fixtures/rules/<rule-slug>/`:

```
tests/fixtures/rules/rule-my-rule/
├── pos-1.ts   # Positive fixture 1: must trigger detection
├── pos-2.ts   # Positive fixture 2: must trigger detection
├── pos-3.ts   # Positive fixture 3: must trigger detection
├── neg-1.ts   # Negative fixture 1: safe pattern, must NOT trigger
├── neg-2.ts   # Negative fixture 2: safe pattern, must NOT trigger
└── neg-3.ts   # Negative fixture 3: edge case, must NOT trigger
```

### Benchmark Validation

Run the benchmark harness:

```bash
npm run test:bench
```

Stable rules must achieve **100% Precision** (`FP === 0`) across all fixtures.
