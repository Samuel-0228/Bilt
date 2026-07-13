// ─── Terraform Plugin ────────────────────────────────────────────────────────
// Scans .tf files for hardcoded credentials and checks gitignore for tfvars.

import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  PluginManifest,
  PluginContext,
  PluginResult,
  ScanFinding,
} from "../../types/index.js";

// Patterns that match hardcoded secrets in Terraform files
const TF_SECRET_PATTERNS = [
  {
    name: "AWS access key",
    pattern:
      /access_key\s*=\s*"(?!(\$\{|var\.|local\.|data\.))(AKIA[0-9A-Z]{16})"/i,
  },
  {
    name: "AWS secret key",
    pattern:
      /secret_key\s*=\s*"(?!(\$\{|var\.|local\.|data\.))[A-Za-z0-9/+=]{40}"/,
  },
  {
    name: "password",
    pattern:
      /password\s*=\s*"(?!(\$\{|var\.|local\.|data\.|<|your_|changeme|placeholder))[^"]{6,}"/i,
  },
  {
    name: "token",
    pattern:
      /token\s*=\s*"(?!(\$\{|var\.|local\.|data\.|<|your_|changeme|placeholder))[^"]{10,}"/i,
  },
  {
    name: "private key",
    pattern: /private_key\s*=\s*"(?!(\$\{|var\.|local\.|data\.|file\())[^"]+"/i,
  },
  {
    name: "secret",
    pattern:
      /(?:client_secret|api_secret|secret_access_key)\s*=\s*"(?!(\$\{|var\.|local\.|data\.))[^"]{8,}"/i,
  },
  {
    name: "connection string",
    pattern:
      /(?:connection_string|database_url)\s*=\s*"(?!(\$\{|var\.|local\.|data\.))[^"]+:\/\/[^"]+"/i,
  },
];

const plugin: PluginManifest = {
  name: "bilt-plugin-terraform",
  version: "1.0.0",
  description:
    "Scans Terraform files for hardcoded credentials and validates .gitignore for .tfvars.",

  async check(context: PluginContext): Promise<PluginResult> {
    const findings: ScanFinding[] = [];

    // ── Find all .tf files ─────────────────────────────────────────────
    const tfFiles = context.files.filter(
      (f) => f.endsWith(".tf") || f.endsWith(".tf.json"),
    );

    for (const tfFile of tfFiles) {
      const fullPath = path.join(context.rootDir, tfFile);
      let content: string;
      try {
        content = await fs.readFile(fullPath, "utf-8");
      } catch {
        continue;
      }

      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const trimmed = line.trim();

        // Skip comments
        if (
          trimmed.startsWith("#") ||
          trimmed.startsWith("//") ||
          trimmed.startsWith("/*")
        ) {
          continue;
        }

        for (const { name, pattern } of TF_SECRET_PATTERNS) {
          if (pattern.test(trimmed)) {
            findings.push({
              id: `terraform-hardcoded-${name.replace(/\s+/g, "-")}-${tfFile}-${i + 1}`,
              severity: "critical",
              category: "plugin-finding",
              message: `Hardcoded ${name} found in Terraform file`,
              file: tfFile,
              line: i + 1,
              suggestion: `Use a Terraform variable (var.${name.replace(/\s+/g, "_")}) or environment variable instead of hardcoding the value.`,
            });
            break; // One finding per line
          }
        }
      }
    }

    // ── Check terraform.tfvars in .gitignore ───────────────────────────
    const hasTfvars = context.files.some(
      (f) =>
        f.endsWith(".tfvars") ||
        f.endsWith(".tfvars.json") ||
        path.basename(f) === "terraform.tfvars",
    );

    if (hasTfvars || tfFiles.length > 0) {
      const gitignorePath = path.join(context.rootDir, ".gitignore");
      try {
        const content = await fs.readFile(gitignorePath, "utf-8");
        const lines = content
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l !== "" && !l.startsWith("#"));

        const coversTfvars = lines.some(
          (l) =>
            l === "*.tfvars" ||
            l === "*.tfvars.json" ||
            l === "terraform.tfvars" ||
            l === "*.auto.tfvars" ||
            l === ".terraform/" ||
            l === ".terraform",
        );

        if (!coversTfvars) {
          findings.push({
            id: "terraform-gitignore-tfvars",
            severity: "warning",
            category: "plugin-finding",
            message:
              ".gitignore does not exclude *.tfvars — variable files with secrets may be committed",
            file: ".gitignore",
            suggestion:
              "Add `*.tfvars` and `*.tfvars.json` to your .gitignore to prevent committing secret variable files.",
          });
        }

        // Also check .terraform directory
        const coversTerraformDir = lines.some(
          (l) =>
            l === ".terraform" ||
            l === ".terraform/" ||
            l === ".terraform/**" ||
            l === ".terraform/*",
        );

        if (!coversTerraformDir) {
          findings.push({
            id: "terraform-gitignore-dir",
            severity: "info",
            category: "plugin-finding",
            message:
              ".gitignore does not exclude .terraform/ directory — state and providers should not be committed",
            file: ".gitignore",
            suggestion:
              "Add `.terraform/` to your .gitignore to exclude provider binaries and local state.",
          });
        }
      } catch {
        // No .gitignore at all — already covered by core scan
      }
    }

    return { findings };
  },
};

export default plugin;
