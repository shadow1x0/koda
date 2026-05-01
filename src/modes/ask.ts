/**
 * Ask Mode
 * Answer specific questions about the codebase using keyword matching
 */

import type { FileInfo } from '../types.js';
import type { FileContent } from '../context/extractor.js';
import type { RankedFile } from '../context/prioritizer.js';
import type { ModeConfig } from './types.js';

/**
 * Intent classification for better query understanding
 */
type IntentType = 'mechanism' | 'feature' | 'bug' | 'architecture' | 'usage' | 'general';

interface QueryAnalysis {
  intent: IntentType;
  topic: string;      // Main subject (e.g., "compression")
  action: string;     // What user wants (e.g., "how", "what", "why")
  keywords: string[]; // All relevant terms
}

/**
 * Map topics to likely directories/files
 */
const TOPIC_DIRECTORY_MAP: Record<string, string[]> = {
  'compression': ['src/context', 'src/context/index', 'src/context/prioritizer', 'src/context/detector'],
  'rank': ['src/context/prioritizer', 'src/context/index'],
  'dependency': ['src/context/detector', 'src/context/index'],
  'extract': ['src/context/extractor', 'src/context/index'],
  'format': ['src/context/formatter', 'src/formatter'],
  'cache': ['src/cache', 'src/scanner'],
  'scan': ['src/scanner', 'src/index'],
  'mode': ['src/modes', 'src/cli'],
  'ask': ['src/modes/ask', 'src/modes'],
  'explain': ['src/modes/explain', 'src/modes'],
  'cli': ['src/cli'],
  'test': ['tests'],
};

/**
 * Extract keywords with intent analysis
 */
function analyzeQuery(query: string): QueryAnalysis {
  // Remove common stop words and extract meaningful terms
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'whose', 'am', 'it', 's', 'doesn', 'don', 'didn', 'wasn', 'weren', 'haven', 'hasn', 'hadn', 'won', 'wouldn', 'couldn', 'shouldn']);
  
  const words = query.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  
  // Detect intent from question words
  let intent: IntentType = 'general';
  const queryLower = query.toLowerCase();
  if (queryLower.includes('how') || queryLower.includes('work')) {
    intent = 'mechanism';
  } else if (queryLower.includes('what')) {
    intent = 'feature';
  } else if (queryLower.includes('why') || queryLower.includes('bug') || queryLower.includes('error')) {
    intent = 'bug';
  } else if (queryLower.includes('structure') || queryLower.includes('architecture') || queryLower.includes('design')) {
    intent = 'architecture';
  }
  
  // Find the main topic (non-question word, non-generic)
  const questionWords = ['how', 'what', 'why', 'when', 'where', 'who', 'which', 'does', 'work', 'explain'];
  const candidates = words.filter(w => !questionWords.includes(w));
  const topic = candidates[0] || words[0] || 'general';
  
  // Action word
  const action = words.find(w => questionWords.includes(w)) || 'find';
  
  return {
    intent,
    topic,
    action,
    keywords: [...new Set(words)],
  };
}

/**
 * Legacy function for compatibility
 */
function extractKeywords(query: string): string[] {
  return analyzeQuery(query).keywords;
}

/**
 * Score files by keyword relevance with topic-aware directory matching
 */
function scoreFilesByKeywords(
  files: FileInfo[], 
  rankedFiles: RankedFile[], 
  contents: Map<string, FileContent>,
  keywords: string[],
  topic?: string
): Map<string, number> {
  const scores = new Map<string, number>();
  
  // Get topic-relevant directories
  const relevantDirs = topic ? TOPIC_DIRECTORY_MAP[topic.toLowerCase()] || [] : [];
  
  // Create path to ranked score map for base importance
  const rankedScores = new Map<string, number>();
  for (const r of rankedFiles) {
    rankedScores.set(r.file.path, r.score);
  }
  
  for (const file of files) {
    let score = rankedScores.get(file.path) || 0;
    const content = contents.get(file.path);
    const filePathLower = file.path.toLowerCase();
    const fileNameLower = file.name.toLowerCase();
    
    // Topic directory boost - HUGE bonus for files in relevant directories
    for (const dir of relevantDirs) {
      if (filePathLower.includes(dir.toLowerCase())) {
        score += 100; // Major boost for topic-relevant directories
        break;
      }
    }
    
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      
      // Filename match (high priority)
      if (fileNameLower.includes(kwLower)) {
        score += 50;
      }
      
      // Extension match (e.g., "auth" in auth.ts)
      const baseName = fileNameLower.replace(/\.[^/.]+$/, '');
      if (baseName.includes(kwLower)) {
        score += 40;
      }
      
      if (content) {
        // Export names match (very high priority for mechanism questions)
        for (const exp of content.exports) {
          if (exp.toLowerCase().includes(kwLower)) {
            score += 35;
          }
        }
        
        // Function names match
        for (const func of content.functions) {
          if (func.toLowerCase().includes(kwLower)) {
            score += 20;
          }
        }
        
        // Class names match
        for (const cls of content.classes) {
          if (cls.toLowerCase().includes(kwLower)) {
            score += 25;
          }
        }
        
        // Header content match (high weight for understanding)
        if (content.header.toLowerCase().includes(kwLower)) {
          score += 15;
        }
      }
    }
    
    scores.set(file.path, score);
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
  
  // Analyze query with intent and topic
  const analysis = analyzeQuery(query);
  if (analysis.keywords.length === 0) {
    return rankedFiles.slice(0, 5).map(r => r.file);
  }
  
  // We need contents for scoring - pre-extract for topic matching
  const tempContents = new Map<string, FileContent>();
  
  // Score with topic-aware matching
  const scores = scoreFilesByKeywords(files, rankedFiles, tempContents, analysis.keywords, analysis.topic);
  
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
