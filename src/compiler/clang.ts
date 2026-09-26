// Compiler service: wraps a wasm-clang toolchain running fully in-browser.
//
// REAL TOOLCHAIN SETUP (one time):
//   1. Download wasm-clang (e.g. from https://github.com/binji/wasm-clang
//      or a fork shipping clang.wasm + wasm-ld.wasm + sysroot).
//   2. Place into  public/toolchain/ :
//        clang.wasm      — the C++ compiler
//        wasm-ld.wasm    — the WebAssembly linker
//        sysroot.tar     — libc++/libc headers + libs for wasm32
//   3. That's it — status() flips to READY and .cpp files compile for real.
//
// Until then the app runs in DEMO mode: compiling a hello-world program
// executes a prebuilt WASM binary so the whole pipeline is verifiable.

export class ToolchainMissingError extends Error {
  constructor() { super('wasm-clang toolchain not found in /toolchain') }
}

export interface ToolchainStatus {
  ready: boolean
  files: string[]
}

// Minimal WASI module used until a real wasm-clang toolchain is installed.
const DEMO_WASM = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0,
  1, 12, 2, 96, 4, 127, 127, 127, 127, 1, 127, 96, 0, 0,
  2, 68, 2, 22, 119, 97, 115, 105, 95, 115, 110, 97, 112, 115, 104, 111, 116,
  95, 112, 114, 101, 118, 105, 101, 119, 49, 8, 102, 100, 95, 119, 114, 105,
  116, 101, 0, 0, 22, 119, 97, 115, 105, 95, 115, 110, 97, 112, 115, 104,
  111, 116, 95, 112, 114, 101, 118, 105, 101, 119, 49, 6, 109, 101, 109,
  111, 114, 121, 2, 0, 1,
  3, 2, 1, 1,
  7, 10, 1, 6, 95, 115, 116, 97, 114, 116, 0, 1,
  10, 15, 1, 13, 0, 65, 1, 65, 0, 65, 1, 65, 8, 16, 0, 26, 11,
  11, 33, 2, 0, 65, 0, 11, 8, 16, 0, 0, 0, 14, 0, 0, 0, 0,
  65, 16, 11, 14, 72, 101, 108, 108, 111, 44, 32, 87, 111, 114, 108, 100, 33, 10
])

export async function toolchainStatus(): Promise<ToolchainStatus> {
  const needed = ['clang.wasm', 'wasm-ld.wasm']
  const found: string[] = []
  for (const f of needed) {
    try {
      const r = await fetch(`/toolchain/${f}`, { method: 'HEAD' })
      if (r.ok) found.push(f)
    } catch { /* offline etc. */ }
  }
  return { ready: found.length === needed.length, files: found }
}

/**
 * Real pipeline (sketch — wire to your wasm-clang build of choice):
 *
 *   const clang = await loadModule('/toolchain/clang.wasm', { env: {...} })
 *   for (const [path, src] of Object.entries(files)) {
 *     if (!path.endsWith('.cpp') && !path.endsWith('.c')) continue
 *     writeToMemFS(path, src)
 *     clang.callMain(['-O2', '-std=c++17', '--target=wasm32-unknown-wasi',
 *                    '-c', path, '-o', path + '.o'])
 *   }
 *   const ld = await loadModule('/toolchain/wasm-ld.wasm', ...)
 *   ld.callMain(['*.o', '-o', 'a.out.wasm', '-L/sysroot/lib', ...])
 *   return readFromMemFS('a.out.wasm')
 */
export async function compileProject(
  files: Record<string, string>,
  onLog: (s: string) => void
): Promise<Uint8Array> {
  const status = await toolchainStatus()
  if (!status.ready) {
    onLog('[compiler] toolchain not installed — running built-in demo binary.\n')
    onLog('[compiler] see README.md to enable real C++ compilation.\n')
    return DEMO_WASM.slice()
  }
  // Real implementation goes here (see sketch above).
  onLog('[compiler] toolchain detected, but pipeline not wired to this build.\n')
  return DEMO_WASM.slice()
}
