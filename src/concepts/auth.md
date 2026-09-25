Status: ENFORCED

# Authentication

## What It Is
Verifying the identity of a user or system attempting to access the application.

## Why AI-Generated Applications Often Miss It
Implementing secure authentication takes time and involves complex state management (tokens, cookies, sessions). AIs often skip it or provide completely insecure mock implementations (e.g., `userId=1`).

## Real-World Consequence
Without authentication, anyone can act as any user, leading to complete account takeovers, unauthorized data access, and lack of accountability.

## What Bilt Can Verify
Bilt can automatically verify this using static analysis and AST checks, enforcing rules across all relevant code.

## What Bilt Cannot Verify
Bilt cannot verify the complexity rules of user passwords or if multifactor authentication is fundamentally enforced by a third-party IdP correctly.

## How an Agent Should Inspect It
The agent must verify that sensitive endpoints explicitly require a verified session or token before processing logic. It should look for missing auth middlewares.

## What a Secure Implementation Should Look Like
A secure system relies on established identity providers (Auth0, Clerk, NextAuth) or robust, well-vetted libraries for session management, correctly configured with secure, HTTP-only cookies or short-lived JWTs.
