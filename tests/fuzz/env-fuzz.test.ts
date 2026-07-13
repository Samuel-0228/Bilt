import { describe, it, expect } from "vitest";
import { parseEnvFile, scanCodeForEnvRefs } from "../../src/core/scan/env.js";

describe("Environment Module Fuzz Tests", () => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 =#\"'-_\\\n\t";

  function generateRandomEnvContent(linesCount: number): string {
    let result = "";
    for (let i = 0; i < linesCount; i++) {
      // 10% chance of empty line
      if (Math.random() < 0.1) {
        result += "\n";
        continue;
      }
      // 10% chance of comment
      if (Math.random() < 0.1) {
        result += `# Comment ${Math.random().toString(36).slice(2)}\n`;
        continue;
      }

      // Generate key value
      const key = "KEY_" + Math.random().toString(36).slice(2, 7).toUpperCase();
      let val = "";
      const valLen = Math.floor(Math.random() * 50);
      for (let j = 0; j < valLen; j++) {
        val += chars[Math.floor(Math.random() * chars.length)];
      }

      // Handle multiline quotes or other edge cases
      if (Math.random() < 0.1) {
        result += `${key}="${val}"\n`;
      } else {
        result += `${key}=${val}\n`;
      }
    }
    return result;
  }

  it("should parse fuzz .env contents without throwing", () => {
    for (let i = 0; i < 500; i++) {
      const content = generateRandomEnvContent(
        Math.floor(Math.random() * 30) + 1,
      );
      expect(() => {
        parseEnvFile(content, `fuzz-${i}.env`);
      }).not.toThrow();
    }
  });

  it("should scan random code for env references without throwing", () => {
    for (let i = 0; i < 200; i++) {
      // Generate random code-like strings
      let code = "";
      const lines = Math.floor(Math.random() * 20) + 5;
      for (let j = 0; j < lines; j++) {
        if (Math.random() < 0.2) {
          code += `const x = process.env.${Math.random().toString(36).slice(2, 6).toUpperCase()};\n`;
        } else if (Math.random() < 0.2) {
          code += `import.meta.env.VITE_${Math.random().toString(36).slice(2, 6).toUpperCase()}\n`;
        } else {
          code += `console.log("garbage text ${Math.random()}");\n`;
        }
      }

      expect(() => {
        scanCodeForEnvRefs(code);
      }).not.toThrow();
    }
  });
});
