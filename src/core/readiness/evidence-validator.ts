// ─── Evidence Validator ───
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { RouteMapEntry } from './check-runner.js';
import type { GuidedEvidence } from './evidence.js';

export interface ValidationResult {
  valid: boolean;
  heuristicsFailed: string[];
  warnings: string[];
}

// Heuristic 1: Completeness — evidence route count vs RouteMap count
export function checkCompleteness(
  evidence: GuidedEvidence[],
  routeMap: RouteMapEntry[]
): { passed: boolean; message: string } {
  const evidenceRoutes = new Set(evidence.filter(e => e.route).map(e => e.route));
  if (evidenceRoutes.size < routeMap.length) {
    return { passed: false, message: `Evidence incomplete: covered ${evidenceRoutes.size} routes, expected ${routeMap.length}` };
  }
  return { passed: true, message: 'All routes covered by evidence' };
}

// Heuristic 2: Uniqueness — identical evidence_location across different routes
export function checkUniqueness(
  evidence: GuidedEvidence[]
): { passed: boolean; message: string } {
  const locations = new Set<string>();
  for (const e of evidence) {
    if (e.evidence_location) {
      if (locations.has(e.evidence_location)) {
        return { passed: false, message: `Duplicate evidence location found: ${e.evidence_location}` };
      }
      locations.add(e.evidence_location);
    }
  }
  return { passed: true, message: 'All evidence locations are unique' };
}

// Heuristic 3: Existence — file:line resolves to real location
export async function checkExistence(
  evidence: GuidedEvidence[],
  rootDir: string
): Promise<{ passed: boolean; message: string; invalidLocations: string[] }> {
  const invalidLocations: string[] = [];
  for (const e of evidence) {
    if (e.evidence_location) {
      const parts = e.evidence_location.split(':');
      const file = parts[0];
      const lineStr = parts[1];
      if (!file) {
        invalidLocations.push(e.evidence_location);
        continue;
      }
      const fullPath = path.resolve(rootDir, file);
      try {
        const content = await fs.readFile(fullPath, 'utf8');
        const lines = content.split('\n');
        const line = lineStr ? parseInt(lineStr, 10) : NaN;
        if (isNaN(line) || line < 1 || line > lines.length) {
          invalidLocations.push(e.evidence_location);
        }
      } catch {
        invalidLocations.push(e.evidence_location);
      }
    }
  }
  
  if (invalidLocations.length > 0) {
    return { passed: false, message: `Found ${invalidLocations.length} invalid evidence locations`, invalidLocations };
  }
  return { passed: true, message: 'All evidence locations exist', invalidLocations: [] };
}

// Heuristic 4: Timing — evidence produced too fast (soft warning only)
export function checkTiming(
  evidence: GuidedEvidence[],
  startTime: string,
  endTime: string
): { warning: boolean; message: string } {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const delta = (end - start) / 1000;
  
  if (evidence.length > 20 && delta < 30) {
    return { warning: true, message: `Evidence produced suspiciously fast: ${evidence.length} items in ${delta} seconds` };
  }
  return { warning: false, message: 'Timing is reasonable' };
}

// Combined validator
export async function validateEvidenceFabrication(
  evidence: GuidedEvidence[],
  routeMap: RouteMapEntry[],
  rootDir: string,
  timing?: { startTime: string; endTime: string }
): Promise<ValidationResult> {
  const heuristicsFailed: string[] = [];
  const warnings: string[] = [];
  
  const completeness = checkCompleteness(evidence, routeMap);
  if (!completeness.passed) heuristicsFailed.push('Completeness');
  
  const uniqueness = checkUniqueness(evidence);
  if (!uniqueness.passed) heuristicsFailed.push('Uniqueness');
  
  const existence = await checkExistence(evidence, rootDir);
  if (!existence.passed) heuristicsFailed.push('Existence');
  
  if (timing) {
    const timingCheck = checkTiming(evidence, timing.startTime, timing.endTime);
    if (timingCheck.warning) warnings.push('Timing');
  }
  
  return {
    valid: heuristicsFailed.length === 0,
    heuristicsFailed,
    warnings
  };
}
