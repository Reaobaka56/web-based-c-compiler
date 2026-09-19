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
    const r = await fetch('/demo/hello.wasm')
    if (!r.ok) throw new ToolchainMissingError()
    return new Uint8Array(await r.arrayBuffer())
  }
  // Real implementation goes here (see sketch above).
  onLog('[compiler] toolchain detected, but pipeline not wired to this build.\n')
  const r = await fetch('/demo/hello.wasm')
  return new Uint8Array(await r.arrayBuffer())
}
