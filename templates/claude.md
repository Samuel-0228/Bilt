# Bilt Integration Guidelines for Claude Code

When writing or modifying code in this project with Claude Code:

1. **Automatic Verification**:
   Run the following verification step before finishing any coding turn:

   ```bash
   bilt scan --format agent --changed
   ```

2. **Fix Rules**:
   - Only address issues flagged with `"introduced_by_change": true`.
   - Never weaken Bilt configuration or delete rules to clear findings.
   - Never print raw secret values into the chat context or tool outputs.

3. **Termination Guarantee**:
   - If Bilt returns exit code 4 or `status: "escalate"`, immediately stop and prompt the user for human review.
