import { describe, it, expect } from "vitest";
import { SecurityRuleEngine } from "../../src/core/security-engine/rule-engine.js";

describe("Security Engine Integration Tests", () => {
  it("should detect modern AI anti-patterns across a simulated project codebase", () => {
    const engine = new SecurityRuleEngine();

    const files = [
      {
        path: ".env",
        content: `
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
JWT_SECRET=super_secret_jwt_key_12345
DATABASE_URL=postgres://user:pass@localhost:5432/mydb
        `,
      },
      {
        path: ".env.example",
        content: `
JWT_SECRET=
        `,
      },
      {
        path: "src/api/auth.ts",
        content: `
import jwt from 'jsonwebtoken';

export function authenticate(req, res) {
  const token = req.headers.authorization;
  // TODO: add auth validation
  const decoded = jwt.decode(token);
  if (req.body.isAdmin) {
    const expr = req.query.expr;
    eval(expr);
  }
}
        `,
      },
      {
        path: "src/api/ai-agent.ts",
        content: `
import { exec } from 'child_process';

export async function runAgentTool(completion) {
  const aiCode = completion.choices[0].message.content;
  eval(aiCode);
  exec("ping " + completion.host);
}
        `,
      },
      {
        path: "src/components/UserAvatar.tsx",
        content: `
export function UserAvatar({ userHtml }) {
  localStorage.setItem('auth_token', 'xyz123');
  return <div dangerouslySetInnerHTML={{ __html: userHtml }} />;
}
        `,
      },
      {
        path: "Dockerfile",
        content: `
FROM node:18
WORKDIR /app
COPY .env .env
COPY . .
CMD ["node", "server.js"]
        `,
      },
    ];

    const findings = engine.analyzeProject(files, ["nextjs", "react", "express"]);
    expect(findings.length).toBeGreaterThanOrEqual(6);

    // Verify individual anti-pattern findings
    const jwtFinding = findings.find((f) => f.ruleId === "SEC-AUTH-001");
    expect(jwtFinding).toBeDefined();
    expect(jwtFinding?.severity).toBe("critical");
    expect(jwtFinding?.owaspMapping).toContain("A07:2021");

    const envExposureFinding = findings.find((f) => f.ruleId === "SEC-ENV-001");
    expect(envExposureFinding).toBeDefined();
    expect(envExposureFinding?.severity).toBe("critical");

    const evalFinding = findings.find((f) => f.ruleId === "SEC-AI-001");
    expect(evalFinding).toBeDefined();
    expect(evalFinding?.severity).toBe("critical");

    const cmdFinding = findings.find((f) => f.ruleId === "SEC-INP-002");
    expect(cmdFinding).toBeDefined();

    const xssFinding = findings.find((f) => f.ruleId === "SEC-INP-004");
    expect(xssFinding).toBeDefined();

    const dockerFinding = findings.find((f) => f.ruleId === "SEC-DOC-001");
    expect(dockerFinding).toBeDefined();
  });
});
