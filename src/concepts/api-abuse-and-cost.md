Status: GUIDED

# API Abuse and Cost Control

## What It Is
Protecting your endpoints against excessive requests, brute-force attacks, and massive payloads that could drain resources or rack up huge cloud bills.

## Why AI-Generated Applications Often Miss It
AI developers don't pay the cloud bills. They build for a single user testing on localhost, ignoring the realities of bots, scrapers, and malicious actors on the public internet.

## Real-World Consequence
Denial of Wallet attacks, server downtime, and degraded performance for legitimate users. Unbounded loops or large LLM calls can bankrupt a project overnight.

## What Bilt Can Verify
Bilt verifies this through guided procedures, generating a route map and requesting evidence for each specific route.

## What Bilt Cannot Verify
Bilt cannot accurately determine if a specific rate limit (e.g., 100 vs 1000 requests per minute) is appropriate for your specific use case.

## How an Agent Should Inspect It
The agent should identify endpoints that do expensive work (e.g., DB writes, LLM generation, sending emails) and verify that rate limiters and payload size limits are in place.

## What a Secure Implementation Should Look Like
Use standard rate-limiting middleware, enforce strict payload size limits (`express.json({ limit: '10kb' })`), and use circuit breakers for expensive third-party API calls.
