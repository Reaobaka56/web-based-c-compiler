# CppPad: C++ in the browser

A browser-based C++ editor with a file manager (IndexedDB) and online compile-and-run.

## Quick start

```bash
npm install
npm run dev
```

Press Run to compile and execute the active C++ file with GCC through the
[Wandbox API](https://wandbox.org/). The output and compiler diagnostics appear
in the terminal. During local development Vite proxies the API request; on
Vercel, `api/compile.ts` provides the proxy endpoint.

The source file is sent to Wandbox for compilation and execution. Do not use
this service for confidential code. This version compiles one active source file
at a time; interactive stdin and the GUI drawing example are not supported by
the online runner.

## Architecture

```
src/
├── App.tsx                 layout, tabs, run/stop orchestration
├── editor/Editor.tsx       CodeMirror 6 (C++ syntax, theme-aware)
├── fs/vfs.ts               IndexedDB-backed virtual file system
├── fs/FileManager.tsx      explorer: create/delete/open
├── compiler/clang.ts       online compiler API client
├── api/compile.ts          Vercel proxy to Wandbox GCC
├── runner/WorkerHost.ts    worker lifecycle (legacy)
├── runner/program.worker.ts  WASI preview1 shim (legacy)
├── terminal/Terminal.tsx   xterm.js console
└── gui/CanvasWindow.tsx    draggable canvas for GUI output
```

## Notes & limits

- Single-threaded WASM by default; `std::thread` needs cross-origin isolation
  (COOP/COEP headers are already set in `vite.config.ts`).
- The sandbox exposes no filesystem to programs (`path_open` → ENOSYS);
  extend `program.worker.ts` if you want file I/O against the VFS.
- Large toolchains should be lazy-loaded and cached (Cache API / IndexedDB).
