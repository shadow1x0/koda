/**
 * AI Context Formatter
 * One format: AI-ready markdown
 */

import type { RankedFile } from './prioritizer.js';
import type { FileContent } from './extractor.js';

export interface FileWithContent {
  ranked: RankedFile;
  content: FileContent;
  contentTokens: number;
}

export interface CompressedContext {
  projectType: string;
  topFiles: RankedFile[];
  filesWithContent: FileWithContent[];
  entryPoints: string[];
  totalFiles: number;
  includedFiles: number;
  estimatedTokens: number;
}

/**
 * Format compressed context for AI
 */
export function formatAIContext(context: CompressedContext): string {
  const lines: string[] = [];

  lines.push(`# ${context.projectType} Project Context`);
  lines.push('');
  lines.push(`> Compressed from ${context.totalFiles} files to ${context.includedFiles} critical files (~${context.estimatedTokens} tokens)`);
  lines.push('');

  // Entry points
  if (context.entryPoints.length > 0) {
    lines.push('## Entry Points');
    context.entryPoints.forEach(ep => lines.push(`- ${ep}`));
    lines.push('');
  }

  // Critical files with content
  lines.push('## Critical Files (ranked by importance)');
  lines.push('');

  context.filesWithContent.forEach((fwc, index) => {
    const { ranked, content } = fwc;
    const file = ranked.file;
    
    lines.push(`### ${index + 1}. ${file.name}`);
    lines.push(`**Path:** \`${file.path}\``);
    lines.push(`**Why:** ${ranked.reasons.join(', ') || 'important file'}`);
    lines.push('');
    
    // Show exports if available
    if (content.exports.length > 0) {
      lines.push('**Exports:**');
      lines.push('```typescript');
      content.exports.slice(0, 5).forEach(exp => lines.push(exp));
      if (content.exports.length > 5) {
        lines.push(`// ... and ${content.exports.length - 5} more exports`);
      }
      lines.push('```');
      lines.push('');
    }
    
    // Show key code header
    if (content.header) {
      lines.push('**Key Code:**');
      lines.push('```typescript');
      const headerLines = content.header.split('\n');
      if (headerLines.length > 30) {
        lines.push(...headerLines.slice(0, 30));
        lines.push('// ...');
      } else {
        lines.push(content.header);
      }
      lines.push('```');
      lines.push('');
    }
  });

  lines.push('---');
  lines.push('Use this context to understand the codebase structure before answering questions.');

  return lines.join('\n');
}
