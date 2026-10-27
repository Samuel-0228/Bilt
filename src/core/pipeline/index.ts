// ─── Analysis Pipeline Orchestrator ──────────────────────────────────────────
// Runs the multi-phase analysis pipeline: discover → extract → model → rules → findings → baseline.
// Designed to degrade gracefully when upstream modules are not yet available.
// ─────────────────────────────────────────────────────────────────────────────

import fg from 'fast-glob';
import type { PipelineOptions, PipelineResult } from './types.js';
import type { RuleFinding, ProjectModel } from '../rule-registry/types.js';
import { ruleRegistry } from '../rule-registry/index.js';
import { getGitScope, isFindingIntroducedByChange } from '../scoping/git-scope.js';
import { formatSarifOutput } from '../output/formatters/sarif.js';
import { parseInlineSuppressions } from '../trust/suppressions.js';
import { loadReadinessCache, saveReadinessCache, computeContentHash } from '../readiness/cache.js';
import { logger } from '../logging/logger.js';

const pipelineLog = logger.child('pipeline');

type PhaseStatus = 'ok' | 'skipped' | 'error';

interface PhaseRecord {
  durationMs: number;
  status: PhaseStatus;
  error?: string;
}

function phase(name: string, durationMs: number, status: PhaseStatus, error?: string): [string, PhaseRecord] {
  return [name, { durationMs, status, error }];
}

function elapsed(start: number): number {
  return Math.round(performance.now() - start);
}

function ruleFindingToSarifFinding(rf: RuleFinding): any {
  const loc = rf.locations[0] || { file: 'unknown', line: 1 };
  return {
    id: `finding-${rf.ruleId}-${Math.random().toString(36).slice(2, 9)}`,
    rule_id: rf.ruleId,
    title: rf.title,
    severity:
      rf.severity === 'critical' || rf.severity === 'high'
        ? 'critical'
        : rf.severity === 'medium'
          ? 'warning'
          : 'info',
    precision: rf.precision,
    category: rf.category,
    explanation: Array.isArray(rf.evidence) ? rf.evidence.join('\n') : String(rf.evidence || ''),
    agent_action: rf.agentObjective || '',
    introduced_by_change: rf.introduced ?? false,
    file: loc.file,
    line: loc.line ?? 1,
    end_line: loc.endLine ?? loc.line ?? 1,
    fingerprint: `${rf.ruleId}:${loc.file}:${loc.line ?? 1}`,
  };
}

/**
 * Attempt to load the ProjectModel builder. Returns null if module is unavailable.
 */
async function tryLoadBuilder(): Promise<
  | { buildProjectModel: (rootDir: string, opts?: { files?: Array<{path: string; content: string}> }) => Promise<ProjectModel> }
  | null
