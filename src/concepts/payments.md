Status: GUIDED

# Payments

## What It Is
Handling financial transactions and subscriptions securely, usually via third-party processors like Stripe or PayPal.

## Why AI-Generated Applications Often Miss It
AIs might generate client-side only payment logic, fail to verify webhooks cryptographically, or accidentally suggest storing raw credit card details in the database.

## Real-World Consequence
Fraud, stolen funds, and severe PCI-DSS compliance violations. Attackers could spoof webhooks to grant themselves free premium subscriptions.

## What Bilt Can Verify
Bilt verifies this through guided procedures, generating a route map and requesting evidence for each specific route.

## What Bilt Cannot Verify
Bilt cannot verify if your Stripe account is correctly configured in the dashboard or if your tax settings are accurate.

## How an Agent Should Inspect It
The agent must verify that the app never touches raw card data and that all payment webhooks have their signatures verified before taking action.

## What a Secure Implementation Should Look Like
Full reliance on a provider's hosted checkout or secure elements, robust server-side webhook verification, and idempotent processing of payment events.
