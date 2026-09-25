Status: GUIDED

# Authorization

## What It Is
Checking if an authenticated user actually has the permissions or ownership rights to perform a specific action on a specific resource.

## Why AI-Generated Applications Often Miss It
AIs frequently assume that if a user is logged in, they can do anything. Checking ownership (e.g., `if (post.authorId !== user.id)`) requires understanding the business logic and the specific database schema, which AIs often forget to write.

## Real-World Consequence
Insecure Direct Object Reference (IDOR). A user can delete another user's account, view private messages, or modify billing details just by changing an ID in the URL.

## What Bilt Can Verify
Bilt verifies this through guided procedures, generating a route map and requesting evidence for each specific route.

## What Bilt Cannot Verify
Bilt cannot automatically infer your business rules (e.g., whether a "Manager" role should be able to edit a specific "Draft" document).

## How an Agent Should Inspect It
The agent needs to check every route that modifies or retrieves a resource by ID. It must trace the flow to ensure the resource owner is verified against the authenticated user's ID before action is taken.

## What a Secure Implementation Should Look Like
Every data access layer call or route handler explicitly checks authorization, ideally using a centralized policy mechanism (e.g., CASL) or consistent row-level security.
