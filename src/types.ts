/**
 * Types for the Koda scanner module
 */

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  extension: string;
  type: 'source' | 'config' | 'other';
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

export interface ScanResult {
  rootPath: string;
  tree: TreeNode;
  files: FileInfo[];
  sourceFiles: FileInfo[];
  configFiles: FileInfo[];
  ignoredCount: number;
  totalCount: number;
}
