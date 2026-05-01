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
      
      // Keyword-based selection
      const keywords = question.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2);
      
      // Score files by keyword relevance
      const scored = scanResult.files.map(file => {
        let score = 0;
        const content = contents.get(file.path);
        
        for (const kw of keywords) {
          if (file.name.toLowerCase().includes(kw)) score += 50;
          if (file.name.replace(/\.[^/.]+$/, '').toLowerCase().includes(kw)) score += 40;
          
          if (content) {
            for (const exp of content.exports) {
              if (exp.toLowerCase().includes(kw)) score += 30;
            }
            for (const func of content.functions) {
              if (func.toLowerCase().includes(kw)) score += 20;
            }
            if (content.header.toLowerCase().includes(kw)) score += 10;
          }
        }
        
        return { file, score };
      }).sort((a, b) => b.score - a.score);
      
      const selectedFiles = scored.slice(0, maxFiles).map(x => x.file);
      
      // Detect project type
      const hasPackageJson = scanResult.files.some(f => f.name === 'package.json');
      const tsFiles = scanResult.files.filter(f => ['.ts', '.tsx'].includes(f.extension)).length;
      const jsFiles = scanResult.files.filter(f => ['.js', '.jsx'].includes(f.extension)).length;
      
      let projectType = 'Generic';
      if (hasPackageJson && tsFiles > 0 && tsFiles >= jsFiles) projectType = 'TypeScript';
      else if (hasPackageJson && jsFiles > 0) projectType = 'JavaScript/Node.js';
      
      // Format output
      const lines: string[] = [];
      lines.push(`# Question: "${question}"`);
      lines.push('');
      lines.push(`## Project: ${projectType}`);
      lines.push('');
      lines.push(`## Searching for: ${[...new Set(keywords)].slice(0, 5).join(', ')}`);
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
      
      // Simple rule-based answer generation
      const isHowQuestion = keywords.some(k => ['how', 'does', 'work', 'function'].includes(k.toLowerCase()));
      const isWhatQuestion = keywords.some(k => ['what', 'is', 'are'].includes(k.toLowerCase()));
      
      if (isHowQuestion) {
        lines.push(`The question "${question}" involves the following mechanism:`);
        lines.push('');
        lines.push(`**Primary flow:**`);
        selectedFiles.slice(0, 3).forEach((file, i) => {
          const relPath = path.relative(scanResult.rootPath, file.path);
          const content = contents.get(file.path);
          const firstExport = content?.exports[0];
          lines.push(`${i + 1}. **${relPath}** ${firstExport ? `→ defines \`${firstExport.split(' ').pop()}\`` : ''}`);
        });
        lines.push('');
        lines.push(`**To understand the full implementation:** Review the code in the files listed above, particularly the exported functions.`);
      } else if (isWhatQuestion) {
        lines.push(`Based on the codebase analysis:`);
        lines.push('');
        selectedFiles.slice(0, 3).forEach(file => {
          const content = contents.get(file.path);
          if (content?.header) {
            const desc = content.header.split('\n').find(l => l.trim() && !l.startsWith('//') && !l.startsWith('/*'));
            if (desc) lines.push(`- ${desc.trim().slice(0, 100)}`);
          }
        });
      } else {
        lines.push(`Information related to "${question}" was found in ${selectedFiles.length} files.`);
        lines.push('');
        lines.push(`**Most relevant:** ${path.relative(scanResult.rootPath, selectedFiles[0].path)}`);
        if (selectedFiles[0].size > 0) {
          lines.push(`- File size: ${(selectedFiles[0].size / 1024).toFixed(1)}KB`);
        }
      }
      
      lines.push('');
      lines.push('**Note:** This is a code-assisted answer. For complete understanding, review the full implementation in the files above.');
      
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
