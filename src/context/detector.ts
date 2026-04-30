/**
 * Dependency Detector v1.0
 * REAL import/export analysis and dependency graph building
 */

import fs from 'node:fs';
import path from 'node:path';
import type { FileInfo } from '../types.js';
import type { DependencyEdge, ImportInfo } from './types.js';

// Patterns for detecting imports in different languages
const IMPORT_PATTERNS: Record<string, RegExp[]> = {
  '.ts': [
    /import\s+.*?\s+from\s+['"]([^'"]+)['"];?/g,
    /import\s+['"]([^'"]+)['"];?/g,
    /export\s+.*\s+from\s+['"]([^'"]+)['"];?/g,
  ],
  '.tsx': [
    /import\s+.*?\s+from\s+['"]([^'"]+)['"];?/g,
    /import\s+['"]([^'"]+)['"];?/g,
    /export\s+.*\s+from\s+['"]([^'"]+)['"];?/g,
  ],
  '.js': [
    /import\s+.*?\s+from\s+['"]([^'"]+)['"];?/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /export\s+.*\s+from\s+['"]([^'"]+)['"];?/g,
  ],
  '.jsx': [
    /import\s+.*?\s+from\s+['"]([^'"]+)['"];?/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /export\s+.*\s+from\s+['"]([^'"]+)['"];?/g,
  ],
  '.mjs': [
    /import\s+.*?\s+from\s+['"]([^'"]+)['"];?/g,
    /export\s+.*\s+from\s+['"]([^'"]+)['"];?/g,
  ],
  '.cjs': [
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ],
};

// External package indicators
const EXTERNAL_INDICATORS = [
  /^[^./]/, // Starts with letter (not relative)
  /^@[^/]+\//, // Scoped packages like @org/pkg
];

/**
 * Check if an import source is external (npm package) or local
 */
function isExternalImport(source: string): boolean {
  return EXTERNAL_INDICATORS.some((pattern) => pattern.test(source));
}

/**
 * Resolve local import path to absolute path
 * Handles TypeScript-style imports where .js resolves to .ts source
 */
function resolveImportPath(source: string, currentFile: string): string | null {
  if (isExternalImport(source)) {
    return null;
  }

  const currentDir = path.dirname(currentFile);

  // Strip .js extension if present (TypeScript allows importing .js to resolve to .ts)
  let cleanSource = source;
  if (source.endsWith('.js')) {
    cleanSource = source.slice(0, -3);
  }

  const basePath = path.resolve(currentDir, cleanSource);

  // Try extensions - prioritize TypeScript over JavaScript
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx', '/index.js', '/index.jsx', ''];

  for (const ext of extensions) {
    const tryPath = basePath + ext;
    if (fs.existsSync(tryPath)) {
      return tryPath;
    }
  }

  return null;
}

/**
 * Extract imports from a file - REAL parsing
 */
export function extractImports(file: FileInfo): ImportInfo {
  const extension = file.extension.toLowerCase();
  const patterns = IMPORT_PATTERNS[extension] || [];

  const imports: string[] = [];
  const resolvedPaths: string[] = [];

  try {
    const content = fs.readFileSync(file.path, 'utf-8');

    for (const pattern of patterns) {
      // Reset regex lastIndex
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const source = match[1];
        if (source && !imports.includes(source)) {
          imports.push(source);

          // Try to resolve local imports
          const resolved = resolveImportPath(source, file.path);
          if (resolved) {
            resolvedPaths.push(resolved);
          }
        }
      }
    }
  } catch {
    // File read error, return empty
  }

  return {
    source: file.path,
    imports,
    resolvedPaths,
    isExternal: imports.length > 0 && imports.every(isExternalImport),
  };
}

/**
 * Build REAL dependency edges from file imports
 * Returns actual edges: { from: "/project/src/cli.ts", to: "/project/src/scanner.ts" }
 */
export function buildDependencyEdges(files: FileInfo[]): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  const filePathSet = new Set<string>(); // Set of valid paths

  // Build path set for quick lookup
  for (const file of files) {
    filePathSet.add(file.path);
  }

  // Extract imports and build edges
  for (const file of files) {
    const importInfo = extractImports(file);

    for (const resolvedPath of importInfo.resolvedPaths) {
      // Only add edge if target exists in our file set
      if (filePathSet.has(resolvedPath)) {
        edges.push({
          from: file.path,      // full path as unique identifier
          to: resolvedPath,     // full path as unique identifier
        });
      }
    }
  }

  return edges;
}

/**
 * Build dependency map (path -> resolved paths)
 */
export function buildDependencyMap(files: FileInfo[]): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const file of files) {
    const importInfo = extractImports(file);
    if (importInfo.resolvedPaths.length > 0) {
      map.set(file.path, importInfo.resolvedPaths);
    }
  }

  return map;
}

/**
 * Build reverse dependency map (who imports this file)
 */
export function buildReverseDependencyMap(
  files: FileInfo[]
): Map<string, string[]> {
  const reverse = new Map<string, string[]>();
  const edges = buildDependencyEdges(files);

  for (const edge of edges) {
    const importers = reverse.get(edge.to) || [];
    if (!importers.includes(edge.from)) {
      importers.push(edge.from);
    }
    reverse.set(edge.to, importers);
  }

  return reverse;
}
