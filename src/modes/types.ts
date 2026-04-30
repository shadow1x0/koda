/**
 * Mode System Types
 * Different modes for different use cases
 */

import type { FileInfo } from '../types.js';
import type { FileContent } from '../context/extractor.js';
import type { RankedFile } from '../context/prioritizer.js';

export type Mode = 'explain' | 'ask' | 'context';

export interface ModeConfig {
  name: Mode;
  description: string;
  maxFiles: number;
  includeContent: boolean;
  fileSelector: (files: FileInfo[], rankedFiles: RankedFile[], query?: string) => FileInfo[];
  formatter: (files: FileInfo[], contents: Map<string, FileContent>, projectType: string, entryPoints: string[]) => string;
}
