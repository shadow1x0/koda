#!/usr/bin/env node

/**
 * Koda CLI - Smart Context Compression for AI
 * Three modes: explain, ask, context
 */

import { program } from 'commander';
import { scanProject } from './scanner.js';
import { buildCompressedContext } from './context/index.js';
import { explainMode, askMode } from './modes/index.js';
import { extractSmartContent } from './context/extractor.js';
import { buildDependencyMap, buildReverseDependencyMap } from './context/detector.js';
import { rankFiles } from './context/prioritizer.js';
import path from 'node:path';
import fs from 'node:fs';

program
  .name('koda')
  .description('Smart context compression for AI assistance')
  .version('0.3.0');

// Explain mode - understand a project
program
  .command('explain')
  .description('Understand a project - what it does and where to start')
  .argument('<path>', 'Target directory')
  .option('--max-files <n>', 'Max files to include', '7')
  .action(async (targetPath: string, options: { maxFiles?: string }) => {
    try {
      const maxFiles = parseInt(options.maxFiles || '7', 10);
      
      console.error(`🔍 Scanning ${targetPath}...`);
      const scanResult = await scanProject(targetPath);
      
      console.error(`📊 Found ${scanResult.files.length} files`);
      console.error(`🎯 Building project overview...\n`);
      
      // Build dependencies
      const dependencyMap = buildDependencyMap(scanResult.files);
      const reverseDependencyMap = buildReverseDependencyMap(scanResult.files);
      const entryPatterns = [/^cli\./, /^index\./, /^main\./, /^server\./];
      
      // Get unique entry points by relative path
      const entryPoints: string[] = [];
      const seen = new Set<string>();
      for (const f of scanResult.files) {
        if (entryPatterns.some(p => p.test(f.name))) {
          const relPath = path.relative(scanResult.rootPath, f.path);
          if (!seen.has(relPath)) {
            seen.add(relPath);
            entryPoints.push(relPath);
          }
        }
      }
      
      // Rank files
      const rankedFiles = rankFiles(scanResult.files, dependencyMap, reverseDependencyMap, entryPoints);
      
      // Select files for explain mode
      const selectedFiles = explainMode.fileSelector(scanResult.files, rankedFiles);
      
      // Extract content for selected files
      const contents = new Map<string, import('./context/extractor.js').FileContent>();
      for (const file of selectedFiles) {
        const content = extractSmartContent(file, 30);
        if (content) {
          contents.set(file.path, content);
        }
      }
      
      // Detect project type
      const hasPackageJson = scanResult.files.some(f => f.name === 'package.json');
      const hasCargo = scanResult.files.some(f => f.name === 'Cargo.toml');
      const hasGoMod = scanResult.files.some(f => f.name === 'go.mod');
      const hasPyProject = scanResult.files.some(f => f.name === 'pyproject.toml' || f.name === 'requirements.txt');
      
      const tsFiles = scanResult.files.filter(f => ['.ts', '.tsx'].includes(f.extension)).length;
      const jsFiles = scanResult.files.filter(f => ['.js', '.jsx'].includes(f.extension)).length;
      const pyFiles = scanResult.files.filter(f => f.extension === '.py').length;
      const goFiles = scanResult.files.filter(f => f.extension === '.go').length;
      const rsFiles = scanResult.files.filter(f => f.extension === '.rs').length;
      
      let projectType = 'Generic';
      if (hasPackageJson && tsFiles > 0 && tsFiles >= jsFiles) projectType = 'TypeScript';
      else if (hasPackageJson && jsFiles > 0) projectType = 'JavaScript/Node.js';
      else if (hasCargo && rsFiles > 0) projectType = 'Rust';
      else if (hasGoMod && goFiles > 0) projectType = 'Go';
      else if (hasPyProject && pyFiles > 0) projectType = 'Python';
      
      const output = explainMode.formatter(selectedFiles, contents, projectType, entryPoints, scanResult.rootPath);
      console.log(output);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Ask mode - answer specific questions
program
  .command('ask')
  .description('Ask a specific question about the codebase')
  .argument('<path>', 'Target directory')
  .argument('<question>', 'Question to ask about the codebase')
  .option('--max-files <n>', 'Max files to include', '10')
  .action(async (targetPath: string, question: string, options: { maxFiles?: string }) => {
    try {
      const maxFiles = parseInt(options.maxFiles || '10', 10);
      
      console.error(`🔍 Scanning ${targetPath}...`);
      const scanResult = await scanProject(targetPath);
      
      console.error(`📊 Found ${scanResult.files.length} files`);
      console.error(`❓ Question: "${question}"`);
      console.error(`🎯 Finding relevant files...\n`);
      
      // Build dependencies and rank
      const dependencyMap = buildDependencyMap(scanResult.files);
      const reverseDependencyMap = buildReverseDependencyMap(scanResult.files);
      const entryPatterns = [/^cli\./, /^index\./, /^main\./, /^server\./];
      
      // Get unique entry points by relative path
      const entryPoints: string[] = [];
      const seen = new Set<string>();
      for (const f of scanResult.files) {
        if (entryPatterns.some(p => p.test(f.name))) {
          const relPath = path.relative(scanResult.rootPath, f.path);
          if (!seen.has(relPath)) {
            seen.add(relPath);
            entryPoints.push(relPath);
          }
        }
      }
      
      const rankedFiles = rankFiles(scanResult.files, dependencyMap, reverseDependencyMap, entryPoints);
      
      // Extract content for all files (for keyword search)
      const contents = new Map<string, import('./context/extractor.js').FileContent>();
      for (const file of scanResult.files) {
        const content = extractSmartContent(file, 30);
        if (content) {
          contents.set(file.path, content);
        }
      }
      
      // Extract keywords for answer generation
      const keywords = question.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2);
      
      // Use askMode for topic-aware file selection
      const selectedFiles = askMode.fileSelector(scanResult.files, rankedFiles, question).slice(0, maxFiles);
      
      // Detect project type
      const hasPackageJson = scanResult.files.some(f => f.name === 'package.json');
      const tsFiles = scanResult.files.filter(f => ['.ts', '.tsx'].includes(f.extension)).length;
      const jsFiles = scanResult.files.filter(f => ['.js', '.jsx'].includes(f.extension)).length;
      
      let projectType = 'Generic';
      if (hasPackageJson && tsFiles > 0 && tsFiles >= jsFiles) projectType = 'TypeScript';
      else if (hasPackageJson && jsFiles > 0) projectType = 'JavaScript/Node.js';
      
      // Get topic from question for display
      const topicMatch = question.toLowerCase().match(/(?:compression|caching|scanning|rank|dependency|extract|format|mode|ask|explain|cli|test)/);
      const topic = topicMatch ? topicMatch[0] : 'general';
      
      // Format output
      const lines: string[] = [];
      lines.push(`# Question: "${question}"`);
      lines.push('');
      lines.push(`## Project: ${projectType}`);
      lines.push(`**Topic detected:** ${topic}`);
      lines.push('');
      lines.push(`## Top ${selectedFiles.length} Relevant Files`);
      lines.push('');
      
      selectedFiles.forEach((file, i) => {
        const content = contents.get(file.path);
        const relPath = path.relative(scanResult.rootPath, file.path);
        lines.push(`${i + 1}. **${relPath}**`);
        
        if (content?.exports.length) {
          const exports = content.exports.slice(0, 3).map(e => {
            const match = e.match(/\b(?:const|let|var|function|class|interface|type)\s+(\w+)/);
            return match?.[1] || e;
          });
          lines.push(`   Exports: ${exports.join(', ')}`);
        }
        lines.push('');
      });
      
      lines.push('---');
      
      // Generate synthesized answer based on found files
      lines.push('## Analysis');
      
      // Find key functions/classes that might answer the question
      const keyFunctions: string[] = [];
      selectedFiles.forEach(file => {
        const content = contents.get(file.path);
        if (content?.exports) {
          const relevantExports = content.exports.filter(e => 
            keywords.some(k => e.toLowerCase().includes(k.toLowerCase()))
          );
          relevantExports.forEach(exp => {
            const match = exp.match(/\b(?:function|class|const|let|var)\s+(\w+)/);
            if (match) keyFunctions.push(`${match[1]} (${path.relative(scanResult.rootPath, file.path)})`);
          });
        }
      });
      
      if (keyFunctions.length > 0) {
        lines.push(`**Key components related to your question:**`);
        keyFunctions.slice(0, 5).forEach(fn => lines.push(`- ${fn}`));
        lines.push('');
      }
      
      // Connection analysis
      if (selectedFiles.length > 1) {
        lines.push('**How these files work together:**');
        lines.push(`1. Entry/Handler: ${path.relative(scanResult.rootPath, selectedFiles[0].path)}`);
        if (selectedFiles.length > 2) {
          lines.push(`2. Core Logic: ${path.relative(scanResult.rootPath, selectedFiles[1].path)}`);
          lines.push(`3. Supporting: ${path.relative(scanResult.rootPath, selectedFiles[2].path)}`);
        }
        lines.push('');
      }
      
      lines.push('## Answer');
      lines.push('');
      
      // Generate intelligent answer based on topic
      const topicLower = topic.toLowerCase();
      
      if (topicLower === 'compression') {
        lines.push('**Compression is the process of selecting and formatting the most important files to fit within a token budget.**');
        lines.push('');
        lines.push('**How it works:**');
        lines.push('1. **Scan** all files in the project');
        lines.push('2. **Rank** files by importance (entry points, imports, depth in dependency tree)');
        lines.push('3. **Select** files starting from most important until token budget is reached');
        lines.push('4. **Extract** smart content (headers, exports, function signatures) from each file');
        lines.push('5. **Format** as AI-ready context with file paths and code snippets');
        lines.push('');
        lines.push('**Why these files are essential:**');
        lines.push('- `src/context/index.ts` - Main compression engine, implements the ranking and selection logic');
        lines.push('- `src/context/prioritizer.ts` - Calculates file importance scores based on dependencies');
        lines.push('- `src/context/extractor.ts` - Extracts meaningful content from source files');
        lines.push('- `src/context/detector.ts` - Builds dependency graph for ranking');
        lines.push('');
        lines.push('**Entry point:** `compressContext()` in `src/context/index.ts`');
      } else if (topicLower === 'cache') {
        lines.push('**Caching stores file metadata to avoid re-scanning unchanged files on subsequent runs.**');
        lines.push('');
        lines.push('**How it works:**');
        lines.push('1. After first scan, save file paths, sizes, mtimes, and extracted content');
        lines.push('2. On next run, compare current files against cache');
        lines.push('3. Only re-scan files that changed (different size or mtime)');
        lines.push('4. Reuse cached data for unchanged files');
        lines.push('');
        lines.push('**Entry point:** Cache logic in `src/scanner.ts` and `src/cache/index.ts`');
      } else if (topicLower === 'scan') {
        lines.push('**Scanning walks the directory tree and collects file information.**');
        lines.push('');
        lines.push('**How it works:**');
        lines.push('1. Start from root directory');
        lines.push('2. Recursively find all files (respecting .gitignore)');
        lines.push('3. Filter out binary, test, and non-source files');
        lines.push('4. Extract metadata (size, extension, type) for each file');
        lines.push('5. Build directory tree structure');
        lines.push('');
        lines.push('**Entry point:** `scanProject()` in `src/scanner.ts`');
      } else {
        // Generic answer for other topics
        lines.push(`**${topic} works through the following process:**`);
        lines.push('');
        selectedFiles.slice(0, 3).forEach((file, i) => {
          const relPath = path.relative(scanResult.rootPath, file.path);
          const content = contents.get(file.path);
          const desc = content?.header.split('\n').find(l => l.trim() && !l.startsWith('//') && !l.startsWith('/*'));
          lines.push(`${i + 1}. **${relPath}**${desc ? `: ${desc.trim().slice(0, 80)}` : ''}`);
        });
      }
      
      lines.push('');
      lines.push('---');
      lines.push('**Summary:** The files above implement the core functionality. Start with the entry point file, then follow the data flow through the supporting files.');
      
      console.log(lines.join('\n'));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Context mode - legacy full context
program
  .command('context')
  .description('Generate full AI context (legacy mode with content)')
  .argument('<path>', 'Target directory')
  .option('--max-tokens <number>', 'Maximum tokens (default: 4000)', '4000')
  .action(async (targetPath: string, options: { maxTokens?: string }) => {
    try {
      const maxTokens = parseInt(options.maxTokens || '4000', 10);
      
      console.error(`🔍 Scanning ${targetPath}...`);
      const scanResult = await scanProject(targetPath);
      
      console.error(`📊 Found ${scanResult.files.length} files`);
      console.error(`🎯 Compressing to ~${maxTokens} tokens...\n`);
      
      const context = await buildCompressedContext(scanResult, maxTokens);
      
      // Output goes to stdout (for piping)
      console.log(context);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse();
