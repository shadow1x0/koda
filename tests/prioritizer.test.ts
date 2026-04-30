/**
 * File Prioritizer Tests
 */

import { describe, it, expect } from 'vitest';
import { rankFiles } from '../src/context/prioritizer.js';
import type { FileInfo } from '../src/types.js';

describe('File Prioritizer', () => {
  it('should rank entry points higher', () => {
    const files: FileInfo[] = [
      { path: '/src/utils.ts', name: 'utils.ts', size: 1000, extension: '.ts', type: 'source' },
      { path: '/src/cli.ts', name: 'cli.ts', size: 2000, extension: '.ts', type: 'source' },
      { path: '/src/index.ts', name: 'index.ts', size: 1500, extension: '.ts', type: 'source' },
    ];
    
    const dependencyMap = new Map<string, string[]>();
    const reverseDependencyMap = new Map<string, string[]>();
    const entryPoints = ['cli.ts', 'index.ts'];
    
    const ranked = rankFiles(files, dependencyMap, reverseDependencyMap, entryPoints);
    
    // Entry points should be at top
    expect(ranked[0].file.name).toBe('cli.ts');
    expect(ranked[0].score).toBeGreaterThan(50); // Base score + entry point bonus
    expect(ranked[0].reasons).toContain('entry point');
  });
  
  it('should rank heavily imported files higher', () => {
    const files: FileInfo[] = [
      { path: '/src/types.ts', name: 'types.ts', size: 500, extension: '.ts', type: 'source' },
      { path: '/src/utils.ts', name: 'utils.ts', size: 1000, extension: '.ts', type: 'source' },
    ];
    
    const dependencyMap = new Map<string, string[]>();
    const reverseDependencyMap = new Map<string, string[]>();
    
    // types.ts is imported by many files
    reverseDependencyMap.set('/src/types.ts', ['file1.ts', 'file2.ts', 'file3.ts', 'file4.ts', 'file5.ts', 'file6.ts']);
    
    const entryPoints: string[] = [];
    
    const ranked = rankFiles(files, dependencyMap, reverseDependencyMap, entryPoints);
    
    const typesRank = ranked.find(r => r.file.name === 'types.ts');
    expect(typesRank).toBeDefined();
    expect(typesRank!.score).toBeGreaterThan(50);
    expect(typesRank!.reasons).toContain('imported by many files');
  });
  
  it('should rank root-level files higher', () => {
    const files: FileInfo[] = [
      { path: '/deep/nested/file.ts', name: 'file.ts', size: 1000, extension: '.ts', type: 'source' },
      { path: '/src/root.ts', name: 'root.ts', size: 1000, extension: '.ts', type: 'source' },
    ];
    
    const dependencyMap = new Map<string, string[]>();
    const reverseDependencyMap = new Map<string, string[]>();
    const entryPoints: string[] = [];
    
    const ranked = rankFiles(files, dependencyMap, reverseDependencyMap, entryPoints);
    
    const rootRank = ranked.find(r => r.file.name === 'root.ts');
    const deepRank = ranked.find(r => r.file.name === 'file.ts');
    
    expect(rootRank).toBeDefined();
    expect(rootRank!.score).toBeGreaterThanOrEqual(deepRank!.score);
    expect(rootRank!.reasons).toContain('near root');
  });
  
  it('should sort by score descending', () => {
    const files: FileInfo[] = [
      { path: '/src/a.ts', name: 'a.ts', size: 1000, extension: '.ts', type: 'source' },
      { path: '/src/b.ts', name: 'b.ts', size: 1000, extension: '.ts', type: 'source' },
      { path: '/src/c.ts', name: 'c.ts', size: 1000, extension: '.ts', type: 'source' },
    ];
    
    const dependencyMap = new Map<string, string[]>();
    const reverseDependencyMap = new Map<string, string[]>();
    
    // b.ts has most imports
    reverseDependencyMap.set('/src/b.ts', ['file1', 'file2', 'file3', 'file4', 'file5', 'file6']);
    reverseDependencyMap.set('/src/a.ts', ['file1']);
    
    const entryPoints: string[] = [];
    
    const ranked = rankFiles(files, dependencyMap, reverseDependencyMap, entryPoints);
    
    // Should be sorted by score
    expect(ranked[0].file.name).toBe('b.ts');
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
    expect(ranked[1].score).toBeGreaterThanOrEqual(ranked[2].score);
  });
});
