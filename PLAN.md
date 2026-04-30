# Koda: Repo-to-Prompt Engine - Implementation Plan

## Product Vision

**Tagline:** "From repo to perfect prompt in seconds"

**Core Promise:** Turn any codebase into an AI-ready context that actually helps LLMs understand, debug, and work with your project.

**Target Audience:**
- Heavy AI users (ChatGPT/Claude/Copilot daily)
- Developers switching between repos (consultants, team leads)
- Large codebase maintainers (>50 files)
- Anyone who needs "quick understanding" over "deep reading"

---

## Phase 1: Critical Bug Fixes (Week 1)

### 1.1 Fix Compression Algorithm
**File:** `src/context/index.ts:70-82`

**Problem:** The `break` statement stops at first file that doesn't fit budget, skipping potentially important smaller files later.

**Current:**
```typescript
if (currentTokens + fileTokens <= availableTokens) {
    selectedFiles.push(ranked);
    currentTokens += fileTokens;
} else {
    break; // ← BUG: stops completely
}
```

**Fix:**
```typescript
// Continue searching for smaller files that might fit
if (currentTokens + fileTokens <= availableTokens) {
    selectedFiles.push(ranked);
    currentTokens += fileTokens;
} else {
    // File too big, but continue to find smaller ones
    continue;
}
```

**Alternative (Better):** Sort files by a "value density" score (importance/tokens) and pick greedily by value, not just order.

---

### 1.2 Fix Dependency Graph Key Collision
**File:** `src/context/detector.ts:133-158`

**Problem:** Using `basename` (e.g., "index.ts") as identifier causes collisions when multiple files share the same name.

**Current:**
```typescript
edges.push({
    from: file.name,      // "index.ts" - ambiguous!
    to: targetName,       // "index.ts" - which one?
});
```

**Fix:**
```typescript
// Use full path as unique identifier
edges.push({
    from: file.path,           // absolute/resolved path
    to: resolvedPath,          // absolute path
});

// Update reverse map to use paths too
```

Also update:
- `buildDependencyMap()` - use paths as keys
- `buildReverseDependencyMap()` - use paths as keys
- `rankFiles()` in prioritizer - accept path-based maps

---

### 1.3 Improve Project Type Detection
**File:** `src/context/index.ts:17-28`

**Problem:** Only checking for `package.json` is insufficient. Many projects have multiple markers.

**Current:**
```typescript
if (hasPackageJson) return 'TypeScript/Node.js';
```

**Fix:**
```typescript
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
    if (hasPackageJson && (tsFiles > jsFiles) && tsFiles > 0) return 'TypeScript';
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
```

---

### 1.4 Align Documentation with Reality

**Files to update:**
- `README.md` - fix command examples
- `prompt.md` - update to reflect actual architecture

