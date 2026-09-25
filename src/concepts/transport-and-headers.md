Status: PARTIAL

# Transport and Headers

## What It Is
Securing the network layer using TLS (HTTPS) and applying security headers to protect against common web vulnerabilities.

## Why AI-Generated Applications Often Miss It
Local development happens over HTTP on localhost. AI code rarely includes proper CORS configurations, HSTS, or CSP headers because they are "production-only" concerns.

## Real-World Consequence
Man-in-the-middle (MITM) attacks, Clickjacking, and Cross-Site Scripting (XSS). Without proper CORS, malicious sites can make requests on behalf of authenticated users.

## What Bilt Can Verify
Bilt provides partial automated checks and some guided procedures.

## What Bilt Cannot Verify
Bilt cannot verify your actual SSL/TLS certificates or DNS configurations at the infrastructure level.

## How an Agent Should Inspect It
The agent should look for the usage of security middlewares (like Helmet in Express) and strict CORS configurations that do not use wildcards (`*`) for authenticated routes.

## What a Secure Implementation Should Look Like
Enforced HTTPS, strict Content-Security-Policy (CSP), proper X-Frame-Options, and a restrictive CORS policy that only allows specific origins.
