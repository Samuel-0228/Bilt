// ─── Route Map ───
import { detectApiRoutes } from '../api-scan/route-detector.js';
import type { RouteMapEntry } from './check-runner.js';
import type { APIRouteInfo } from '../api-scan/types.js';

export async function extractRouteMap(
  rootDir: string,
  files?: Array<{ path: string; content: string }>
): Promise<RouteMapEntry[]> {
  const routes: APIRouteInfo[] = await detectApiRoutes(rootDir, files);
  
  return routes.map((route: APIRouteInfo) => {
    let resourceIdParam: string | undefined = undefined;
    const match = route.path.match(/(?:\/:|\[)([\w-]+)(?:\])?/);
    if (match) {
      resourceIdParam = match[1];
    }
    
    return {
      path: route.path,
      method: route.method,
      file: route.handlerFile,
      line: route.handlerLine,
      resourceIdParam,
    };
  });
}

export function hasRouteExtractor(framework: string): boolean {
  const supportedFrameworks = ['express', 'nextjs', 'fastify', 'nestjs', 'fastapi', 'django', 'rails'];
  return supportedFrameworks.includes(framework.toLowerCase());
}
