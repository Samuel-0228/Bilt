Status: PARTIAL

# Dependencies

## What It Is
Managing external libraries and ensuring they are secure, up-to-date, and free of known vulnerabilities.

## Why AI-Generated Applications Often Miss It
AIs might recommend outdated libraries or completely fabricated packages (hallucinations) that do not exist, which could lead to supply chain attacks.

## Real-World Consequence
Using packages with known CVEs can compromise the entire server. Typo-squatting or hallucinated packages can introduce malicious code that steals environment variables.

## What Bilt Can Verify
Bilt provides partial automated checks and some guided procedures.

## What Bilt Cannot Verify
Bilt cannot guarantee that a zero-day vulnerability does not exist in a currently popular package.

## How an Agent Should Inspect It
The agent should review `package.json` for known deprecated or dangerous libraries, verify that lock files are used, and ensure no hallucinated packages are present.

## What a Secure Implementation Should Look Like
Regular dependency audits, usage of `npm audit` or Dependabot, strict lockfile usage, and minimal reliance on obscure third-party packages for trivial logic.
