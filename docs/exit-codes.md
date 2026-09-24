# Bilt CLI Exit Codes & Status Model

Bilt provides deterministic, machine-readable exit codes to enable autonomous coding agents and CI pipelines to react correctly to scan outcomes.

## Exit Codes Reference Table

| Exit Code | Status         | Meaning                                                                                                                                                                            | Recommended Action                                                                    |
| :-------: | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------ |
|   **0**   | `pass`         | **All Checks Passed**: No introduced security violations found in the evaluated diff scope.                                                                                        | Continue pipeline; task is successful.                                                |
|   **1**   | `fail`         | **Hard Failure**: One or more **stable**, **high-precision** critical security violations or configuration tampering events were introduced.                                       | Inspect `findings` array; fix the issues using the provided `agent_action` templates. |
|   **2**   | `needs_review` | **Human Review Required**: Findings were detected from experimental rules or rules requiring human context/judgment (e.g. IDOR, authorization checks). Never produces a hard fail. | Do not guess or blindly auto-modify code; ping a human engineer for review.           |
|   **3**   | `error`        | **Internal / Runtime Error**: Tool crashed, configuration was unparseable, or filesystem errors occurred.                                                                          | Check tool logs and stack trace.                                                      |
|   **4**   | `escalate`     | **Escalate to Human**: The agent has exhausted its iteration budget or repeated runs produced no progress (identical finding fingerprints).                                        | **STOP execution immediately**. Report inability to resolve to human developer.       |

---

## Honest Signaling Policy

To prevent developer fatigue and avoid autonomous agents getting stuck in destructive fix-loops:

1. **Zero Numerical Percentages**: Bilt does not emit arbitrary confidence percentages (e.g. "87% confidence").
2. **Precision Tiers**: Each rule is categorized into a precision tier:
   - `high`: Verified deterministic detection (AST node, exact regex token).
   - `medium`: Heuristic pattern detection that may require architectural context.
   - `low`: Advisory observations.
3. **Maturity Flags**:
   - `stable`: Rule has graduated the benchmark gate with 100% precision on test fixtures.
   - `experimental`: Newly introduced rule under evaluation.
4. **Hard Fail Invariant**: **Only** rules marked `stable` with `high` precision can emit exit code `1` (`fail`). All other findings emit exit code `2` (`needs_review`).