**Changes:**
- Change `koda .` to `koda context .`
- Remove `--json` and `--ai` flags (don't exist yet)
- Update roadmap to match actual state
- Document actual CLI interface

---

## Phase 2: Add File Content (Week 2)

### 2.1 Create Content Extractor
**New File:** `src/context/extractor.ts`

**Requirements:**
```typescript
interface FileContent {
    path: string;
    header: string;           // First 30-50 lines
    exports: string[];        // Export signatures
    imports: string[];        // Import statements  
    functions: string[];      // Function declarations (signatures only)
    classes: string[];        // Class declarations
    configValues?: Record<string, string>; // Key const/let exports
}

function extractSmartContent(filePath: string, maxTokens: number): FileContent;
```

**Implementation details:**
1. Read file (max 500 lines initially)
2. Extract imports section (usually first 10-20 lines)
3. Extract all export statements
4. Extract function signatures (name + params, no body)
5. Extract class declarations
6. Extract exported constants with their values
7. Truncate intelligently based on token budget

**Extraction patterns:**
```typescript
const PATTERNS = {
    imports: /^(import|require)\s+.*/gm,
    exports: /^(export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type)\s+(\w+))/gm,
    functions: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/gm,
    classes: /^(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/gm,
};
```

---

### 2.2 Update Token Estimation
**File:** `src/context/index.ts`

**Current:** Only estimates path + name length

**Fix:** Include actual content tokens:
```typescript
function estimateFileTokens(file: FileInfo, content: FileContent): number {
    const metadataTokens = estimateTokens(`${file.path} ${file.name}`) + 50;
    const contentTokens = estimateTokens(
        content.header + 
        content.exports.join(' ') + 
        content.functions.join(' ')
    );
    return metadataTokens + contentTokens;
}
```

---

### 2.3 Update Formatter with Content
**File:** `src/context/formatter.ts`

**New output format:**
```markdown
# {projectType} Project Context

> Compressed from {total} files to {included} critical files (~{tokens} tokens)

## Entry Points
- {entryPoint} - {brief description from first comment}

## Critical Files

### 1. {filename}
**Path:** `{path}`  
**Why:** {reasons}

**Exports:**
```typescript
export function processData(input: string): Result;
export const MAX_RETRIES = 3;
```

**Key Code:**
```typescript
// First 30 lines of actual code
import { something } from './lib';

export async function main() {
    // ...
}
```
```

---

## Phase 3: Modes System (Week 3)

### 3.1 Create Mode Types
**New File:** `src/modes/types.ts`

```typescript
export type Mode = 'explain' | 'ask' | 'onboard';

export interface ModeConfig {
    name: Mode;
    description: string;
    fileSelector: (files: FileInfo[], deps: DependencyData, query?: string) => FileInfo[];
    formatter: (files: FileInfo[], contents: FileContent[]) => string;
    maxFiles: number;
    includeContent: boolean;
}
```

---

### 3.2 Implement 'explain' Mode
**New File:** `src/modes/explain.ts`

**Purpose:** Give overview of project - what it is, where to start, how it works

**File selection strategy:**
1. Entry points (cli.ts, index.ts, main.go, etc.)
2. Config files (package.json, README, tsconfig)
3. Files with highest in-degree in dependency graph (most imported)
4. Root-level source files

**Output format:**
```markdown
# Project Overview: {name}

## What is this?
{inferred from package.json description + README first paragraph}

## Where to start
1. {main entry point} - application entry
2. {core module} - primary logic
3. {config file} - configuration

## Architecture
- **Type:** {project type}
- **Entry:** {entry points}
- **Key Modules:** {top 3 most connected files}
- **Dependencies:** {external packages count}

## File Guide
{5-7 most important files with one-line descriptions}
```

---

### 3.3 Implement 'ask' Mode (Basic)
**New File:** `src/modes/ask.ts`

**Purpose:** Answer specific questions about the codebase

**File selection strategy (keyword-based):**
1. Extract keywords from question
2. Score files by:
   - Filename matches keyword
   - Content contains keyword (in exports, function names)
   - Files that import/export from matching files
3. Select top N files by score

**Example:**
```bash
koda ask "why is login slow?"
```

Should select:
- Files with "auth", "login", "session" in name
- Files containing these keywords in exports
- Files that depend on auth files

---

### 3.4 Update CLI with Modes
**File:** `src/cli.ts`

**New command structure:**
```typescript
program
    .command('explain <path>')
    .description('Understand a project - what it does and where to start')
    .option('--max-files <n>', 'Max files to include', '7')
    .action(explainHandler);

program
    .command('ask <path> <question>')
    .description('Ask a specific question about the codebase')
    .option('--max-files <n>', 'Max files to include', '10')
    .action(askHandler);

program
    .command('context <path>')
    .description('Generate full AI context (legacy mode)')
    .option('--max-tokens <n>', 'Token limit', '4000')
    .action(contextHandler);
```

---

## Phase 4: Caching & Performance (Week 4)

### 4.1 Create Cache System
**New File:** `src/cache/index.ts`

```typescript
interface CacheEntry {
    path: string;
    mtime: number;           // Last modified time
    size: number;
    hash: string;            // Content hash
    dependencies: string[]; // Resolved dependencies
    exports: string[];       // Extracted exports
}

interface CacheData {
    version: string;
    createdAt: string;
    projectRoot: string;
    files: Map<string, CacheEntry>;
    dependencyGraph: DependencyGraph;
}

class ProjectCache {
    private cachePath: string;
    
    async load(): Promise<CacheData | null>;
    async save(data: CacheData): Promise<void>;
    async invalidateChangedFiles(files: FileInfo[]): Promise<CacheData>;
    isValid(file: FileInfo, entry: CacheEntry): boolean;
}
```

**Cache location:** `.koda/cache.json` (gitignored)

---

### 4.2 Integrate Cache into Scanning
**File:** `src/scanner.ts`

**Optimization flow:**
1. Load cache if exists
2. For each file:
   - If in cache and mtime/size match → use cached data
   - Else → parse fresh and update cache
3. Save updated cache after scan

**Expected speedup:**
- First run: ~2-5s for 100 files
- Subsequent runs: ~0.5s (just stat checks)

---

### 4.3 Dependency Graph Caching
Store parsed dependency graph in cache and only re-parse:
- Files that changed
- Files that import changed files (reverse dependencies)

---

## Phase 5: Polish & Release Prep (Week 5)

### 5.1 Add Progress Indicators
```typescript
// For large repos
Scanning... 45/127 files [========>          ] 35%
Parsing dependencies... [=========>           ] 40%
Building context... done
```

### 5.2 Error Handling
- Graceful handling of unreadable files
- Clear error messages for common issues
- Suggestions for fixes

### 5.3 Test Suite
- Unit tests for content extraction
- Unit tests for file ranking
- Integration tests for each mode
- Performance benchmarks

### 5.4 Documentation
- Update README with new commands
- Add examples for each mode
- Create usage guide
- Document caching behavior

---

## Deferred Features (Post-Launch)

### `diff` Mode
Compare current state with previous commit/branch:
```bash
koda diff --since HEAD~3  # What changed in last 3 commits?
koda diff --branch main   # Compare to main
```

### `review` Mode  
Prepare context for PR review:
```bash
koda review src/feature.ts  # Context for reviewing specific file
```

### Semantic Search
Use embeddings for better `ask` mode results instead of keyword matching.

### Shareable Packs
```bash
koda pack --output context.md  # Single file output
koda pack --json               # JSON format
```

### VS Code Extension Update
Auto-context generation on file save with caching.

---

## Key Technical Decisions

### 1. Path vs Basename
**Decision:** Use full paths as internal identifiers, show basenames in UI only.

**Rationale:** Prevents collisions, enables accurate dependency tracking.

### 2. Content Extraction Strategy
**Decision:** Header (first 30-50 lines) + exports + signatures, not full files.

**Rationale:**
- Headers contain imports and main logic entry
- Exports show public API surface  
- Full files consume too many tokens
- Signatures give AI enough context without implementation details

### 3. Mode-Based vs Generic
**Decision:** Move from generic "context" to purpose-built modes.

**Rationale:**
- Users don't want "context" - they want answers
- Different goals need different file selection
- Easier to explain value proposition
- Clearer UX (specific commands vs flags)

### 4. Token Budget Allocation
**Decision:** Fixed overhead (500 tokens) + proportional file allocation.

**Formula:**
```
available = maxTokens - overhead
perFile = available / targetFileCount
contentLimit = perFile * 0.8  // Reserve 20% for metadata
```

### 5. Cache Invalidation
**Decision:**_mtime + size checking (fast) over content hashing (slow).

**Rationale:** Good enough for development, much faster. Hash only if mtime matches but size differs (rare).

---

## Success Metrics

### Technical
- [ ] Compression includes all files that fit (no early break)
- [ ] Dependency graph has zero false edges from name collisions
- [ ] Cache reduces scan time by 70%+ on subsequent runs
- [ ] Content extraction works for .ts, .js, .py, .go, .rs

### Product  
- [ ] `explain` mode gives useful overview in <3s
- [ ] `ask` mode returns relevant files for 80%+ of questions
- [ ] Output fits in 4K tokens with meaningful content
- [ ] Users can copy-paste output directly to ChatGPT/Claude

### Adoption
- [ ] Clear value proposition in README
- [ ] Working examples for all modes
- [ ] Installation works via npm install -g

---

## Implementation Order Summary

| Week | Focus | Key Deliverables |
|------|-------|------------------|
| 1 | Bug fixes | Fixed compression, fixed deps, better detection, aligned docs |
| 2 | Content extraction | Extractor module, updated formatter, content in output |
| 3 | Modes | explain mode, ask mode (basic), updated CLI |
| 4 | Caching | Cache system, fast subsequent runs, dependency caching |
| 5 | Polish | Progress bars, error handling, tests, docs |

---

## Risk Mitigation

**Risk:** Content extraction too slow
**Mitigation:** Start with simple regex, add caching, optimize hot paths

**Risk:** Token estimation inaccurate  
**Mitigation:** Conservative estimates, reserve 20% buffer, measure actual tokens

**Risk:** Ask mode returns irrelevant files
**Mitigation:** Start simple (keywords), clear docs on limitations, iterate based on usage

**Risk:** Breaking changes to existing users
**Mitigation:** Keep `koda context` working, add new commands as additions not replacements

---

## Next Steps (Immediate Action Items)

1. Fix compression `break` → `continue` (10 min)
2. Fix dependency graph to use paths (30 min)
3. Add basic content extraction for TypeScript files (2 hours)
4. Update README to match actual CLI (30 min)
5. Test on 3 real projects (1 hour)

**Total:** ~4 hours to get from broken to functional baseline.
