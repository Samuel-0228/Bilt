import type { Engine, EngineContext } from "./types.js";
import type { ScanFinding } from "../../types/index.js";
import { SecretsEngine } from "./wrappers/secrets-engine.js";
import { SecurityRulesEngine } from "./wrappers/security-rules-engine.js";
import { ApiScanEngine } from "./wrappers/api-scan-engine.js";
import { EnvGitignoreEngine } from "./wrappers/env-gitignore-engine.js";

export class EngineRegistry {
  private engines: Map<string, Engine> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.register(new SecretsEngine());
    this.register(new SecurityRulesEngine());
    this.register(new ApiScanEngine());
    this.register(new EnvGitignoreEngine());
  }

  register(engine: Engine): void {
    this.engines.set(engine.id, engine);
  }

  get(id: string): Engine | undefined {
    return this.engines.get(id);
  }

  list(): Engine[] {
    return Array.from(this.engines.values());
  }

  async runAll(
    context: EngineContext,
    engineIds?: string[],
  ): Promise<ScanFinding[]> {
    const selected = engineIds
      ? this.list().filter((e) => engineIds.includes(e.id))
      : this.list();

    const allFindings: ScanFinding[] = [];
    for (const engine of selected) {
      try {
        const findings = await engine.analyze(context);
        allFindings.push(...findings);
      } catch (err) {
        if (context.options?.debug) {
          console.error(`Engine ${engine.id} failed:`, err);
        }
      }
    }

    return allFindings;
  }
}

export const defaultEngineRegistry = new EngineRegistry();
