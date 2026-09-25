Status: ENFORCED

# Secrets and Environment Variables

## What It Is
Handling sensitive configuration like API keys, database credentials, and cryptographic secrets securely using environment variables instead of hardcoded strings.

## Why AI-Generated Applications Often Miss It
AI assistants optimize for speed and immediate "it works" functionality. Hardcoding keys or putting them in client-side code gets the app running immediately without requiring the user to set up `.env` files.

## Real-World Consequence
If secrets are committed to source control or exposed to the frontend, attackers can easily extract them, leading to data breaches, unauthorized infrastructure access, and massive financial loss.

## What Bilt Can Verify
Bilt can automatically verify this using static analysis and AST checks, enforcing rules across all relevant code.

## What Bilt Cannot Verify
Bilt cannot verify if your actual production environment variables are properly rotated or have the correct minimum permissions on the cloud provider side.

## How an Agent Should Inspect It
The agent should look for raw string literals that resemble tokens or keys. They should ensure `process.env` (or equivalent) is used correctly and never exposed to the client unnecessarily.

## What a Secure Implementation Should Look Like
A secure implementation loads all credentials dynamically at runtime from environment variables, uses tools like `dotenv` in development, and validates the configuration payload on startup.
