# Security Policy

Bilt Toolkit takes the security of its scanner and user repositories very seriously. As a tool designed to discover secrets, detect security vulnerabilities, and evaluate production readiness, we hold our own codebase to the highest security standards.

## Supported Versions

Only the latest release of Bilt Toolkit is supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| < 1.1.0 | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability or sensitive bug in Bilt Toolkit (such as arbitrary code execution vectors, secret leakage, or bypass vulnerabilities), please report it responsibly:

- **Email**: Send details directly to `samuelnaod3@gmail.com` with the subject line `[SECURITY] Vulnerability Report in Bilt Toolkit`.
- **GitHub Private Vulnerability Reporting**: You may also submit reports via the [Security Advisories tab](https://github.com/Samuel-0228/bilt/security/advisories) on GitHub.

**Please do not open a public GitHub issue for security vulnerabilities.**

### What to Include in Your Report

To help us investigate and triage quickly, please include:
1. **Description**: Clear description of the vulnerability and its potential impact.
2. **Steps to Reproduce**: Minimal reproduction steps, including commands run and any repository structure or config needed.
3. **Proof of Concept**: A minimal, non-destructive test case or code snippet.
4. **Environment**: Operating system, Node.js version, and `bilt --version`.
5. **Mitigation**: Any suggested patch or remediation steps if available.

### What NOT to Publicly Disclose

- Do not publish functional exploit code targeting Bilt users.
- Do not disclose unpatched vulnerabilities on social media, public issue trackers, or forums before a coordinated fix is released.

## Response Process & SLA

1. **Initial Response**: We acknowledge receipt of vulnerability reports within 48 hours.
2. **Assessment & Triage**: We assess severity and confirm reproduction within 5 business days.
3. **Patch & Release**: Critical security fixes are prioritized for immediate patch release.
4. **Public Credit**: We gladly credit security researchers in our release notes and changelog once the fix is deployed.
