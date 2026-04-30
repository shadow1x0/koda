/**
 * Core scanner module for Koda CLI
 * Handles project directory scanning and file filtering
 */

import fs from 'node:fs';
import path from 'node:path';
import glob from 'fast-glob';
import type { FileInfo, TreeNode, ScanResult } from './types.js';
import { loadCache, saveCache, invalidateCache, createEmptyCache, cacheEntryToFileInfo, type CacheData, type CacheEntry } from './cache/index.js';

// Patterns to ignore (junk/noise files)
const IGNORE_PATTERNS = [
  'node_modules/**',
  'dist/**',
  'build/**',
  '.git/**',
  'coverage/**',
  '.next/**',
  '.nuxt/**',
  'out/**',
  '.output/**',

  // Lock files
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',

  // Binary/media files
  '**/*.png',
  '**/*.jpg',
  '**/*.jpeg',
  '**/*.gif',
  '**/*.svg',
  '**/*.ico',
  '**/*.webp',
  '**/*.mp4',
  '**/*.mov',
  '**/*.avi',
  '**/*.mp3',
  '**/*.wav',
  '**/*.ogg',
  '**/*.pdf',
  '**/*.zip',
  '**/*.tar',
  '**/*.gz',
  '**/*.rar',
  '**/*.7z',
  '**/*.exe',
  '**/*.dll',
  '**/*.so',
  '**/*.dylib',
  '**/*.bin',

  // Other
  '**/*.log',
  '.env*',
  '.DS_Store',
  'Thumbs.db',
];

// Config file patterns
const CONFIG_EXTENSIONS = ['.json', '.yaml', '.yml', '.toml', '.ini', '.conf'];
const CONFIG_FILES = [
  'package.json',
  'tsconfig.json',
  'jsconfig.json',
  'vite.config',
  'webpack.config',
  'rollup.config',
  'esbuild.config',
  'tailwind.config',
  'postcss.config',
  'babel.config',
  'eslint.config',
  'prettier.config',
  'jest.config',
  'vitest.config',
  'playwright.config',
  'next.config',
  'nuxt.config',
  'svelte.config',
  '.gitignore',
  '.dockerignore',
  'Dockerfile',
  'Makefile',
  'README.md',
  'LICENSE',
  '.editorconfig',
  '.npmrc',
];

// Source code extensions
const SOURCE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.vue',
  '.svelte',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.swift',
  '.cpp',
  '.c',
  '.h',
  '.hpp',
  '.cs',
  '.php',
  '.rb',
  '.sh',
  '.bash',
  '.zsh',
  '.ps1',
  '.md',
  '.mdx',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.html',
  '.htm',
  '.xml',
  '.sql',
];

/**
 * Determine file type based on name and extension
 */
function getFileType(fileName: string, extension: string): 'source' | 'config' | 'other' {
  const baseName = fileName.toLowerCase();

  // Check if it's a known config file
  if (CONFIG_FILES.some((config) => baseName === config.toLowerCase() || baseName.startsWith(config.toLowerCase()))) {
    return 'config';
  }

  // Check config extensions (but exclude lock files which are handled in ignore patterns)
  if (CONFIG_EXTENSIONS.includes(extension) && !fileName.endsWith('.lock')) {
    return 'config';
  }

  // Check source extensions
  if (SOURCE_EXTENSIONS.includes(extension)) {
    return 'source';
  }

  return 'other';
}

/**
 * Build a tree structure from file paths
 */
function buildTree(rootPath: string, filePaths: string[]): TreeNode {
  const rootName = path.basename(rootPath) || rootPath;
  const root: TreeNode = {
    name: rootName,
    path: rootPath,
    type: 'directory',
    children: [],
  };

  for (const filePath of filePaths) {
    const relativePath = path.relative(rootPath, filePath);
    const parts = relativePath.split(path.sep);

    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = path.join(current.path, part);

      if (isLast) {
        // It's a file
        current.children = current.children || [];
        current.children.push({
          name: part,
          path: currentPath,
          type: 'file',
        });
      } else {
        // It's a directory
        current.children = current.children || [];
        let next = current.children.find((child) => child.name === part && child.type === 'directory');
        if (!next) {
          next = {
            name: part,
            path: currentPath,
            type: 'directory',
            children: [],
          };
          current.children.push(next);
        }
        current = next;
      }
    }
  }

  return root;
}

