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

## Deployment

The Render Blueprint in `render.yaml` deploys the compiler API as `cpppad-compiler` and configures CORS for `https://web-based-c-compiler.vercel.app`. The API forwards compile requests to Wandbox, so the Render service does not need a local C++ toolchain.

After creating the Render service, set `VITE_API_URL` in the Vercel project's environment variables to the service's base URL, for example `https://cpppad-compiler.onrender.com` (without `/api`). Redeploy the Vercel project after changing the variable. Leave it unset for same-origin development or Vercel's built-in API route.

## Limits

- One active file is compiled per run (max 64 KB).
- No stdin and no GUI or graphics output, since programs run on Wandbox.
- Compilation needs a network connection to Wandbox.
