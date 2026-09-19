// Thin wrapper around the program Web Worker.
import ProgramWorker from './program.worker?worker'

export interface RunCallbacks {
  onStdout: (data: string) => void
  onGui: (msg: any) => void
  onExit: (code: number) => void
}

export class WorkerHost {
  private worker: Worker | null = null
  private cbs: RunCallbacks | null = null

  get isRunning() { return this.worker !== null }

  run(wasm: Uint8Array, cbs: RunCallbacks) {
    this.kill()
    this.cbs = cbs
    this.worker = new ProgramWorker()
    this.worker.onmessage = (e) => {
      const m = e.data
      if (m.type === 'stdout') this.cbs?.onStdout(m.data)
      else if (m.type === 'gui') this.cbs?.onGui(m)
      else if (m.type === 'exit') { this.cbs?.onExit(m.code); this.dispose() }
    }
    this.worker.postMessage({ type: 'run', wasm }, [wasm.buffer])
  }

  sendStdin(data: string) { this.worker?.postMessage({ type: 'stdin', data }) }

  kill() {
    this.worker?.terminate()
    this.dispose()
  }

  private dispose() { this.worker = null }
}
