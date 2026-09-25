Status: GUIDED

# Privacy and PII

## What It Is
Properly handling Personally Identifiable Information (PII) according to legal and ethical standards (e.g., GDPR, CCPA).

## Why AI-Generated Applications Often Miss It
AIs don't have a concept of privacy laws. They log everything for debugging purposes, accidentally writing user emails, physical addresses, or passwords to standard out.

## Real-World Consequence
Severe legal fines, loss of user trust, and major privacy violations when logs are inevitably aggregated in a centralized, less-secure logging platform.

## What Bilt Can Verify
Bilt verifies this through guided procedures, generating a route map and requesting evidence for each specific route.

## What Bilt Cannot Verify
Bilt cannot provide legal advice or verify if your application's privacy policy accurately reflects your code.

## How an Agent Should Inspect It
The agent should look for aggressive logging of user objects and ensure that data models containing PII have mechanisms for deletion (right to be forgotten).

## What a Secure Implementation Should Look Like
Minimal data collection, strict masking or redaction of PII in logs, and clear procedures/endpoints for data export and account deletion.
