Status: GUIDED

# Monitoring and Rollback

## What It Is
Ensuring the application's health can be observed in production and that bad deployments can be reverted quickly.

## Why AI-Generated Applications Often Miss It
It requires tooling outside the codebase. AI usually stops at "the code runs", completely ignoring how to maintain it when things go wrong under load.

## Real-World Consequence
When the app crashes in production, you have no idea why. Extended downtime while you manually SSH into servers to restart processes or hunt through raw text files.

## What Bilt Can Verify
Bilt verifies this through guided procedures, generating a route map and requesting evidence for each specific route.

## What Bilt Cannot Verify
Bilt cannot verify your team's actual incident response capabilities or if your on-call alerts are routed correctly.

## How an Agent Should Inspect It
The agent should look for health check endpoints, structured logging setups, and standard APM (Application Performance Monitoring) configurations.

## What a Secure Implementation Should Look Like
A `/health` endpoint, structured JSON logs, integrated error tracking (like Sentry), and immutable infrastructure deployments that allow for 1-click rollbacks.
