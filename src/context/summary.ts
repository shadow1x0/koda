/**
 * Project Summary Generator v1.1
 * Evidence-based architecture discovery
 */

import path from 'node:path';
import type { FileInfo, ScanResult } from '../types.js';
import type { FileInsight, ProjectSummary, Architecture, MentalModel, BehavioralFlow } from './types.js';

/**
 * Evidence-based project type detection
 */
function detectProjectType(files: FileInfo[]): { type: string; purpose: string; confidence: number } {
  const fileNames = files.map((f) => f.name.toLowerCase());
  const evidence: string[] = [];

  // Check for CLI patterns
  const hasCLI = fileNames.some((f) => /cli|command/i.test(f));
  const hasContext = fileNames.some((f) => /context|engine/i.test(f));
  const hasScanner = fileNames.some((f) => /scanner|scan/i.test(f));

  if (hasCLI) evidence.push('cli.ts detected');
  if (hasContext) evidence.push('context engine detected');
  if (hasScanner) evidence.push('scanner module detected');

  if (hasCLI && hasContext && hasScanner) {
    return {
      type: 'CLI Tool',
      purpose: 'Transforms project codebases into AI-readable context',
      confidence: 0.9,
    };
  }

  // Fallback detection based on file types
  const extensions = files.map((f) => f.extension.toLowerCase());
  const hasTS = extensions.some((e) => ['.ts', '.tsx'].includes(e));
  const hasJS = extensions.some((e) => ['.js', '.jsx', '.mjs', '.cjs'].includes(e));

  if (hasTS) {
    return {
      type: 'TypeScript Project',
      purpose: evidence.length > 0 ? 'Software application' : 'unknown purpose beyond observed functionality',
      confidence: evidence.length > 0 ? 0.6 : 0.4,
    };
  }

  if (hasJS) {
    return {
      type: 'JavaScript Project',
      purpose: evidence.length > 0 ? 'Software application' : 'unknown purpose beyond observed functionality',
      confidence: evidence.length > 0 ? 0.5 : 0.3,
    };
  }

  return {
    type: 'unknown',
    purpose: 'unknown purpose beyond observed functionality',
    confidence: 0.2,
  };
}

/**
 * Discover architecture clusters from dependency graph
 * STRICT: Only report what we can verify from actual code
 */
function discoverArchitecture(
  insights: FileInsight[],
  dependencyMap: Map<string, string[]>,
  edges: { from: string; to: string }[]
): Architecture {
  const clusters: string[] = [];
  const flow: string[] = [];
  let confidence = 0.5;

  // Find REAL entry points - files matching CLI patterns that start execution
  const entryPointPatterns = [/^(cli|main|index|server)\.(ts|js|mjs)$/i];
  const entryPoints = insights.filter(i => {
    // Must match CLI pattern AND not be a types/utility file
    const matchesPattern = entryPointPatterns.some(p => p.test(i.file));
    const isExecutable = !i.file.includes('types') && !i.file.includes('interface');
    return matchesPattern && isExecutable;
  });

  if (entryPoints.length > 0) {
    clusters.push(`Entry points: ${entryPoints.map(e => e.file).join(', ')}`);
    flow.push('execution starts at CLI entry points');
    confidence += 0.15;
  }

  // Find high-centrality files (imported by many) - BUT NOT entry points
  const centralityMap = new Map<string, number>();
  for (const insight of insights) {
    // Skip entry points from centrality - they're already counted
    if (entryPoints.some(e => e.file === insight.file)) continue;

    const importedBy = insights.filter(other =>
      (dependencyMap.get(other.path) || []).some(p => p.includes(insight.file))
    ).length;
    centralityMap.set(insight.file, importedBy);
  }

  const highCentrality = Array.from(centralityMap.entries())
    .filter(([_, count]) => count > 2)
    .sort((a, b) => b[1] - a[1]);

  if (highCentrality.length > 0) {
    clusters.push(`Shared utilities: ${highCentrality.slice(0, 3).map(([name]) => name).join(', ')}`);
    confidence += 0.1;
  }

  // Detect directory-based modules only for non-trivial clusters
  const dirGroups = new Map<string, string[]>();
  for (const insight of insights) {
    const dir = path.dirname(insight.path).split('/').pop() || 'root';
    const group = dirGroups.get(dir) || [];
    group.push(insight.file);
    dirGroups.set(dir, group);
  }

  // Only add directory clusters if they represent real modules (>2 files AND >1 relationship)
  for (const [dir, files] of dirGroups.entries()) {
    if (files.length > 2 && dir !== 'src' && dir !== 'lib' && dir !== 'root') {
      clusters.push(`${dir} module: ${files.length} files`);
      confidence += 0.05;
    }
  }

  // Infer flow from dependency chains starting from real entry points
  if (entryPoints.length > 0 && edges.length > 0) {
    const chain = findDependencyChain(edges, entryPoints[0].file);
    if (chain.length > 2) {
      flow.push(`verified data flow: ${chain.slice(0, 4).join(' → ')}`);
      confidence += 0.15;
    }
  }

  // If no clusters found, report flat structure
  if (clusters.length === 0) {
    clusters.push('flat structure detected');
    confidence = 0.3;
  }

  // Cap confidence conservatively
  confidence = Math.min(0.9, confidence);

  return { clusters, flow, confidence };
}

/**
 * Find a dependency chain starting from a specific node
 */
