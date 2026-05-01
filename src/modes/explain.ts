/**
 * Explain Mode
 * Give overview of project - what it is, where to start, how it works
 */

import path from 'node:path';
import type { FileInfo } from '../types.js';
import type { FileContent } from '../context/extractor.js';
import type { RankedFile } from '../context/prioritizer.js';
import type { ModeConfig } from './types.js';
import fs from 'node:fs';

/**
 * File selector for explain mode:
 * 1. Entry points (cli.ts, index.ts, main.go, etc.)
 * 2. Config files (package.json, README, tsconfig)
 * 3. Files with highest in-degree (most imported)
 * 4. Root-level source files
 */
function selectExplainFiles(files: FileInfo[], rankedFiles: RankedFile[]): FileInfo[] {
  const selected: FileInfo[] = [];
  const added = new Set<string>();
  
  // 1. Entry points first
  const entryPatterns = [/^cli\./, /^index\./, /^main\./, /^server\./, /^app\./, /^index\./];
  const entryPoints = files.filter(f => 
    entryPatterns.some(p => p.test(f.name))
  );
  
  for (const file of entryPoints) {
    if (!added.has(file.path)) {
      selected.push(file);
      added.add(file.path);
    }
  }
  
  // 2. Config files
  const configNames = ['package.json', 'README.md', 'tsconfig.json', 'Cargo.toml', 'go.mod', 'pyproject.toml'];
  const configs = files.filter(f => configNames.includes(f.name));
  
  for (const file of configs) {
    if (!added.has(file.path)) {
      selected.push(file);
      added.add(file.path);
    }
  }
  
  // 3. Top ranked files (highest importance)
  const topRanked = rankedFiles.slice(0, 5);
  for (const ranked of topRanked) {
    if (!added.has(ranked.file.path)) {
      selected.push(ranked.file);
      added.add(ranked.file.path);
    }
  }
  
  // 4. Fill with root-level source files
  if (selected.length < 7) {
    const rootFiles = files.filter(f => {
      const depth = f.path.split('/').length;
      return depth <= 4 && f.type === 'source' && !added.has(f.path);
    });
    
    for (const file of rootFiles.slice(0, 7 - selected.length)) {
      selected.push(file);
      added.add(file.path);
    }
  }
  
  return selected.slice(0, 7);
}

/**
 * Formatter for explain mode
 * Project overview with architecture and file guide
 */
function formatExplain(
  files: FileInfo[], 
  contents: Map<string, FileContent>, 
  projectType: string,
  entryPoints: string[],
  rootPath?: string
): string {
  const lines: string[] = [];
  
  // Try to get project name from package.json
  let projectName = 'Project';
  let description = 'No description available';
  
  const packageJson = files.find(f => f.name === 'package.json');
  if (packageJson) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJson.path, 'utf-8'));
      projectName = pkg.name || projectName;
      description = pkg.description || description;
    } catch {}
  }
  
  // Try to get description from README
  const readme = files.find(f => f.name === 'README.md');
  if (readme && description === 'No description available') {
    try {
      const readmeContent = fs.readFileSync(readme.path, 'utf-8');
      const firstPara = readmeContent.split('\n\n')[0].replace(/^#\s+/, '');
      if (firstPara) description = firstPara;
    } catch {}
  }
  
  lines.push(`# Project Overview: ${projectName}`);
  lines.push('');
  
  // What is this?
  lines.push('## What is this?');
  lines.push(description);
  lines.push('');
  
  // Where to start
  lines.push('## Where to start');
  const entries = entryPoints.slice(0, 3);
  if (entries.length > 0) {
    entries.forEach((ep, i) => {
      // Find file by matching relative path
      const file = files.find(f => rootPath ? path.relative(rootPath, f.path) === ep : f.path === ep);
      const content = file ? contents.get(file.path) : undefined;
      const firstLine = content?.header.split('\n').find(l => l.trim() && !l.startsWith('//') && !l.startsWith('/*'));
      lines.push(`${i + 1}. \`${ep}\`${firstLine ? ` - ${firstLine.trim().slice(0, 60)}` : ' - application entry'}`);
    });
  } else {
    lines.push('1. Start with the main source files listed below');
  }
  lines.push('');
  
  // Architecture
  lines.push('## Architecture');
  lines.push(`- **Type:** ${projectType}`);
  lines.push(`- **Entry Points:** ${entryPoints.join(', ') || 'None detected'}`);
  
  // Key modules from selected files - use relative paths
  const sourceFiles = files.filter(f => f.type === 'source').slice(0, 3);
  if (sourceFiles.length > 0) {
    const moduleNames = sourceFiles.map(f => rootPath ? path.relative(rootPath, f.path) : f.path);
    lines.push(`- **Key Modules:** ${moduleNames.join(', ')}`);
  }
  
  // External deps count
  const pkgContent = contents.get(packageJson?.path || '');
  // Note: We'd need to parse package.json for real count, skip for now
  lines.push('');
  
  // File Guide - use relative paths for unique identification
  lines.push('## File Guide');
  files.forEach((file, i) => {
    const content = contents.get(file.path);
    const exports = content?.exports.slice(0, 2) || [];
    const exportHint = exports.length > 0 ? ` exports: ${exports.map(e => e.split(' ').pop()).join(', ')}` : '';
    // Use file.name as fallback if path.relative doesn't work
    const displayPath = file.name;
    lines.push(`${i + 1}. **${displayPath}**${exportHint}`);
  });
  lines.push('');
  
  lines.push('---');
  lines.push('Copy this context to an AI assistant to get help understanding this codebase.');
  
  return lines.join('\n');
}

export const explainMode: ModeConfig = {
  name: 'explain',
  description: 'Understand a project - what it does and where to start',
  maxFiles: 7,
  includeContent: true,
  fileSelector: (files, ranked) => selectExplainFiles(files, ranked),
  formatter: (files, contents, projectType, entryPoints) => formatExplain(files, contents, projectType, entryPoints),
};
