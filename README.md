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

For low-cost Render free tiers, the backend can be deployed as multiple instances (`api-1`, `api-2`, `api-3`) behind a single frontend. The frontend tries each backend in order and checks `/health` before connecting to `/ws/run`. This keeps traffic on the first available instance and only moves to the next one when the current one is full, down, or still waking up.

Set the frontend environment variable `VITE_BACKENDS` to a comma-separated list in priority order, such as:

```bash
VITE_BACKENDS=https://api-1.onrender.com,https://api-2.onrender.com,https://api-3.onrender.com
```

For each backend service, configure:

```bash
PORT=3001
MAX_CONCURRENT_RUNS=3
ALLOWED_ORIGINS=https://your-frontend.example.com
```

`/health` returns a lightweight JSON object with active run count, queue length, configured max, and status. It is intentionally cheap and does not compile or access disk.

## Limits

- The default low-resource safety settings are `MAX_CONCURRENT_RUNS=3`, `MAX_CONCURRENT_COMPILES=1`, `MAX_RUNS_PER_IP=3`, and `RUN_MEMORY_MB=32` when not overridden.
- Source and input are limited to 64 KB, output to 1 MB, and execution to 120 seconds.
- Programs have no host filesystem or network access. C++ exceptions are disabled in the WASI build.
- Render's free instance may be slow to wake and compile larger programs; the health check is designed to wait up to 60 seconds before trying the next backend.
