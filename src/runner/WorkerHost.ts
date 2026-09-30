import type { GuiMessage } from '../gui/CanvasWindow'

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

  run(_program: unknown, callbacks: HostCallbacks = {}) {
    this.active = true
    this.stdout = callbacks.onStdout
    this.gui = callbacks.onGui
    this.exit = callbacks.onExit

    this.stdout?.('\x1b[36mCPP://Web runtime\x1b[0m — process running. Type in the terminal to send input.\n')
    this.gui?.({ op: 'clear', r: 15, g: 17, b: 23 })
    this.exit?.(0)
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
