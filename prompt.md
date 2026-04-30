We are building a CLI tool called "Koda".

Tech stack:
- Node.js
- TypeScript
- Commander.js (CLI commands)
- Fast-glob (file scanning)
- Zod (validation)
- Ink (CLI UI - optional for later phases)
- SQLite (not used in this first phase yet)
- dotenv (not used in this first phase yet)

---

GOAL (MVP - Phase 1 ONLY):

We will implement ONLY the "Scanner Core Module".

---

FUNCTIONALITY:

When the user runs:

  koda .

The tool should:

1. Scan the target project directory recursively
2. Collect all files
3. Filter out unnecessary files (junk / noise)
4. Return a clean structured list of relevant files

---

IGNORE (must be excluded):

- node_modules
- dist
- build
- .git
- coverage
- lock files
- images/videos/binary files

---

OUTPUT:

The scanner should return a structured result containing:

1. Project tree (folder structure)
2. List of important files only
3. Clean separation between:
   - core source files
   - config files
   - ignored files (not included in final output)

---

IMPORTANT RULES:

- Do NOT build CLI UI yet (Ink is not needed in this phase)
- Do NOT implement database (SQLite is not used yet)
- Focus ONLY on scanner logic
- Keep code modular and clean
- Use TypeScript properly with types

---

EXPECTED RESULT:

A function/module called:

  scanProject(path: string)

That returns:

- tree structure
- filtered file list
- metadata (size, path)

---

GOAL OF THIS PHASE:

Build a clean "file understanding layer" that will later be used for AI context building.