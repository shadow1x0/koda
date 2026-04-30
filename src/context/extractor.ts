/**
 * Smart Content Extractor
 * Extracts headers, exports, functions, classes from source files
 */

import fs from 'node:fs';
import type { FileInfo } from '../types.js';

export interface FileContent {
  path: string;
  header: string;
  exports: string[];
  imports: string[];
  functions: string[];
  classes: string[];
  configValues?: Record<string, string>;
}

// Extraction patterns for TypeScript/JavaScript
const PATTERNS = {
  imports: /^(import|require)\s+.*/gm,
  exports: /^(export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type)\s+(\w+))/gm,
  functions: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/gm,
  classes: /^(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/gm,
  constExports: /export\s+const\s+(\w+)\s*=\s*([^;\n]+)/g,
  methodSignatures: /^(?:public|private|protected|readonly)?\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*:\s*\w+/gm,
};

/**
 * Extract smart content from a file
 */
export function extractSmartContent(file: FileInfo, maxLines: number = 50): FileContent | null {
  try {
    const content = fs.readFileSync(file.path, 'utf-8');
    const lines = content.split('\n');
    
    // Extract header (first N lines, stopping at first blank line after imports)
    const header = extractHeader(lines, maxLines);
    
    // Extract imports
    const imports = extractMatches(content, PATTERNS.imports);
    
    // Extract exports
    const exports = extractMatches(content, PATTERNS.exports);
    
    // Extract function signatures
    const functions = extractMatches(content, PATTERNS.functions).slice(0, 10);
    
    // Extract class declarations
    const classes = extractMatches(content, PATTERNS.classes).slice(0, 5);
    
    // Extract exported constants with values
    const configValues = extractConfigValues(content);
    
    return {
      path: file.path,
      header,
      exports,
      imports: imports.slice(0, 20),
      functions,
      classes,
      configValues,
    };
  } catch {
    return null;
  }
}

function extractHeader(lines: string[], maxLines: number): string {
  const headerLines: string[] = [];
  let inImports = true;
  let blankCount = 0;
  
  for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
    const line = lines[i];
    
    // Always include import lines
    if (line.match(/^(import|require|export)\s+/)) {
      headerLines.push(line);
      inImports = true;
      continue;
    }
    
    // Include comments at the top
    if (line.match(/^\s*(\/\/|\/\*|\*)/)) {
      headerLines.push(line);
      continue;
    }
    
    // Stop after blank lines following imports
    if (line.trim() === '') {
      blankCount++;
      if (blankCount > 1 && !inImports) break;
      headerLines.push(line);
      continue;
    }
    
    // Include first few non-blank lines after imports
    if (inImports && line.trim()) {
      inImports = false;
    }
    
    headerLines.push(line);
    
    // Stop at first function/class body
    if (line.match(/^(export\s+)?(function|class|const|let|var|interface|type)\s+\w+/)) {
      // Include this line but check if next is opening brace
      if (lines[i + 1]?.includes('{')) {
        headerLines.push(lines[i + 1]);
        break;
      }
    }
  }
  
  return headerLines.join('\n');
}

function extractMatches(content: string, pattern: RegExp): string[] {
  const matches: string[] = [];
  let match;
  pattern.lastIndex = 0;
  while ((match = pattern.exec(content)) !== null) {
    const line = match[0].trim();
    if (!matches.includes(line)) {
      matches.push(line);
    }
  }
  return matches;
}

function extractConfigValues(content: string): Record<string, string> | undefined {
  const config: Record<string, string> = {};
  let match;
  
  PATTERNS.constExports.lastIndex = 0;
  while ((match = PATTERNS.constExports.exec(content)) !== null) {
    const name = match[1];
    const value = match[2].trim();
    // Only include primitive values and short strings
    if (value.length < 100 && !value.includes('(')) {
      config[name] = value;
    }
  }
  
  return Object.keys(config).length > 0 ? config : undefined;
}

/**
 * Estimate tokens for file content
 */
export function estimateContentTokens(content: FileContent): number {
  const text = content.header + content.exports.join(' ') + content.functions.join(' ');
  return Math.ceil(text.length / 4);
}
