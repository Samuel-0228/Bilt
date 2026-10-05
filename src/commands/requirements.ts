// ─── Command: bilt requirement ────────────────────────────────────────────────
// Manage project contract requirements stored in `.bilt/requirements.json`.
// ─────────────────────────────────────────────────────────────────────────────

import path from "node:path";
import {
  loadRequirementsContract,
  upsertRequirement,
  removeRequirement,
  type Requirement,
  type RequirementType,
  type RequirementPriority,
} from "../core/contract/requirements.js";
import { validateProjectDirectory } from "../core/safety/index.js";
import { colors, glyphs, sectionHeader } from "../ui/theme.js";

export interface RequirementCommandOptions {
  id?: string;
  description?: string;
  type?: string;
  priority?: string;
  target?: string;
  format?: "human" | "agent" | "json";
}

export async function executeRequirement(
  dir: string = ".",
  subcommand: string = "list",
  options: RequirementCommandOptions = {},
): Promise<number> {
  const targetDir = await validateProjectDirectory(dir);
  const format = options.format || "human";
  const sub = (subcommand || "list").toLowerCase();

  if (sub === "add" || sub === "set") {
    if (!options.id || !options.description) {
      if (format === "human") {
        console.error(colors.pulseCoral.bold("Error: --id and --description are required to add a requirement."));
      } else {
        console.log(JSON.stringify({ error: "--id and --description are required" }));
      }
      return 1;
    }

    const req: Requirement = {
      id: options.id,
      description: options.description,
      type: (options.type as RequirementType) || "functional",
      priority: (options.priority as RequirementPriority) || "high",
      source: "developer",
      targetFiles: options.target ? options.target.split(",").map((s) => s.trim()) : undefined,
    };

    const updated = await upsertRequirement(targetDir, req);

    if (format === "agent" || format === "json") {
      console.log(JSON.stringify({ status: "success", requirement: req, total: updated.requirements.length }, null, 2));
    } else {
      console.log(colors.mintClear.apply(`  ${glyphs.fixed} Added requirement ${req.id}: "${req.description}"`));
    }
    return 0;
  }

  if (sub === "remove" || sub === "delete") {
    if (!options.id) {
      if (format === "human") {
        console.error(colors.pulseCoral.bold("Error: --id is required to remove a requirement."));
      } else {
        console.log(JSON.stringify({ error: "--id is required" }));
      }
      return 1;
    }

    const updated = await removeRequirement(targetDir, options.id);

    if (format === "agent" || format === "json") {
      console.log(JSON.stringify({ status: "success", removedId: options.id, total: updated.requirements.length }, null, 2));
    } else {
      console.log(colors.mintClear.apply(`  ${glyphs.fixed} Removed requirement ${options.id}`));
    }
    return 0;
  }

  // Default: list / show
  const contract = await loadRequirementsContract(targetDir);

  if (format === "agent" || format === "json") {
    console.log(JSON.stringify(contract, null, 2));
  } else {
    console.log("");
    console.log(sectionHeader("Project Requirements Contract"));
    if (contract.requirements.length === 0) {
      console.log(colors.slateDim.dim("  No structured requirements configured in .bilt/requirements.json"));
      console.log(colors.slateDim.dim("  Add one with: bilt requirement add --id REQ-AUTH-001 --description 'Users must authenticate'"));
    } else {
      for (const r of contract.requirements) {
        console.log(`  ${colors.vitalTeal.bold(r.id)} [${r.type}/${r.priority}]: ${r.description}`);
        if (r.targetFiles) {
          console.log(colors.slateDim.dim(`    Targets: ${r.targetFiles.join(", ")}`));
        }
      }
    }
    console.log("");
  }

  return 0;
}