/**
 * Sort tree nodes (directories first, then alphabetically)
 */
function sortTree(node: TreeNode): void {
  if (node.children) {
    node.children.sort((a, b) => {
      if (a.type === 'directory' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortTree);
  }
}

/**
 * Scan a project directory and return structured file information
 * Uses cache for faster subsequent runs
 */
export async function scanProject(targetPath: string, useCache: boolean = true): Promise<ScanResult> {
  const resolvedPath = path.resolve(targetPath);

  // Verify path exists
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Path does not exist: ${resolvedPath}`);
  }

  // Verify it's a directory
  const stats = fs.statSync(resolvedPath);
  if (!stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${resolvedPath}`);
  }

  // Scan all files using fast-glob
  const allFiles = await glob('**/*', {
    cwd: resolvedPath,
    absolute: true,
    ignore: IGNORE_PATTERNS,
    onlyFiles: true,
    followSymbolicLinks: false,
  });

  // Get total count including ignored (for stats)
  const rawAllFiles = await glob('**/*', {
    cwd: resolvedPath,
    absolute: true,
    onlyFiles: true,
    followSymbolicLinks: false,
  });
  const totalCount = rawAllFiles.length;
  const ignoredCount = totalCount - allFiles.length;

  // Try to load cache for faster scanning
  let cache: CacheData | null = null;
  let cachedEntries: CacheEntry[] = [];
  let staleFiles: string[] = [];
  
  if (useCache) {
    cache = await loadCache(resolvedPath);
    if (cache) {
      // Check which files are still valid
      const currentPaths = new Set(allFiles);
      const validEntries: CacheEntry[] = [];
      
      for (const [cachedPath, entry] of Object.entries(cache.files)) {
        if (currentPaths.has(cachedPath)) {
          try {
            const stats = fs.statSync(cachedPath);
            if (stats.mtimeMs === entry.mtime && stats.size === entry.size) {
              validEntries.push(entry);
            } else {
              staleFiles.push(cachedPath);
            }
          } catch {
            staleFiles.push(cachedPath);
          }
        }
      }
      
      // Find new files not in cache
      const cachedPaths = new Set(Object.keys(cache.files));
      for (const filePath of allFiles) {
        if (!cachedPaths.has(filePath)) {
          staleFiles.push(filePath);
        }
      }
      
      cachedEntries = validEntries;
    } else {
      staleFiles = allFiles;
    }
  } else {
    staleFiles = allFiles;
  }

  // Build file info list from cached + fresh data
  const files: FileInfo[] = cachedEntries.map(cacheEntryToFileInfo);
  const filePathSet = new Set<string>(files.map(f => f.path));

  // Stat only stale/new files
  for (const filePath of staleFiles) {
    try {
      const stat = fs.statSync(filePath);
      const fileName = path.basename(filePath);
      const extension = path.extname(filePath).toLowerCase();

      // Avoid duplicates
      if (!filePathSet.has(filePath)) {
        files.push({
          path: filePath,
          name: fileName,
          size: stat.size,
          extension,
          type: getFileType(fileName, extension),
        });
        filePathSet.add(filePath);
      }
    } catch {
      // Skip files we can't stat
      continue;
    }
  }

  // Separate source and config files
  const sourceFiles = files.filter((f) => f.type === 'source');
  const configFiles = files.filter((f) => f.type === 'config');

  // Build tree
  const tree = buildTree(resolvedPath, allFiles);
  sortTree(tree);

  // Save cache for faster subsequent runs
  if (useCache) {
    const newCache = createEmptyCache(resolvedPath);
    for (const file of files) {
      newCache.files[file.path] = {
        path: file.path,
        mtime: 0, // Will be filled on full extraction
        size: file.size,
        extension: file.extension,
        type: file.type,
        imports: [],
        resolvedPaths: [],
        exports: [],
        functions: [],
        classes: [],
      };
      try {
        const stats = fs.statSync(file.path);
        newCache.files[file.path].mtime = stats.mtimeMs;
      } catch {}
    }
    await saveCache(resolvedPath, newCache);
  }

  return {
    rootPath: resolvedPath,
    tree,
    files,
    sourceFiles,
    configFiles,
    ignoredCount,
    totalCount,
  };
}
