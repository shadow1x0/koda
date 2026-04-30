/**
 * File Intelligence Layer v1.1
 * Evidence-based semantic reasoning
 */

import fs from 'node:fs';
import path from 'node:path';
import type { FileInfo } from '../types.js';

// Entry point detection patterns
const ENTRY_INDICATORS = [
  /^cli\./i,
  /^index\./i,
  /^main\./i,
];

/**
 * Check if file is an entry point
 */
function isEntryPoint(fileName: string): boolean {
  return ENTRY_INDICATORS.some(p => p.test(fileName));
}

/**
 * Evidence-based file analysis result
 */
export interface FileAnalysis {
  role: string;
  description: string;
  evidence: string[];
}

/**
 * Analyze file and generate evidence-based description
 */
export function analyzeFile(
  file: FileInfo,
  imports: string[],
  importedBy: string[]
): FileAnalysis {
  const evidence: string[] = [];
  let role = 'Support Module';
  let description = 'Source file';

  const baseName = file.name.toLowerCase();
  const ext = file.extension.toLowerCase();

  // Entry point detection
  if (isEntryPoint(file.name)) {
    role = 'Entry Point';
    evidence.push(`filename matches entry pattern: ${file.name}`);

    if (imports.length > 0) {
      const importNames = imports.slice(0, 3).map(p => path.basename(p, path.extname(p)));
      description = `Application entry point that orchestrates ${importNames.join(', ')} modules`;
      evidence.push(`imports ${imports.length} modules: ${importNames.join(', ')}`);
    } else {
      description = 'Application entry point';
    }

    return { role, description, evidence };
  }

  // Type definitions
  if (baseName.includes('types') || baseName.includes('interface')) {
    role = 'Type Definitions';
    description = 'TypeScript type definitions and data structure contracts';
    evidence.push('filename contains "types" or "interface"');

    if (importedBy.length > 0) {
      evidence.push(`imported by ${importedBy.length} files`);
    }

    return { role, description, evidence };
  }

  // Scanner/detector modules
  if (/scanner|traverse|walk/i.test(baseName)) {
    role = 'File System Module';
    description = 'Traverses project filesystem and builds filtered file dataset';
    evidence.push('filename indicates file system operations');

    if (imports.some(i => i.includes('glob') || i.includes('fs'))) {
      evidence.push('imports file system utilities');
    }

    return { role, description, evidence };
  }

  // Dependency detection
  if (/detector|parser|extract/i.test(baseName)) {
    role = 'Analysis Engine';
    description = 'Analyzes source code to extract import/export relationships';
    evidence.push('filename indicates code analysis functionality');
    return { role, description, evidence };
  }

  // Context/intelligence modules
  if (/context\/index/i.test(file.path)) {
    role = 'Orchestrator';
    description = 'Coordinates all analysis modules to build project understanding';
    evidence.push('path: context/index.ts - central coordination point');
    evidence.push(`imports ${imports.length} context modules`);
    return { role, description, evidence };
  }

  // Formatter modules
  if (/format|render|display/i.test(baseName)) {
    role = 'Output Generator';
    description = 'Transforms internal data into formatted output';
    evidence.push('filename indicates output formatting');
    return { role, description, evidence };
  }

  // Highly imported = core infrastructure
  if (importedBy.length > 3) {
    role = 'Core Infrastructure';
    description = `Shared utility depended upon by ${importedBy.length} system components`;
    evidence.push(`high import centrality: imported by ${importedBy.length} files`);

    if (imports.length === 0) {
      evidence.push('leaf node: no imports (pure utility)');
    }

    return { role, description, evidence };
  }

  // Integration module (many imports)
  if (imports.length > 5) {
    role = 'Integration Module';
    description = `Coordinates ${imports.length} subsystems`;
    evidence.push(`high outbound dependencies: imports ${imports.length} modules`);
    return { role, description, evidence };
  }

  // Config files
  if (file.type === 'config') {
    role = 'Configuration';
    description = `Project configuration for ${baseName.replace(/\.(json|ts|js)$/i, '')}`;
    evidence.push('file type detected as config');
    return { role, description, evidence };
  }

  // Default with evidence
  if (ext === '.ts') {
    description = 'TypeScript module';
    evidence.push('TypeScript source file');
  } else if (ext === '.md') {
    description = 'Project documentation';
    evidence.push('Markdown documentation file');
  } else if (ext === '.json') {
    description = 'Configuration or data file';
    evidence.push('JSON data file');
  }

  if (importedBy.length > 0) {
    evidence.push(`imported by ${importedBy.length} files`);
  }

  return { role, description, evidence };
}

/**
 * Legacy compatibility: generate description only
 */
export function generateSemanticDescription(
  file: FileInfo,
  imports: string[],
  importedBy: string[]
): string {
  return analyzeFile(file, imports, importedBy).description;
}

/**
 * Legacy compatibility: generate role only
 */
export function generateFileRole(
  file: FileInfo,
  importance: string,
  importedByCount: number
): string {
  if (isEntryPoint(file.name)) return 'Entry Point';
  if (importedByCount > 5) return 'Core Infrastructure';
  if (importance === 'config') return 'Configuration';
  if (file.name.toLowerCase().includes('types')) return 'Type Definitions';
  if (/scanner|detector|analyzer/i.test(file.name)) return 'Analysis Engine';
  if (/format|render/i.test(file.name)) return 'Output Generator';
  if (importance === 'core') return 'Core Logic';
  return 'Support Module';
}
