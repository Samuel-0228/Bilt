import path from "path";
import type { ASTContext } from "./types.js";

export interface ASTNodeVisitor {
  (node: any, depth: number, parent?: any): void;
}

export class ASTAnalyzer {
  /**
   * Parses JS/TS/JSX/TSX file content into an explainable, deterministic AST structure.
   */
  public static parse(filePath: string, fileContent: string): { sourceFile: any; context: ASTContext } {
    const normPath = filePath.replace(/\\/g, "/");
    const ext = path.extname(filePath).toLowerCase();
    const isJsx = ext === ".jsx" || ext === ".tsx";

    const isFrontend =
      normPath.includes("/src/components/") ||
      normPath.includes("/pages/") ||
      normPath.includes("/app/") ||
      normPath.includes("/components/") ||
      normPath.includes("/views/") ||
      normPath.includes("/frontend/") ||
      normPath.includes("/client/") ||
      ext === ".tsx" ||
      ext === ".jsx";

    const isBackend =
      normPath.includes("/api/") ||
      normPath.includes("/server/") ||
      normPath.includes("/backend/") ||
      normPath.includes("/controllers/") ||
      normPath.includes("/routes/") ||
      normPath.includes("/services/") ||
      normPath.endsWith(".server.ts") ||
      normPath.endsWith(".server.js");

    const isConfigFile =
      normPath.includes("config") ||
      normPath.endsWith(".json") ||
      normPath.endsWith(".yml") ||
      normPath.endsWith(".yaml") ||
      normPath.endsWith(".env") ||
      normPath.endsWith("Dockerfile");

    const isTestFile =
      normPath.includes(".test.") ||
      normPath.includes(".spec.") ||
      normPath.includes("/tests/") ||
      normPath.includes("/__tests__/");

    const isDocFile =
      normPath.endsWith(".md") ||
      normPath.endsWith(".txt") ||
      normPath.endsWith(".rst");

    const frameworksDetected: string[] = [];
    if (fileContent.includes("next/") || normPath.includes("next.config")) frameworksDetected.push("nextjs");
    if (fileContent.includes("react") || isJsx) frameworksDetected.push("react");
    if (fileContent.includes("express")) frameworksDetected.push("express");
    if (fileContent.includes("@nestjs/")) frameworksDetected.push("nestjs");
    if (fileContent.includes("vite")) frameworksDetected.push("vite");
    if (fileContent.includes("astro")) frameworksDetected.push("astro");
    if (fileContent.includes("electron")) frameworksDetected.push("electron");
    if (fileContent.includes("@supabase/supabase-js")) frameworksDetected.push("supabase");
    if (fileContent.includes("firebase")) frameworksDetected.push("firebase");
    if (fileContent.includes("@prisma/client")) frameworksDetected.push("prisma");
    if (fileContent.includes("drizzle-orm")) frameworksDetected.push("drizzle");

    const imports: ASTContext["imports"] = [];
    const lines = fileContent.split("\n");

    // Extract imports cleanly via regex parser
    lines.forEach((lineText, idx) => {
      const trimmed = lineText.trim();
      if (trimmed.startsWith("import ")) {
        const line = idx + 1;
        const match = trimmed.match(/import\s+(.*?)\s+from\s+['"]([^'"]+)['"]/);
        if (match && match[1] && match[2]) {
          const clause = match[1];
          const source = match[2];
          const specifiers: string[] = [];
          let isDefault = false;

          if (clause.includes("{")) {
            const openIdx = clause.indexOf("{");
            const closeIdx = clause.indexOf("}");
            if (openIdx !== -1 && closeIdx !== -1) {
              const namedPart = clause.substring(openIdx + 1, closeIdx);
              namedPart.split(",").forEach((s) => {
                const parts = s.trim().split(" as ");
                const name = parts[0]?.trim();
                if (name) specifiers.push(name);
              });
            }
          } else {
            specifiers.push(clause.trim());
            isDefault = true;
          }

          imports.push({ source, specifiers, isDefault, line });
        }
      }
    });

    const sourceFile = {
      filePath,
      text: fileContent,
      lines,
      statements: imports.map((imp) => ({
        kind: "ImportDeclaration",
        moduleSpecifier: { text: imp.source },
        getStart: () => 0,
      })),
      getLineAndCharacterOfPosition: (pos: number) => {
        let line = 1;
        let col = 1;
        for (let i = 0; i < pos && i < fileContent.length; i++) {
          if (fileContent[i] === "\n") {
            line++;
            col = 1;
          } else {
            col++;
          }
        }
        return { line: line - 1, character: col - 1 };
      },
    };

    const context: ASTContext = {
      filePath,
      fileContent,
      isFrontend,
      isBackend,
      isConfigFile,
      isTestFile,
      isDocFile,
      frameworksDetected,
      imports,
    };

    return { sourceFile, context };
  }

  /**
   * Traverses AST statements
   */
  public static traverse(sourceFile: any, visitor: ASTNodeVisitor, depth = 0, parent?: any): void {
    visitor(sourceFile, depth, parent);
  }

  /**
   * Returns line number (1-based) and character position from AST Node or character index
   */
  public static getLineAndCol(sourceFile: any, posOrNode: number | any): { line: number; col: number } {
    if (typeof posOrNode === "number") {
      const pos = sourceFile.getLineAndCharacterOfPosition(posOrNode);
      return { line: pos.line + 1, col: pos.character + 1 };
    }
    if (posOrNode && typeof posOrNode.line === "number") {
      return { line: posOrNode.line, col: posOrNode.col || 1 };
    }
    return { line: 1, col: 1 };
  }

  /**
   * Extract code snippet corresponding to AST node
   */
  public static getSnippet(sourceFile: any, node: any): string {
    if (node && node.text) return node.text.trim();
    return "";
  }

  /**
   * Searches AST for function calls matching a specific name pattern
   */
  public static findCallExpressions(
    sourceFile: any,
    funcNames: string[]
  ): Array<{ node: any; name: string; line: number; col: number; text: string }> {
    const results: Array<{ node: any; name: string; line: number; col: number; text: string }> = [];
    const lines = sourceFile.text ? sourceFile.text.split("\n") : [];

    lines.forEach((lineText: string, idx: number) => {
      const lineNum = idx + 1;
      funcNames.forEach((fn) => {
        if (lineText.includes(`${fn}(`)) {
          results.push({
            node: { text: lineText.trim(), line: lineNum },
            name: fn,
            line: lineNum,
            col: lineText.indexOf(`${fn}(`) + 1,
            text: lineText.trim(),
          });
        }
      });
    });

    return results;
  }

  /**
   * Checks if an AST node is preceded by or wrapped in an auth check block
   */
  public static hasEnclosingAuthCheck(sourceFile: any, node: any): boolean {
    const text = sourceFile.text || "";
    const lower = text.toLowerCase();
    return (
      lower.includes("requireauth") ||
      lower.includes("authenticate") ||
      lower.includes("checkpermission") ||
      lower.includes("verifytoken") ||
      lower.includes("withauth")
    );
  }
}
