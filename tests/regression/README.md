# Bilt Regression Tests

This directory contains permanent regression tests for bugs and false positives that were discovered and resolved.

## Convention

Whenever a bug or a false positive is identified:

1. Fix the bug in the implementation code.
2. Add a corresponding test case to this directory (either in an existing file or a new `.test.ts` file).
3. The regression test must reproduce the bug scenario and assert that the fix works correctly.
4. Ensure the regression tests run as part of the CI/CD pipeline.

## Structure

- `false-positives.test.ts`: Regression tests for key patterns, false-alarm bypass rules (e.g. Supabase anon key, Stripe publishable key, inline ignore comments), and platform-specific backslash formatting.
