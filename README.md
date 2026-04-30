# Koda

[![npm version](https://img.shields.io/npm/v/koda.svg)](https://www.npmjs.com/package/koda)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

**From repo to perfect AI prompt in seconds.**

Koda transforms your codebase into structured, evidence-based context that LLMs can actually understand—without hallucinations or noise. Perfect for ChatGPT, Claude, Copilot, and any AI assistant.

> **"I just joined a new team with 200+ files. Koda gave me the full picture in 3 seconds."**

---

## Installation

```bash
npm install -g koda
```

Or use without installing:
```bash
npx koda explain .
```

---

## Quick Start

### 3 Modes for Different Needs

```bash
# 🎯 EXPLAIN - Get project overview (what it is, where to start)
koda explain .

# ❓ ASK - Answer specific questions with relevant files
koda ask . "how does authentication work?"
koda ask . "why is login slow?" --max-files 15

# 📄 CONTEXT - Full AI context with code snippets
koda context . --max-tokens 8000
```

### Options

| Command | Option | Description |
|---------|--------|-------------|
| `explain` | `--max-files <n>` | Max files to include (default: 7) |
| `ask` | `--max-files <n>` | Max files to include (default: 10) |
| `context` | `--max-tokens <n>` | Token budget (default: 4000) |

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

### `koda explain .` Output

```markdown
# Project Overview: my-api

## What is this?
REST API built with Express and TypeScript. Handles user authentication,
CRUD operations, and real-time notifications.

## Where to start
1. `src/server.ts` - Application entry point
2. `src/routes/index.ts` - Route definitions
3. `src/db/connection.ts` - Database setup

## Architecture
- **Type:** TypeScript/Node.js
- **Entry Points:** server.ts
- **Key Modules:** routes, controllers, middleware
- **Database:** PostgreSQL via TypeORM

## File Guide
1. **server.ts** exports: app, startServer
2. **routes/index.ts** exports: apiRouter, authRouter
3. **auth.controller.ts** exports: login, register, verifyToken
4. **middleware/auth.ts** exports: requireAuth, optionalAuth
```

### `koda ask . "how does auth work?"` Output

```markdown
# Question: "how does auth work?"

## Project: TypeScript

## Searching for: auth, login, token, verify

## Top 5 Relevant Files

1. **auth.controller.ts** - `/src/controllers/auth.controller.ts`
   Exports: login, register, verifyToken, refreshToken

2. **jwt.middleware.ts** - `/src/middleware/jwt.middleware.ts`
   Exports: verifyJWT, extractToken

3. **auth.service.ts** - `/src/services/auth.service.ts`
   Exports: validateCredentials, generateTokens

4. **user.model.ts** - `/src/models/user.model.ts`
   Exports: User, UserSchema

5. **routes/auth.ts** - `/src/routes/auth.ts`
   Exports: authRouter

---
Answer the question using the file context above.
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
git clone https://github.com/yourusername/koda.git
cd koda
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run dev
```

### Project Structure

```
src/
├── cli.ts              # CLI entry point
├── scanner.ts          # File system scanner
├── cache/              # Caching system
│   └── index.ts
├── context/            # Context engine
│   ├── index.ts        # Main compression logic
│   ├── detector.ts     # Dependency detection
│   ├── extractor.ts    # Content extraction
│   ├── formatter.ts    # Output formatting
│   ├── prioritizer.ts  # File ranking
│   └── types.ts
├── modes/              # Operation modes
│   ├── explain.ts      # Project overview mode
│   ├── ask.ts          # Question answering mode
│   └── types.ts
└── types.ts            # Shared types
```

---

## Roadmap

- [x] **Phase 1**: Project scanner, file filtering, tree generation
- [x] **Phase 2**: Evidence-based reasoning engine
- [x] **Phase 3**: VS Code auto-context extension
- [x] **Phase 4**: Critical bug fixes (compression, dependencies, detection)
- [x] **Phase 5**: Content extraction (file headers, exports, signatures)
- [x] **Phase 6**: Smart modes (`explain`, `ask`, `context`)
- [x] **Phase 7**: Caching for fast subsequent runs
- [ ] **Phase 8**: `koda share` for shareable context links
- [ ] **Phase 9**: Semantic search (embeddings-based ask mode)

---

## License

MIT
