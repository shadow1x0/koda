/**
 * Ask Mode
 * Answer specific questions about the codebase using keyword matching
 */

import type { FileInfo } from '../types.js';
import type { FileContent } from '../context/extractor.js';
import type { RankedFile } from '../context/prioritizer.js';
import type { ModeConfig } from './types.js';

/**
 * Extract keywords from a question
 */
function extractKeywords(query: string): string[] {
  // Remove common stop words and extract meaningful terms
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'whose', 'am', 'it', 's', 'doesn', 'don', 'didn', 'wasn', 'weren', 'haven', 'hasn', 'hadn', 'won', 'wouldn', 'couldn', 'shouldn']);
  
  const words = query.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  
  // Deduplicate and limit
  return [...new Set(words)].slice(0, 5);
}

/**
 * Score files by keyword relevance
 */
function scoreFilesByKeywords(
  files: FileInfo[], 
  rankedFiles: RankedFile[], 
  contents: Map<string, FileContent>,
  keywords: string[]
): Map<string, number> {
  const scores = new Map<string, number>();
  
  // Create path to ranked score map for base importance
  const rankedScores = new Map<string, number>();
  for (const r of rankedFiles) {
    rankedScores.set(r.file.path, r.score);
  }
  
  for (const file of files) {
    let score = rankedScores.get(file.path) || 0;
    const content = contents.get(file.path);
    
    for (const kw of keywords) {
      // Filename match (high priority)
      if (file.name.toLowerCase().includes(kw)) {
        score += 50;
      }
      
      // Extension match (e.g., "auth" in auth.ts)
      const baseName = file.name.replace(/\.[^/.]+$/, '').toLowerCase();
      if (baseName.includes(kw)) {
        score += 40;
      }
      
      if (content) {
        // Export names match
        for (const exp of content.exports) {
          if (exp.toLowerCase().includes(kw)) {
            score += 30;
          }
        }
        
        // Function names match
        for (const func of content.functions) {
          if (func.toLowerCase().includes(kw)) {
            score += 20;
          }
        }
        
        // Class names match
        for (const cls of content.classes) {
          if (cls.toLowerCase().includes(kw)) {
            score += 25;
          }
        }
        
        // Header content match
        if (content.header.toLowerCase().includes(kw)) {
          score += 10;
        }
      }
    }
    
    if (score > 0) {
      scores.set(file.path, score);
    }
  }
  
  return scores;
}

/**
 * File selector for ask mode
 * Keyword-based selection
 */
function selectAskFiles(files: FileInfo[], rankedFiles: RankedFile[], query?: string): FileInfo[] {
  if (!query) {
    // Fallback to explain mode selection
    return rankedFiles.slice(0, 5).map(r => r.file);
  }
  
  const keywords = extractKeywords(query);
  if (keywords.length === 0) {
    return rankedFiles.slice(0, 5).map(r => r.file);
  }
  
  // We need contents for scoring - for now, pre-extract for scoring
  // In real implementation, this would be passed in
  const tempContents = new Map<string, FileContent>();
  
  const scores = scoreFilesByKeywords(files, rankedFiles, tempContents, keywords);
  
  // Sort by score and select top N
  const sorted = files
    .map(f => ({ file: f, score: scores.get(f.path) || 0 }))
    .sort((a, b) => b.score - a.score)
    .filter(x => x.score > 0);
  
  // Return top 10 or at least some files
  if (sorted.length === 0) {
    return rankedFiles.slice(0, 5).map(r => r.file);
  }
  
  return sorted.slice(0, 10).map(x => x.file);
}

/**
 * Formatter for ask mode
 * Context for answering a specific question
 */
function formatAsk(
  files: FileInfo[], 
  contents: Map<string, FileContent>, 
  projectType: string,
  entryPoints: string[],
  query?: string
): string {
  const lines: string[] = [];
  
  lines.push(`# Question: "${query || 'General codebase inquiry'}"`);
  lines.push('');
  
  lines.push(`## Project: ${projectType}`);
  lines.push('');
  
  if (query) {
    lines.push(`## Searching for: ${extractKeywords(query).join(', ')}`);
    lines.push('');
  }
  
  lines.push('## Relevant Files');
  files.forEach((file, i) => {
    const content = contents.get(file.path);
    lines.push(`${i + 1}. **${file.name}** - \`${file.path}\``);
    
    if (content?.exports.length) {
      lines.push(`   Exports: ${content.exports.slice(0, 3).join(', ')}`);
    }
    
    if (content?.functions.length) {
      const funcs = content.functions.slice(0, 3).map(f => {
        // Extract function name
        const match = f.match(/function\s+(\w+)/);
        return match?.[1] || f;
      });
      lines.push(`   Functions: ${funcs.join(', ')}${content.functions.length > 3 ? '...' : ''}`);
    }
    lines.push('');
  });
  
  // Include code snippets for top files
  lines.push('## Code Context');
  files.slice(0, 3).forEach(file => {
    const content = contents.get(file.path);
    if (content?.header) {
      lines.push(`### ${file.name}`);
      lines.push('```typescript');
      const lines_header = content.header.split('\n').slice(0, 20);
      lines.push(...lines_header);
      if (content.header.split('\n').length > 20) {
        lines.push('// ...');
      }
      lines.push('```');
      lines.push('');
    }
  });
  
  lines.push('---');
  lines.push('Answer the question using the code context above.');
  
  return lines.join('\n');
}

// Helper to expose keywords for the mode config
export function getKeywords(query: string): string[] {
  return extractKeywords(query);
}

export const askMode: ModeConfig = {
  name: 'ask',
  description: 'Ask a specific question about the codebase',
  maxFiles: 10,
  includeContent: true,
  fileSelector: (files, ranked, query) => selectAskFiles(files, ranked, query),
  formatter: (files, contents, projectType, entryPoints) => {
    // Note: query is passed via closure or context in real implementation
    return formatAsk(files, contents, projectType, entryPoints);
  },
};