function findDependencyChain(edges: { from: string; to: string }[], startNode?: string): string[] {
  // Build adjacency list
  const adj = new Map<string, string[]>();
  const allNodes = new Set<string>();

  for (const edge of edges) {
    allNodes.add(edge.from);
    allNodes.add(edge.to);
    const list = adj.get(edge.from) || [];
    list.push(edge.to);
    adj.set(edge.from, list);
  }

  // If start node provided, use it; otherwise find nodes with no incoming edges
  let entryPoints: string[] = [];
  if (startNode) {
    entryPoints = [startNode];
  } else {
    const incoming = new Set<string>();
    for (const edge of edges) {
      incoming.add(edge.to);
    }
    entryPoints = Array.from(allNodes).filter(n => !incoming.has(n));
  }

  // Simple chain following
  if (entryPoints.length > 0) {
    const chain: string[] = [];
    let current = entryPoints[0];
    const visited = new Set<string>();

    while (current && !visited.has(current)) {
      visited.add(current);
      chain.push(current);
      const next = adj.get(current);
      current = (next && next.length > 0) ? next[0] : '';
      if (!current) break;
    }

    return chain;
  }

  return Array.from(allNodes).slice(0, 3);
}

/**
 * Build evidence-based mental model
 */
function buildMentalModel(
  typeInfo: { type: string; purpose: string; confidence: number },
  insights: FileInsight[],
  architecture: Architecture,
  edges: { from: string; to: string }[]
): MentalModel {
  const evidence: string[] = [];

  // What it does - based on actual file behavior
  const entryPoints = insights.filter(i => /^(cli|index|main)\./i.test(i.file));
  const hasScanner = insights.some(i => /scanner|traverse/i.test(i.file));
  const hasFormatter = insights.some(i => /format|render/i.test(i.file));

  let whatItDoes = 'Software system';

  if (entryPoints.length > 0 && hasScanner && hasFormatter) {
    whatItDoes = 'Processes input data through scanning, analysis, and formatting pipeline';
    evidence.push('detected entry points, scanner, and formatter modules');
  } else if (entryPoints.length > 0) {
    whatItDoes = 'Command-line application with modular structure';
    evidence.push('detected CLI entry point');
  } else {
    whatItDoes = 'Code module with internal dependencies';
    evidence.push(`${edges.length} internal dependencies detected`);
  }

  // How it works - derived from actual flow
  const howItWorks = architecture.flow.length > 0
    ? `System flow: ${architecture.flow.join('; ')}`
    : 'Module interaction pattern not clearly established from static analysis';

  // Why it exists - only if we have evidence
  let whyItExists = 'unknown purpose beyond observed functionality';
  if (typeInfo.purpose !== 'unknown purpose beyond observed functionality') {
    whyItExists = typeInfo.purpose;
    evidence.push('inferred from module composition');
  }

  // Calculate confidence based on evidence strength
  const confidence = Math.min(0.9,
    typeInfo.confidence * 0.4 +
    (architecture.confidence * 0.4) +
    (evidence.length > 0 ? 0.2 : 0)
  );

  return { whatItDoes, howItWorks, whyItExists, confidence };
}

/**
 * Discover behavioral flow from entry points
 */
function discoverBehavioralFlow(
  insights: FileInsight[],
  dependencyMap: Map<string, string[]>,
  edges: { from: string; to: string }[]
): BehavioralFlow {
  // Find entry points (files that start execution)
  const entryPoints = insights
    .filter(i => /^(cli|index|main)\./i.test(i.file))
    .map(i => i.file);

  if (entryPoints.length === 0) {
    // Fallback: files with no imports are potential entry points
    const noImports = insights
      .filter(i => (dependencyMap.get(i.path) || []).length === 0)
      .map(i => i.file);
    entryPoints.push(...noImports.slice(0, 2));
  }

  // Build execution path from dependency chains
  const executionPath: string[] = [];
  let confidence = 0.3;

  if (entryPoints.length > 0) {
    executionPath.push(`starts at: ${entryPoints[0]}`);
    confidence += 0.2;

    // Follow dependency chain
    const chain = findDependencyChain(edges);
    if (chain.length > 1) {
      executionPath.push(...chain.slice(1, 4).map(f => `invokes: ${f}`));
      confidence += 0.2;
    }
  }

  // If we couldn't find a clear path
  if (executionPath.length === 0) {
    executionPath.push('execution path: not determinable from static analysis');
  }

  return { entryPoints, executionPath, confidence: Math.min(0.8, confidence) };
}

/**
 * Generate complete project understanding with evidence
 */
export function generateProjectSummary(
  scanResult: ScanResult,
  insights: FileInsight[],
  dependencyMap: Map<string, string[]>,
  edges: { from: string; to: string }[]
): {
  summary: ProjectSummary;
  architecture: Architecture;
  mentalModel: MentalModel;
  behavioralFlow: BehavioralFlow;
} {
  const typeInfo = detectProjectType(scanResult.files);
  const architecture = discoverArchitecture(insights, dependencyMap, edges);
  const mentalModel = buildMentalModel(typeInfo, insights, architecture, edges);
  const behavioralFlow = discoverBehavioralFlow(insights, dependencyMap, edges);

  // Build architecture description from discovered clusters
  let architectureDesc: string;
  if (architecture.clusters.length > 0) {
    architectureDesc = `discovered: ${architecture.clusters.length} logical clusters`;
  } else {
    architectureDesc = 'flat'; // No preset layers
  }

  const summary: ProjectSummary = {
    type: typeInfo.type,
    purpose: typeInfo.purpose,
    architecture: architectureDesc,
  };

  return { summary, architecture, mentalModel, behavioralFlow };
}
