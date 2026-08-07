import { describe, it, expect } from "vitest";
import { SecurityRuleEngine } from "../../../src/core/security-engine/rule-engine.js";

describe("SecurityRuleEngine Unit Tests", () => {
  it("should evaluate file content against security rules and return explainable findings", () => {
    const engine = new SecurityRuleEngine();
    const unsafeCode = `
      import jwt from 'jsonwebtoken';

      export function handleAuth(token) {
        const payload = jwt.decode(token);
        if (payload.isAdmin) {
          eval(payload.code);
        }
      }
    `;

    const findings = engine.analyzeFile("src/auth.ts", unsafeCode);
    expect(findings.length).toBeGreaterThanOrEqual(2);

    const jwtFinding = findings.find((f) => f.ruleId === "SEC-AUTH-001");
    expect(jwtFinding).toBeDefined();
    expect(jwtFinding?.severity).toBe("critical");
    expect(jwtFinding?.owaspMapping).toContain("A07:2021");
    expect(jwtFinding?.automaticFixAvailability.available).toBe(true);

    const evalFinding = findings.find((f) => f.ruleId === "SEC-INP-001");
    expect(evalFinding).toBeDefined();
    expect(evalFinding?.severity).toBe("critical");
  });

  it("should detect client secret prefix exposures in env files", () => {
    const engine = new SecurityRuleEngine();
    const files = [
      {
        path: ".env",
        content: `
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
DATABASE_URL=postgres://localhost:5432/db
        `,
      },
      {
        path: "src/db.ts",
        content: `const url = process.env.DATABASE_URL;`,
      },
    ];

    const findings = engine.analyzeProject(files);
    const envFinding = findings.find((f) => f.ruleId === "SEC-ENV-001");
    expect(envFinding).toBeDefined();
    expect(envFinding?.severity).toBe("critical");
    expect(envFinding?.evidence.snippet).toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
  });
});
