/**
 * Content Extractor Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { extractSmartContent, estimateContentTokens } from '../src/context/extractor.js';
import type { FileInfo } from '../src/types.js';

describe('Content Extractor', () => {
  const testDir = path.join(os.tmpdir(), 'koda-test-' + Date.now());
  
  beforeAll(() => {
    fs.mkdirSync(testDir, { recursive: true });
    
    // Create test TypeScript file
    fs.writeFileSync(path.join(testDir, 'test.ts'), `
import { something } from './lib';
import * as utils from './utils';

export const MAX_RETRIES = 3;
export const TIMEOUT = 5000;

export interface Config {
  name: string;
  value: number;
}

export class MyClass {
  private data: string;
  
  constructor(data: string) {
    this.data = data;
  }
  
  public process(): string {
    return this.data.toUpperCase();
  }
}

export function processData(input: string): string {
  return input.trim().toLowerCase();
}

export async function fetchData(): Promise<string> {
  return 'data';
}
`);
  });
  
  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });
  
  it('should extract imports', () => {
    const fileInfo: FileInfo = {
      path: path.join(testDir, 'test.ts'),
      name: 'test.ts',
      size: 500,
      extension: '.ts',
      type: 'source',
    };
    
    const content = extractSmartContent(fileInfo);
    expect(content).not.toBeNull();
    expect(content!.imports.length).toBeGreaterThan(0);
    expect(content!.imports.some(i => i.includes('something'))).toBe(true);
  });
  
  it('should extract exports', () => {
    const fileInfo: FileInfo = {
      path: path.join(testDir, 'test.ts'),
      name: 'test.ts',
      size: 500,
      extension: '.ts',
      type: 'source',
    };
    
    const content = extractSmartContent(fileInfo);
    expect(content).not.toBeNull();
    expect(content!.exports.length).toBeGreaterThan(0);
    expect(content!.exports.some(e => e.includes('MAX_RETRIES'))).toBe(true);
    expect(content!.exports.some(e => e.includes('processData'))).toBe(true);
  });
  
  it('should extract function signatures', () => {
    const fileInfo: FileInfo = {
      path: path.join(testDir, 'test.ts'),
      name: 'test.ts',
      size: 500,
      extension: '.ts',
      type: 'source',
    };
    
    const content = extractSmartContent(fileInfo);
    expect(content).not.toBeNull();
    expect(content!.functions.length).toBeGreaterThan(0);
    expect(content!.functions.some(f => f.includes('processData'))).toBe(true);
  });
  
  it('should extract class declarations', () => {
    const fileInfo: FileInfo = {
      path: path.join(testDir, 'test.ts'),
      name: 'test.ts',
      size: 500,
      extension: '.ts',
      type: 'source',
    };
    
    const content = extractSmartContent(fileInfo);
    expect(content).not.toBeNull();
    expect(content!.classes.length).toBeGreaterThan(0);
    expect(content!.classes.some(c => c.includes('MyClass'))).toBe(true);
  });
  
  it('should estimate content tokens', () => {
    const content = {
      path: '/test.ts',
      header: 'export function test(): string { return "hello"; }',
      exports: ['export function test(): string'],
      imports: ['import { x } from "y"'],
      functions: ['function test(): string'],
      classes: [],
    };
    
    const tokens = estimateContentTokens(content);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBe(Math.ceil(content.header.length / 4) + Math.ceil(content.exports.join(' ').length / 4) + Math.ceil(content.functions.join(' ').length / 4));
  });
  
  it('should return null for non-existent file', () => {
    const fileInfo: FileInfo = {
      path: '/non-existent-file.ts',
      name: 'non-existent-file.ts',
      size: 0,
      extension: '.ts',
      type: 'source',
    };
    
    const content = extractSmartContent(fileInfo);
    expect(content).toBeNull();
  });
});
