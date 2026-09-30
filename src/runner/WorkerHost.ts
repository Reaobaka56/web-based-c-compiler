import type { GuiMessage } from '../gui/CanvasWindow'
import type { CompileResult } from '../compiler/clang'

export interface HostCallbacks {
  onStdout?: (data: string) => void
  onGui?: (message: GuiMessage) => void
  onExit?: (code: number) => void
}

export class WorkerHost {
  private active = false
  private stdout?: (data: string) => void
  private gui?: (message: GuiMessage) => void
  private exit?: (code: number) => void

  run(program: CompileResult, callbacks: HostCallbacks = {}) {
    this.active = true
    this.stdout = callbacks.onStdout
    this.gui = callbacks.onGui
    this.exit = callbacks.onExit

    const nl = (text: string) => (text.endsWith('\n') ? text : text + '\n')
    if (program.compilerOutput) this.stdout?.(nl(program.compilerOutput))
    if (program.compilerError) this.stdout?.('\x1b[31m' + nl(program.compilerError) + '\x1b[0m')
    if (program.output) this.stdout?.(nl(program.output))
    if (program.programError) this.stdout?.('\x1b[33m' + nl(program.programError) + '\x1b[0m')

    this.active = false
    this.exit?.(program.status)
  }

  sendStdin(data: string) {
    if (!this.active) return

    if (data === '\r' || data === '\n') {
      this.stdout?.('\n')
      return
    }

    this.stdout?.(data)
  }

  kill() {
    this.active = false
    this.stdout?.('\x1b[31m── killed ──\x1b[0m\n')
  }
}