> {
  try {
    const mod = await import('../project-model/builder.js') as any;
    if (typeof mod.buildProjectModel === 'function') {
      return mod as { buildProjectModel: (rootDir: string, opts?: { files?: Array<{path: string; content: string}> }) => Promise<ProjectModel> };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Run the full analysis pipeline against a repository root.
 */
export async function runAnalysisPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const pipelineStart = performance.now();
  const phases: Record<string, PhaseRecord> = {};

  // ── Phase 1: Discovery ────────────────────────────────────────────────────
  const discoveryStart = performance.now();
  let discoveredFiles: string[] = [];
  let gitScope: any = null;

  try {
    if (options.changed || options.base) {
      gitScope = await getGitScope(options.rootDir, {
        changed: options.changed,
        base: options.base,
      });
    }

    if (options.files && options.files.length > 0) {
      discoveredFiles = options.files.map((f) => f.path);
    } else {
      discoveredFiles = await fg(
        ['**/*.{ts,tsx,js,jsx,css,scss,json,prisma}'],
        {
          cwd: options.rootDir,
          ignore: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/.next/**',
            '**/.git/**',
            '**/coverage/**',
          ],
          absolute: false,
        },
      );
    }

    if (gitScope && gitScope.changedFiles && gitScope.changedFiles.size > 0) {
      discoveredFiles = discoveredFiles.filter((f) =>
        gitScope.changedFiles.has(f.replace(/^[./\\]+/, '')),
      );
    }

    const [k, v] = phase('discovery', elapsed(discoveryStart), 'ok');
    phases[k] = v;
  } catch (err) {
    const [k, v] = phase('discovery', elapsed(discoveryStart), 'error', String(err));
    phases[k] = v;
    return {
      phases,
      findings: [],
      totalFilesScanned: 0,
      buildTimeMs: elapsed(pipelineStart),
    };
  }

  // ── Phase 2: Extraction ───────────────────────────────────────────────────
  const [extK, extV] = phase('extraction', 0, 'skipped');
  phases[extK] = extV;

  // ── Phase 3: Model ────────────────────────────────────────────────────────
  const modelStart = performance.now();
  let model: ProjectModel | null = null;
  try {
    const builder = await tryLoadBuilder();
    if (builder) {
      model = await builder.buildProjectModel(options.rootDir, { files: options.files });
      const [k, v] = phase('model', elapsed(modelStart), 'ok');
      phases[k] = v;
    } else {
      const [k, v] = phase('model', elapsed(modelStart), 'skipped', 'project-model/builder not available');
      phases[k] = v;

      for (const name of ['relationships', 'rules', 'findings', 'baseline']) {
        phases[name] = { durationMs: 0, status: 'skipped' };
      }

      return {
        phases,
        findings: [],
        totalFilesScanned: discoveredFiles.length,
        buildTimeMs: elapsed(pipelineStart),
      };
    }
  } catch (err) {
    const [k, v] = phase('model', elapsed(modelStart), 'error', String(err));
    phases[k] = v;
    if (options.debug) {
      pipelineLog.error('ProjectModel build failed:', err);
    }
    for (const name of ['relationships', 'rules', 'findings', 'baseline']) {
      phases[name] = { durationMs: 0, status: 'skipped' };
    }
    return {
      phases,
      findings: [],
      totalFilesScanned: discoveredFiles.length,
      buildTimeMs: elapsed(pipelineStart),
    };
  }

  // ── Phase 4: Relationships ────────────────────────────────────────────────
  phases['relationships'] = { durationMs: 0, status: 'skipped' };

  // ── Phase 5: Rules ────────────────────────────────────────────────────────
  const rulesStart = performance.now();
  let findings: RuleFinding[] = [];
  try {
    const ruleIds = options.includeCategories
      ? ruleRegistry.list()
          .filter((r) => options.includeCategories!.includes(r.category))
          .map((r) => r.id)
      : undefined;

    findings = ruleRegistry.run(model, ruleIds);

    if (gitScope) {
      for (const f of findings) {
        const file = f.locations[0]?.file || '';
        const line = f.locations[0]?.line || 1;
        f.introduced = isFindingIntroducedByChange(file, line, gitScope);
      }
    }

    const [k, v] = phase('rules', elapsed(rulesStart), 'ok');
    phases[k] = v;
  } catch (err) {
    const [k, v] = phase('rules', elapsed(rulesStart), 'error', String(err));
    phases[k] = v;
    if (options.debug) {
      pipelineLog.error('Rule evaluation failed:', err);
    }
  }

  // ── Phase 6: Findings ─────────────────────────────────────────────────────
  phases['findings'] = { durationMs: 0, status: 'ok' };

  // ── Phase 7: Baseline & Suppressions ──────────────────────────────────────
  const baselineStart = performance.now();
  if (options.suppressions !== false && findings.length > 0) {
    try {
      const activeFindings: RuleFinding[] = [];
      const fileFindingsMap = new Map<string, RuleFinding[]>();

      for (const f of findings) {
        const file = f.locations[0]?.file;
        if (file) {
          const list = fileFindingsMap.get(file) || [];
          list.push(f);
          fileFindingsMap.set(file, list);
        } else {
          activeFindings.push(f);
        }
      }

      for (const [file, fList] of fileFindingsMap.entries()) {
        const fileObj = (model as any)?.files?.find(
          (mf: any) => mf.path === file || mf.path.endsWith(file) || file.endsWith(mf.path),
        );
        if (fileObj && fileObj.content) {
          const { validSuppressions } = parseInlineSuppressions(file, fileObj.content);
          const suppressedRuleIds = new Set(validSuppressions.map((s) => s.rule_id.toUpperCase()));
          for (const f of fList) {
            if (!suppressedRuleIds.has(f.ruleId.toUpperCase())) {
              activeFindings.push(f);
            }
          }
        } else {
          activeFindings.push(...fList);
        }
      }

      findings = activeFindings;
      phases['baseline'] = { durationMs: elapsed(baselineStart), status: 'ok' };
    } catch {
      phases['baseline'] = { durationMs: elapsed(baselineStart), status: 'skipped' };
    }
  } else {
    phases['baseline'] = { durationMs: 0, status: 'skipped' };
  }

  // ── Optional SARIF Generation ─────────────────────────────────────────────
  let sarifReport: any = undefined;
  if (options.sarif) {
    try {
      const convertedFindings = findings.map(ruleFindingToSarifFinding);
      sarifReport = formatSarifOutput(convertedFindings);
    } catch (err) {
      if (options.debug) {
        pipelineLog.error('SARIF generation error:', err);
      }
    }
  }

  // ── Optional Caching ──────────────────────────────────────────────────────
  let cached = false;
  if (options.cache) {
    try {
      const cacheManifest = await loadReadinessCache(options.rootDir);
      let allMatched = discoveredFiles.length > 0;

      for (const fPath of discoveredFiles) {
        const entry = cacheManifest.files[fPath];
        if (!entry) {
          allMatched = false;
          break;
        }
      }

      cached = allMatched;

      // Update cache with current scan state
      for (const fPath of discoveredFiles) {
        cacheManifest.files[fPath] = {
          hash: computeContentHash(fPath),
          timestamp: new Date().toISOString(),
          findings: [],
        };
      }
      await saveReadinessCache(options.rootDir, cacheManifest);
    } catch {
      // non-fatal
    }
  }

  return {
    phases,
    findings,
    totalFilesScanned: discoveredFiles.length,
    buildTimeMs: elapsed(pipelineStart),
    sarifReport,
    cached,
  };
}
