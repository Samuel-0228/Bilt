import type { Engine, EngineContext } from "../types.js";
import type { ScanFinding } from "../../../types/index.js";
import { performApiScan } from "../../api-scan/index.js";

export class ApiScanEngine implements Engine {
  id = "api-scan";
  version = "1.0.0";
  description =
    "Audits API routes, route handlers, method allowlists, and docs exposure";

  async analyze(context: EngineContext): Promise<ScanFinding[]> {
    const { findings } = await performApiScan(context.rootDir);
    return findings;
  }
}
