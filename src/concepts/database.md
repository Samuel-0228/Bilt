Status: PARTIAL

# Database Security

## What It Is
Securing data at rest and ensuring the interactions with the database are safe from injection and unauthorized structural changes.

## Why AI-Generated Applications Often Miss It
AIs sometimes construct raw SQL queries using string concatenation instead of parameterized queries. They also might expose internal database IDs or overly broad data objects to the frontend.

## Real-World Consequence
SQL injection can lead to complete database dumps. Returning too much data can expose hashed passwords or PII to the client application.

## What Bilt Can Verify
Bilt provides partial automated checks and some guided procedures.

## What Bilt Cannot Verify
Bilt cannot verify complex stored procedures or deeply nested query logic that spans multiple microservices.

## How an Agent Should Inspect It
The agent should search for raw query strings and ensure ORMs (like Prisma, Drizzle) are used correctly. It must verify that data is stripped of sensitive fields before being sent to the client.

## What a Secure Implementation Should Look Like
A secure app uses an ORM or query builder with parameterized queries exclusively. Database users follow the principle of least privilege.
