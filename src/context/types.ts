/**
 * Context Engine Types v1.1
 * Evidence-based project reasoning system
 */

import type { FileInfo, ScanResult } from '../types.js';

export type FileImportance = 'core' | 'support' | 'config';

/**
 * File insight with evidence-based reasoning
 */
export interface FileInsight {
  file: string;  // basename only, disambiguated if needed
  path: string;  // full path for reference
  role: string;  // semantic role in system
  description: string;  // what it actually does
  evidence: string[];  // WHY this conclusion was made
  importance: FileImportance;
  priorityScore: number;  // 0-100, deterministic
}

export interface DependencyEdge {
  from: string;  // full path (unique identifier)
  to: string;    // full path (unique identifier)
}

export interface DependencyGraph {
  nodes: string[];  // unique basenames
  edges: DependencyEdge[];  // real import relationships
}

export interface CategorizedFiles {
  core: string[];     // just filenames
  support: string[];  // just filenames
  config: string[];   // just filenames
}

/**
 * Evidence-based project summary
 */
export interface ProjectSummary {
  type: string | 'unknown';
  purpose: string | 'inferred from evidence' | 'unknown';
  architecture: string | 'discovered' | 'flat';
}

/**
 * Architecture discovered from dependency graph (no presets)
 */
export interface Architecture {
  clusters: string[];  // detected module clusters
  flow: string[];      // inferred data flow
  confidence: number;  // 0-1, how certain we are
}

/**
 * Mental model with confidence scoring
 */
export interface MentalModel {
  whatItDoes: string;
  howItWorks: string;
  whyItExists: string;
  confidence: number;  // 0-1, evidence strength
}

/**
 * Behavioral flow discovered from code analysis
 */
export interface BehavioralFlow {
  entryPoints: string[];     // files that start execution
  executionPath: string[];   // likely runtime sequence
  confidence: number;        // 0-1, certainty of flow
}

/**
 * Complete context result with evidence
 */
export interface ContextResult {
  projectSummary: ProjectSummary;
  mentalModel: MentalModel;
  fileInsights: FileInsight[];
  dependencyGraph: DependencyGraph;
  architecture: Architecture;
  categorizedFiles: CategorizedFiles;
  behavioralFlow: BehavioralFlow;
}

export interface ImportInfo {
  source: string;
  imports: string[];
  resolvedPaths: string[];  // actual resolved file paths
  isExternal: boolean;
}
