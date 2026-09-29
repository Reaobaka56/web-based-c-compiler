# CppPad: C++ in the browser

A browser-based C++ editor with an IndexedDB-backed workspace and online compilation through Wandbox.

## Quick start

```bash
npm install
npm run dev
```

Press Run to compile the active file with GCC through Wandbox. The compiler output and program output appear in the terminal.

The source file is sent to Wandbox for compilation and execution. Do not use this service for confidential code. This version compiles one active source file at a time.

## Architecture

```
api/
└── compile.ts            Vercel serverless proxy to Wandbox (GCC)

src/
├── App.tsx               layout, tabs, run orchestration
├── compiler/clang.ts     client for /api/compile
├── editor/Editor.tsx     CodeMirror 6 (C++ syntax, light/dark)
├── fs/vfs.ts             IndexedDB-backed virtual file system
├── fs/FileManager.tsx    file list: create / open / delete
└── terminal/Terminal.tsx xterm.js output panel
```

## Limits

- One active file is compiled per run (max 64 KB).
- No stdin and no GUI or graphics output, since programs run on Wandbox.
- Compilation needs a network connection to Wandbox.
