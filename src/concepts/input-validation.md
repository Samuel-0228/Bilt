Status: ENFORCED

# Input Validation

## What It Is
Ensuring that data received from users, APIs, or the environment strictly conforms to expected formats, types, and constraints before processing it.

## Why AI-Generated Applications Often Miss It
AIs often use generic types (`any`) or assume the client-side validation is sufficient. They try to save tokens and lines of code by blindly trusting incoming data.

## Real-World Consequence
Missing input validation leads to NoSQL/SQL injection, cross-site scripting (XSS), server crashes due to unexpected types, and massive security vulnerabilities.

## What Bilt Can Verify
Bilt can automatically verify this using static analysis and AST checks, enforcing rules across all relevant code.

## What Bilt Cannot Verify
Bilt cannot verify whether the chosen regex or specific string constraints are logically correct for your unique business domain.

## How an Agent Should Inspect It
The agent should look for endpoint payloads that are accessed without being parsed through a schema validator (like Zod, Joi, or Yup). 

## What a Secure Implementation Should Look Like
A secure implementation defines strict schema boundaries at all entry points. It uses libraries like Zod to parse and type-cast incoming requests, rejecting malformed data with generic 400 Bad Request errors.
