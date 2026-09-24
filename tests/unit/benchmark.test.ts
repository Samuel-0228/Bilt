import { describe, it, expect } from "vitest";
import { runBenchmark } from "../bench/benchmark.js";

describe("Deterministic Precision Benchmark Harness", () => {
  it("evaluates all benchmark rules and enforces 100% precision gate on stable rules", async () => {
    const { results, allPassed, report } = await runBenchmark();

    expect(results.length).toBeGreaterThanOrEqual(6);
    expect(allPassed).toBe(true);
    expect(report).toContain("Bilt Deterministic Precision Benchmark Report");
    expect(report).toContain("ALL RULES PASSED GATE");

    for (const r of results) {
      if (r.maturity === "stable") {
        expect(r.fp).toBe(0);
        expect(r.precision).toBe(1.0);
        expect(r.passedGate).toBe(true);
      }
    }
  });
});
