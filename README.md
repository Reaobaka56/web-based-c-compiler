# CppPad: C++ in the browser

A browser-based C++ editor with an IndexedDB-backed workspace and interactive C++ execution in a WASI sandbox.

## Quick start

```bash
npm install
npm run dev
```

Press Run to compile the active file to WebAssembly. The terminal accepts input while the program is running.

Programs execute in Wasmtime with no host filesystem access. This service is for learning and should not be used for confidential code.

## Architecture

```
server/
└── index.js              HTTP API and interactive WebSocket sessions

src/
├── App.tsx               layout, tabs, run orchestration
├── editor/Editor.tsx     CodeMirror 6 (C++ syntax, light/dark)
├── fs/vfs.ts             IndexedDB-backed virtual file system
├── fs/FileManager.tsx    file list: create / open / delete
└── terminal/Terminal.tsx xterm.js output panel
```

## Deployment

The Render Blueprint in `render.yaml` builds `Dockerfile` and deploys the interactive compiler as a separate Docker service named `cpppad-live` in Oregon. Render cannot convert the existing Node service to Docker, so create this service from the Blueprint and keep the old service until the new one is verified. The image includes wasi-sdk for compilation and Wasmtime for sandboxed execution. WebSockets carry terminal input and output between the Vercel frontend and the running process.

Set `VITE_API_URL` in the Vercel project's environment variables to the new Render service's base URL, then redeploy Vercel. The browser connects to `/ws/run` on the Render service.

## Limits

- One active run at a time; source and input are limited to 64 KB, output to 1 MB, and execution to 120 seconds.
- Programs have no host filesystem or network access. C++ exceptions are disabled in the WASI build.
- Render's free instance may be slow to wake and compile larger programs.
