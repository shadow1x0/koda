/**
 * Simple Ranking Engine
 * Rules-based: imports count, execution path, depth
 */

import type { FileInfo } from '../types.js';

// Simple scoring - higher = more important
export interface RankedFile {
  file: FileInfo;
  score: number;
  reasons: string[];
}

const ENTRY_PATTERNS = [
  /^cli\.(ts|js|mjs)$/i,
  /^index\.(ts|js|mjs)$/i,
  /^main\.(ts|js|mjs)$/i,
  /^server\.(ts|js)$/i,
];

export function rankFiles(
  files: FileInfo[],
  dependencyMap: Map<string, string[]>,
  reverseDependencyMap: Map<string, string[]>,
  entryPoints: string[]
): RankedFile[] {
  return files.map(file => {
    let score = 50;
    const reasons: string[] = [];

    const imports = dependencyMap.get(file.path) || [];
    const importedBy = reverseDependencyMap.get(file.path) || [];

    // 1. Import count (heavily imported = important)
    if (importedBy.length > 5) {
      score += 20;
      reasons.push('imported by many files');
    } else if (importedBy.length > 2) {
      score += 10;
      reasons.push('imported by several files');
    } else if (importedBy.length > 0) {
      score += 5;
    }

    // 2. Execution path (is it an entry point?)
    const isEntry = ENTRY_PATTERNS.some(p => p.test(file.name)) || 
                    entryPoints.includes(file.name);
    if (isEntry) {
      score += 25;
      reasons.push('entry point');
    }

    // 3. Depth (root files more important)
    const depth = file.path.split('/').length;
    if (depth <= 3) {
      score += 10;
      reasons.push('near root');
    } else if (depth > 6) {
      score -= 5;
    }

    // 4. In execution path (connected to entry)
    const inExecutionPath = entryPoints.some(entry => {
      const entryImports = dependencyMap.get(entry) || [];
      return entryImports.some(imp => file.path.includes(imp));
    });
    if (inExecutionPath && !isEntry) {
      score += 15;
      reasons.push('in execution path');
    }

    return { file, score: Math.min(100, score), reasons };
  }).sort((a, b) => b.score - a.score);
}
