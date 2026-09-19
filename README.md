# CPP://Web — Web-Based C++ Compiler IDE

A C++ IDE that runs entirely in the browser: editor, file manager (IndexedDB),
in-browser compilation via wasm-clang, execution in a sandboxed Web Worker
(WASI shim), terminal I/O, and a canvas window for GUI programs (SDL2/raylib
Emscripten ports draw to it).

## Quick start

```bash
npm install
npm run dev
```

Everything works out of the box in **DEMO MODE**: pressing Run executes a
prebuilt `hello.wasm` through the full pipeline (compile → link → worker →
WASI → terminal), so you can verify the architecture immediately.

## Enable REAL C++ compilation

The Clang/LLVM toolchain (~50MB+) is too large to ship in this repo. To enable:

1. Download a wasm-clang build (e.g. https://github.com/binji/wasm-clang
   or any fork shipping a wasm32 clang + wasm-ld + sysroot).
2. Copy these files into `public/toolchain/`:
   - `clang.wasm` — the compiler
   - `wasm-ld.wasm` — the linker
   - `sysroot/` — libc/libc++ headers and libraries for wasm32
3. Restart the dev server. The status flips to `toolchain: READY`.

Then wire your build's loading API into `src/compiler/clang.ts`
(`compileProject`) — the function is annotated with the exact pipeline:
per-TU compile to `.o`, then `wasm-ld` into `a.out.wasm`, returned as bytes.

## GUI programs

Programs using the SDL2 or raylib Emscripten ports call C functions that map
to canvas operations through the worker's `env` imports
(`gui_clear`, `gui_rect`, `gui_circle` — extend as needed). The canvas window
is draggable and receives ops via postMessage.

## Architecture

```
src/
├── App.tsx                 layout, tabs, run/stop orchestration
├── editor/Editor.tsx       CodeMirror 6 (C++ syntax, one-dark)
├── fs/vfs.ts               IndexedDB-backed virtual file system
├── fs/FileManager.tsx      explorer: create/delete/open
├── compiler/clang.ts       toolchain status + compile pipeline
├── runner/WorkerHost.ts    worker lifecycle
├── runner/program.worker.ts  WASI preview1 shim + instantiation
├── terminal/Terminal.tsx   xterm.js console
└── gui/CanvasWindow.tsx    draggable canvas for GUI output
```

## Notes & limits

- Single-threaded WASM by default; `std::thread` needs cross-origin isolation
  (COOP/COEP headers are already set in `vite.config.ts`).
- The sandbox exposes no filesystem to programs (`path_open` → ENOSYS);
  extend `program.worker.ts` if you want file I/O against the VFS.
- Large toolchains should be lazy-loaded and cached (Cache API / IndexedDB).
