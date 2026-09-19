/// <reference lib="webworker" />
// Sandboxed execution host: instantiates the compiled program.wasm with a
// WASI preview1 shim. stdout -> terminal, stdin <- terminal, proc_exit ends run.

interface RunMsg { type: 'run'; wasm: Uint8Array; args?: string[] }
interface StdinMsg { type: 'stdin'; data: string }
type InMsg = RunMsg | StdinMsg

let stdinBuf = ''
let running = false

function post(msg: unknown) { ;(self as unknown as Worker).postMessage(msg) }

function makeWasi(memoryRef: { mem: WebAssembly.Memory }) {
  const enc = new TextEncoder()
  const dec = new TextDecoder()

  const str = (ptr: number, len: number) =>
    dec.decode(new Uint8Array(memoryRef.mem.buffer, ptr, len))

  return {
    wasi_snapshot_preview1: {
      fd_write(fd: number, iovs: number, iovsLen: number, nwritten: number): number {
        if (fd !== 1 && fd !== 2) return 8 // EBADF
        const view = new DataView(memoryRef.mem.buffer)
        let total = 0
        let out = ''
        for (let i = 0; i < iovsLen; i++) {
          const p = view.getUint32(iovs + i * 8, true)
          const l = view.getUint32(iovs + i * 8 + 4, true)
          out += str(p, l)
          total += l
        }
        view.setUint32(nwritten, total, true)
        post({ type: 'stdout', data: out })
        return 0
      },
      fd_read(fd: number, iovs: number, iovsLen: number, nread: number): number {
        if (fd !== 0) return 8
        const view = new DataView(memoryRef.mem.buffer)
        if (stdinBuf.length === 0) { view.setUint32(nread, 0, true); return 0 }
        let total = 0
        for (let i = 0; i < iovsLen && stdinBuf.length; i++) {
          const p = view.getUint32(iovs + i * 8, true)
          const l = view.getUint32(iovs + i * 8 + 4, true)
          const chunk = stdinBuf.slice(0, l)
          new Uint8Array(memoryRef.mem.buffer, p, chunk.length).set(enc.encode(chunk))
          stdinBuf = stdinBuf.slice(chunk.length)
          total += chunk.length
        }
        view.setUint32(nread, total, true)
        return 0
      },
      fd_close(): number { return 0 },
      fd_seek(): number { return 70 }, // ESPIPE
      fd_fdstat_get(): number { return 0 },
      fd_fdstat_set_flags(): number { return 0 },
      fd_prestat_get(): number { return 8 },
      fd_prestat_dir_name(): number { return 8 },
      path_open(): number { return 63 }, // ENOSYS — no FS access from sandbox
      args_sizes_get(argcPtr: number, bufLenPtr: number): number {
        const v = new DataView(memoryRef.mem.buffer)
        v.setUint32(argcPtr, 1, true)
        v.setUint32(bufLenPtr, 5, true) // "a.out"
        return 0
      },
      args_get(argvPtr: number, argvBuf: number): number {
        const v = new DataView(memoryRef.mem.buffer)
        v.setUint32(argvPtr, argvBuf, true)
        new Uint8Array(memoryRef.mem.buffer, argvBuf, 5).set(enc.encode('a.out\0'))
        return 0
      },
      environ_sizes_get(a: number, b: number): number {
        const v = new DataView(memoryRef.mem.buffer)
        v.setUint32(a, 0, true); v.setUint32(b, 0, true)
        return 0
      },
      environ_get(): number { return 0 },
      clock_time_get(_id: number, _prec: number, out: number): number {
        const v = new DataView(memoryRef.mem.buffer)
        v.setBigUint64(out, BigInt(Date.now()) * 1_000_000n, true)
        return 0
      },
      random_get(ptr: number, len: number): number {
        const bytes = new Uint8Array(memoryRef.mem.buffer, ptr, len)
        crypto.getRandomValues(bytes)
        return 0
      },
      poll_oneoff(): number { return 0 },
      sched_yield(): number { return 0 },
      proc_exit(code: number): never {
        running = false
        post({ type: 'exit', code })
        throw new Error('__proc_exit') // unwind wasm stack
      }
    },
    env: {
      // Emscripten-style GUI hooks: a program compiled with the SDL2/raylib
      // port can draw to the IDE canvas through these imports.
      gui_clear(r: number, g: number, b: number) {
        post({ type: 'gui', op: 'clear', r, g, b })
      },
      gui_rect(x: number, y: number, w: number, h: number, r: number, g: number, b: number) {
        post({ type: 'gui', op: 'rect', x, y, w, h, r, g, b })
      },
      gui_circle(x: number, y: number, rad: number, r: number, g: number, b: number) {
        post({ type: 'gui', op: 'circle', x, y, rad, r, g, b })
      }
    }
  }
}

async function run(wasmBytes: Uint8Array) {
  running = true
  stdinBuf = ''
  post({ type: 'stdout', data: '\x1b[32m── program start ──\x1b[0m\n' })
  try {
    const ref = { mem: new WebAssembly.Memory({ initial: 64 }) }
    const imports = makeWasi(ref)
    // Instantiate with a pre-linked memory so the shim works even if the
    // module doesn't import one; also allow the module to bring its own.
    const { instance } = await WebAssembly.instantiate(wasmBytes, {
      ...imports,
      wasi_unstable: imports.wasi_snapshot_preview1
    })
    const exp = instance.exports as any
    if (exp.memory) ref.mem = exp.memory
    if (typeof exp._start === 'function') exp._start()
    else if (typeof exp.main === 'function') {
      const code = exp.main()
      if (running) { running = false; post({ type: 'exit', code }) }
    }
  } catch (e: any) {
    if (e?.message !== '__proc_exit') {
      running = false
      post({ type: 'stdout', data: `\x1b[31mruntime error: ${e?.message ?? e}\x1b[0m\n` })
      post({ type: 'exit', code: 1 })
    }
  }
}

self.onmessage = (e: MessageEvent<InMsg>) => {
  const m = e.data
  if (m.type === 'stdin') stdinBuf += m.data
  else if (m.type === 'run') run(m.wasm)
}
