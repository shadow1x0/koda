/**
 * Output formatter for Koda scanner results
 */

import type { ScanResult, TreeNode, FileInfo } from './types.js';

/**
 * Format a tree node for display
 */
function formatTree(node: TreeNode, prefix = '', isLast = true): string {
  const connector = isLast ? '└── ' : '├── ';
  const name = node.type === 'directory' ? `${node.name}/` : node.name;
  let result = `${prefix}${connector}${name}\n`;

  if (node.children && node.children.length > 0) {
    const newPrefix = prefix + (isLast ? '    ' : '│   ');
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const childIsLast = i === node.children.length - 1;
      result += formatTree(child, newPrefix, childIsLast);
    }
  }

  return result;
}

/**
 * Format file list for display
 */
function formatFileList(files: FileInfo[], title: string): string {
  if (files.length === 0) {
    return '';
  }

  let result = `\n${title} (${files.length}):\n`;
  result += '─'.repeat(40) + '\n';

  for (const file of files) {
    const sizeKB = (file.size / 1024).toFixed(1);
    result += `  ${file.name.padEnd(30)} ${sizeKB.padStart(8)} KB\n`;
  }

  return result;
}

/**
 * Format the entire scan result for CLI output
 */
export function formatOutput(result: ScanResult): string {
  let output = '';

  // Header
  output += '╔'.padEnd(50, '═') + '╗\n';
  output += `║${'KODA SCAN RESULT'.padStart(28).padEnd(49)}║\n`;
  output += '╠'.padEnd(50, '═') + '╣\n';
  output += `║ Root: ${result.rootPath.padEnd(41)}║\n`;
  output += '╚'.padEnd(50, '═') + '╝\n';

  // Summary stats
  output += '\n📊 Summary:\n';
  output += `  Total files scanned: ${result.totalCount}\n`;
  output += `  Files included:      ${result.files.length}\n`;
  output += `  Files ignored:       ${result.ignoredCount}\n`;
  output += `  Source files:        ${result.sourceFiles.length}\n`;
  output += `  Config files:        ${result.configFiles.length}\n`;

  // Project tree
  output += '\n📁 Project Structure:\n';
  output += '─'.repeat(40) + '\n';
  if (result.tree.children) {
    for (let i = 0; i < result.tree.children.length; i++) {
      const child = result.tree.children[i];
      const isLast = i === result.tree.children.length - 1;
      output += formatTree(child, '', isLast);
    }
  }

  // File lists
  output += formatFileList(result.sourceFiles, '📝 Source Files');
  output += formatFileList(result.configFiles, '⚙️  Config Files');

  return output;
}
