Status: PARTIAL

# Error Handling and Logs

## What It Is
Properly capturing application errors, logging them for debugging, and returning safe, non-revealing error messages to the client.

## Why AI-Generated Applications Often Miss It
AIs frequently return raw error objects directly to the user (e.g., `res.status(500).json({ error: err.message })`), which can expose stack traces and internal system details.

## Real-World Consequence
Information leakage. Attackers can use stack traces to discover the exact versions of software being used, internal file paths, or database table names, making further attacks much easier.

## What Bilt Can Verify
Bilt provides partial automated checks and some guided procedures.

## What Bilt Cannot Verify
Bilt cannot verify if your external logging service (e.g., Datadog, Sentry) is configured with the correct access controls.

## How an Agent Should Inspect It
The agent should ensure global error handlers are present and that they sanitize error messages before sending them in HTTP responses. Logs should not contain PII or secrets.

## What a Secure Implementation Should Look Like
A centralized error handler that logs full details securely on the server but returns generic messages (e.g., "An internal error occurred") to the client.
