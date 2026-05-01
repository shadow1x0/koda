/**
 * Smart Context Compression Engine
 * Ranks, filters, and compresses to fit token limit
 */

import path from 'node:path';
import type { ScanResult, FileInfo } from '../types.js';
import { buildDependencyMap, buildReverseDependencyMap } from './detector.js';
import { rankFiles, RankedFile } from './prioritizer.js';
import { formatAIContext, CompressedContext, FileWithContent } from './formatter.js';
import { extractSmartContent, estimateContentTokens } from './extractor.js';

// Simple token estimation (4 chars ≈ 1 token for code)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Detect project type from files with evidence-based detection
function detectProjectType(files: FileInfo[]): string {
  const hasPackageJson = files.some(f => f.name === 'package.json');
  const hasCargo = files.some(f => f.name === 'Cargo.toml');
  const hasGoMod = files.some(f => f.name === 'go.mod');
  const hasPyProject = files.some(f => f.name === 'pyproject.toml' || f.name === 'requirements.txt');

  // Count file extensions for stronger signal
  const tsFiles = files.filter(f => ['.ts', '.tsx'].includes(f.extension)).length;
  const jsFiles = files.filter(f => ['.js', '.jsx'].includes(f.extension)).length;
  const pyFiles = files.filter(f => f.extension === '.py').length;
  const goFiles = files.filter(f => f.extension === '.go').length;
  const rsFiles = files.filter(f => f.extension === '.rs').length;

  // Evidence-based detection with confidence
  if (hasPackageJson && tsFiles > 0 && tsFiles >= jsFiles) return 'TypeScript';
  if (hasPackageJson && jsFiles > 0) return 'JavaScript/Node.js';
  if (hasCargo && rsFiles > 0) return 'Rust';
  if (hasGoMod && goFiles > 0) return 'Go';
  if (hasPyProject && pyFiles > 0) return 'Python';

  // Fallback to majority extension
  const counts = [
    { type: 'TypeScript', count: tsFiles },
    { type: 'JavaScript', count: jsFiles },
    { type: 'Python', count: pyFiles },
    { type: 'Go', count: goFiles },
    { type: 'Rust', count: rsFiles },
  ].sort((a, b) => b.count - a.count);

  return counts[0]?.count > 0 ? counts[0].type : 'Generic';
}

// Find entry points - return relative paths for uniqueness
function findEntryPoints(files: FileInfo[], rootPath: string): string[] {
  const entryPatterns = [/^cli\./, /^index\./, /^main\./, /^server\./, /^app\./];
  const seen = new Set<string>();
  const entryPoints: string[] = [];
  
  for (const file of files) {
    if (entryPatterns.some(p => p.test(file.name))) {
      // Use relative path for unique identification
      const relativePath = path.relative(rootPath, file.path);
      if (!seen.has(relativePath)) {
        seen.add(relativePath);
        entryPoints.push(relativePath);
      }
    }
  }
  
  return entryPoints;
}

/**
 * Build compressed context within token limit
 */
export async function buildCompressedContext(
  scanResult: ScanResult,
  maxTokens: number
): Promise<string> {
  // Deduplicate
  const uniqueFiles = new Map<string, FileInfo>();
  for (const file of scanResult.files) {
    if (!uniqueFiles.has(file.path)) {
      uniqueFiles.set(file.path, file);
    }
  }
  const files = Array.from(uniqueFiles.values());

  // Build dependency maps
  const dependencyMap = buildDependencyMap(files);
  const reverseDependencyMap = buildReverseDependencyMap(files);

  // Find entry points (unique by relative path)
  const entryPoints = findEntryPoints(files, scanResult.rootPath);

  // Rank files by importance
  const rankedFiles = rankFiles(files, dependencyMap, reverseDependencyMap, entryPoints);

  // Smart compression: pick top files until we hit token limit
  const selectedFiles: RankedFile[] = [];
  let currentTokens = 0;
  const overheadTokens = 500; // Reserve for headers/formatting
  const availableTokens = maxTokens - overheadTokens;

  for (const ranked of rankedFiles) {
    // Estimate tokens for this file (path + metadata)
    const fileText = `${ranked.file.path} ${ranked.file.name} ${ranked.reasons.join(' ')}`;
    const fileTokens = estimateTokens(fileText) + 50; // 50 for formatting overhead

    if (currentTokens + fileTokens <= availableTokens) {
      selectedFiles.push(ranked);
      currentTokens += fileTokens;
    } else {
      // File too big, but continue to find smaller ones
      continue;
    }
  }

  // Extract content for selected files
  const filesWithContent: FileWithContent[] = [];
  for (const ranked of selectedFiles) {
    const content = extractSmartContent(ranked.file, 50);
    if (content) {
      const contentTokens = estimateContentTokens(content);
      currentTokens += contentTokens;
      filesWithContent.push({
        ranked,
        content,
        contentTokens,
      });
    }
  }

  // Build compressed context
  const context: CompressedContext = {
    projectType: detectProjectType(files),
    topFiles: selectedFiles,
    filesWithContent,
    entryPoints,
    totalFiles: files.length,
    includedFiles: selectedFiles.length,
    estimatedTokens: currentTokens + overheadTokens,
  };

  return formatAIContext(context, scanResult.rootPath);
}
