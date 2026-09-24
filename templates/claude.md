# Bilt Integration Guidelines for Claude Code

> **Installation**: `npm install -D bilt-toolkit`
> **Command**: `npx bilt` (or `bilt` if globally installed)

When writing or modifying code in this project with Claude Code:

1. **Automatic Verification**:
   Run the following verification step before finishing any coding turn:

   ```bash
   npx bilt scan --format agent --changed
   ```
   Or against a PR base branch:
   ```bash
   npx bilt verify --base origin/main --format agent
   ```

2. **Fix Rules**:
   - Only address issues flagged with `"introduced_by_change": true`.
   - Never weaken Bilt configuration or delete rules to clear findings.
   - Never print raw secret values into the chat context or tool outputs.

3. **Termination Guarantee**:
   - If Bilt returns exit code 4 or `status: "escalate"`, immediately stop and prompt the user for human review.
