/**
 * Project Cache System
 * Caches file metadata, dependencies, and content for fast subsequent runs
 */

import fs from 'node:fs';
import path from 'node:path';
import type { FileInfo } from '../types.js';
import type { ImportInfo } from '../context/types.js';

const CACHE_VERSION = '1.0';
const CACHE_DIR = '.koda';
const CACHE_FILE = 'cache.json';

export interface CacheEntry {
  path: string;
  mtime: number;
  size: number;
  extension: string;
  type: 'source' | 'config' | 'other';
  imports: string[];
  resolvedPaths: string[];
  exports: string[];
  functions: string[];
  classes: string[];
}

export interface CacheData {
  version: string;
  createdAt: string;
  projectRoot: string;
  files: Record<string, CacheEntry>;
}

/**
 * Get cache file path for a project
 */
function getCachePath(projectRoot: string): string {
  return path.join(projectRoot, CACHE_DIR, CACHE_FILE);
}

/**
 * Load cache from disk
 */
export async function loadCache(projectRoot: string): Promise<CacheData | null> {
  const cachePath = getCachePath(projectRoot);
  
  try {
    if (!fs.existsSync(cachePath)) {
      return null;
    }
    
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    
    // Version check
    if (data.version !== CACHE_VERSION) {
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
}

/**
 * Save cache to disk
 */
export async function saveCache(projectRoot: string, data: CacheData): Promise<void> {
  const cacheDir = path.join(projectRoot, CACHE_DIR);
  const cachePath = getCachePath(projectRoot);
  
  try {
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
  } catch {
    // Silent fail - caching is optional
  }
}

/**
 * Check if cache entry is still valid for a file
 */
export function isCacheValid(file: FileInfo, entry: CacheEntry): boolean {
  try {
    const stats = fs.statSync(file.path);
    return stats.mtimeMs === entry.mtime && stats.size === entry.size;
  } catch {
    return false;
  }
}

/**
 * Build cache entry from file info and extracted data
 */
export function buildCacheEntry(
  file: FileInfo, 
  importInfo: ImportInfo,
  exports: string[],
  functions: string[],
  classes: string[]
): CacheEntry {
  const stats = fs.statSync(file.path);
  
  return {
    path: file.path,
    mtime: stats.mtimeMs,
    size: stats.size,
    extension: file.extension,
    type: file.type,
    imports: importInfo.imports,
    resolvedPaths: importInfo.resolvedPaths,
    exports,
    functions,
    classes,
  };
}

/**
 * Convert cache entry back to FileInfo
 */
export function cacheEntryToFileInfo(entry: CacheEntry): FileInfo {
  return {
    path: entry.path,
    name: path.basename(entry.path),
    size: entry.size,
    extension: entry.extension,
    type: entry.type,
  };
}

/**
 * Create empty cache
 */
export function createEmptyCache(projectRoot: string): CacheData {
  return {
    version: CACHE_VERSION,
    createdAt: new Date().toISOString(),
    projectRoot,
    files: {},
  };
}

/**
 * Invalidate stale entries and return files needing refresh
 */
export function invalidateCache(cache: CacheData, currentFiles: FileInfo[]): {
  valid: CacheEntry[];
  stale: FileInfo[];
} {
  const valid: CacheEntry[] = [];
  const stale: FileInfo[] = [];
  
  for (const file of currentFiles) {
    const entry = cache.files[file.path];
    if (entry && isCacheValid(file, entry)) {
      valid.push(entry);
    } else {
      stale.push(file);
    }
  }
  
  return { valid, stale };
}
