import { describe, it, expect } from "vitest";
import { ASTAnalyzer } from "../../../src/core/security-engine/ast-analyzer.js";

describe("ASTAnalyzer Unit Tests", () => {
  it("should parse TypeScript AST and identify imports correctly", () => {
    const code = `
      import { useState } from 'react';
      import jwt from 'jsonwebtoken';

      const decoded = jwt.decode(token);
    `;
    const { sourceFile, context } = ASTAnalyzer.parse("src/app.ts", code);
    expect(sourceFile).toBeDefined();
    expect(context.imports).toHaveLength(2);
    expect(context.imports[0].source).toBe("react");
    expect(context.imports[1].source).toBe("jsonwebtoken");
  });

  it("should find call expressions matching function name patterns", () => {
    const code = `
      eval("console.log('hello')");
      jwt.decode(token);
      process.exit(1);
    `;
    const { sourceFile } = ASTAnalyzer.parse("src/test.ts", code);
    const calls = ASTAnalyzer.findCallExpressions(sourceFile, ["eval", "jwt.decode"]);
    expect(calls).toHaveLength(2);
    expect(calls[0].name).toBe("eval");
    expect(calls[1].name).toBe("jwt.decode");
  });
});
