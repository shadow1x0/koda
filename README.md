# Koda

**AI-ready context generation for any codebase.**

Koda transforms your project into a structured, evidence-based context file that AI assistants can understand—without hallucinations, assumptions, or noise.

---

## Quick Start

### CLI (Universal)

```bash
# Install globally
npm install -g koda

# Generate context for current project
koda context .

# Adjust token limit (default: 4000)
koda context . --max-tokens 8000
```

### VS Code Extension (Auto-Context)

```bash
cd vscode-extension
npm install
npm run compile
```

Then in VS Code: `Extensions: Install from VSIX` → Select the `.vsix` file.

The extension automatically updates `.koda/context.md` on every file save.

---

## What Makes Koda Different

| Feature | Koda | Other Tools |
|---------|------|-------------|
| **Evidence-based** | Every conclusion has proof | Often assumes/guesses |
| **No hallucinations** | "Unknown" instead of wrong | Fakes architecture layers |
| **Real dependencies** | Parses actual imports | Infers from folder names |
| **Confidence scores** | 0-1 on all inferences | Binary yes/no |
| **Deterministic** | Same input = same output | Random variations |

---

## Output Example

```markdown
# TypeScript Project Context

> Compressed from 12 files to 5 critical files (~1200 tokens)

## Entry Points
- cli.ts
- index.ts

## Critical Files (ranked by importance)

1. **cli.ts**
   - Path: /home/user/project/src/cli.ts
   - Score: 85/100 (entry point, near root)
   - Size: 2.1KB

2. **scanner.ts**
   - Path: /home/user/project/src/scanner.ts
   - Score: 70/100 (imported by several files, in execution path)
   - Size: 4.5KB

---
Use this context to understand the codebase structure before answering questions.
```

---

## Core Principles

1. **Evidence > Intuition**: Every claim needs proof from actual code
2. **Unknown > Wrong**: Prefer "insufficient evidence" over fabrication
3. **Correctness > Completeness**: Better to say less but be right
4. **Real > Assumed**: Only report verified dependencies and relationships

---

## Development

```bash
# Clone and install
git clone <repo>
cd Koda
npm install

# Build CLI
npm run build

# Build VS Code extension
cd vscode-extension
npm install
npm run compile
```

---

## Roadmap

- [x] **Phase 1**: Project scanner, file filtering, tree generation
- [x] **Phase 2**: Evidence-based reasoning engine
- [x] **Phase 3**: VS Code auto-context extension
- [x] **Phase 4**: Critical bug fixes (compression, dependencies, detection)
- [ ] **Phase 5**: Content extraction (file headers, exports, signatures)
- [ ] **Phase 6**: Smart modes (`explain`, `ask`, `context`)
- [ ] **Phase 7**: Caching for fast subsequent runs
- [ ] **Phase 8**: `koda share` for shareable context links

---

## License

MIT
