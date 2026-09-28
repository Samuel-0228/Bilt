// ─── Plugin Management Command ─────────────────────────────────────────────
// Supports plugin management: bilt plugin install <name>, list, create <name>.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../config/config.js";
import { colors, glyphs } from "../ui/theme.js";
import { validateProjectDirectory, isPathContained } from "../core/safety/index.js";

export async function executePlugin(
  action: string,
  pluginName?: string,
  options: { dir?: string } = {},
): Promise<void> {
  const rootDir = await validateProjectDirectory(options.dir || ".");

  if (action === "list") {
    const config = await loadConfig(rootDir);
    console.log("");
    console.log(colors.vitalTeal.bold("  BILT PLUGINS (Experimental)"));
    console.log("");
    console.log("  Official Installed Plugins:");
    console.log(`    • ${colors.mintClear.apply("docker")} (built-in Docker & container auditor)`);
    console.log(`    • ${colors.mintClear.apply("terraform")} (built-in HCL & Infrastructure auditor)`);
    console.log(`    • ${colors.mintClear.apply("prisma")} (built-in Prisma schema auditor)`);
    console.log("");

    if (config.plugins.length === 0) {
      console.log(colors.slateDim.dim("  No third-party plugins configured in .biltrc.json"));
    } else {
      console.log("  Configured Plugins:");
      for (const p of config.plugins) {
        console.log(`    • ${colors.vitalTeal.apply(p)}`);
      }
    }
    console.log("");
    return;
  }

  if (action === "install") {
    if (!pluginName || pluginName.trim() === "") {
      throw new Error("Please specify a plugin name: bilt plugin install <name>");
    }

    const configPath = path.join(rootDir, ".biltrc.json");
    let config: any = { plugins: [] };
    try {
      const content = await fs.readFile(configPath, "utf-8");
      config = JSON.parse(content);
    } catch {
      // File doesn't exist
    }

    if (!Array.isArray(config.plugins)) {
      config.plugins = [];
    }

    if (!config.plugins.includes(pluginName)) {
      config.plugins.push(pluginName);
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
      console.log("");
      console.log(colors.mintClear.apply(`  ${glyphs.fixed} Installed plugin "${pluginName}" in .biltrc.json`));
      console.log("");
    } else {
      console.log(`  Plugin "${pluginName}" is already installed.`);
    }
    return;
  }

  if (action === "create") {
    if (!pluginName || pluginName.trim() === "") {
      throw new Error("Please specify a plugin name: bilt plugin create <name>");
    }

    const safeName = pluginName.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safeName) {
      throw new Error(`Invalid plugin name "${pluginName}". Plugin name must contain alphanumeric characters.`);
    }

    const filename = `bilt-plugin-${safeName}.ts`;
    const targetPath = path.join(rootDir, filename);

    if (!isPathContained(targetPath, rootDir)) {
      throw new Error(`Plugin destination escapes root directory: ${targetPath}`);
    }

    const scaffold = `// ─── Custom Bilt Plugin: ${safeName} ──────────────────────────────────────
import type { PluginManifest, PluginContext, PluginResult, ScanFinding } from "bilt-toolkit";

const plugin: PluginManifest = {
  name: "bilt-plugin-${safeName}",
  version: "1.0.0",
  description: "Custom health check plugin for ${safeName}",

  async check(context: PluginContext): Promise<PluginResult> {
    const findings: ScanFinding[] = [];

    // Implement custom repository health checks here

    return { findings };
  },
};

export default plugin;
`;

    await fs.writeFile(targetPath, scaffold, "utf-8");
    console.log("");
    console.log(colors.mintClear.apply(`  ${glyphs.fixed} Scaffolded plugin: ${targetPath}`));
    console.log(colors.slateDim.dim(`  Register it by running: bilt plugin install ./${filename}`));
    console.log("");
    return;
  }

  throw new Error(`Unknown plugin action "${action}". Available actions: list, install <name>, create <name>`);
}
