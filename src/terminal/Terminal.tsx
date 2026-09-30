import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export interface TerminalHandle {
  write: (data: string) => void
  clear: () => void
  onInput: (cb: (data: string) => void) => void
  focus: () => void
}

const Terminal = forwardRef<TerminalHandle>(function Terminal(_, ref) {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const inputCb = useRef<((d: string) => void) | null>(null)

  const focusTerminal = () => {
    const terminal = termRef.current
    if (!terminal) return
    terminal.focus()
    if (hostRef.current) hostRef.current.focus()
  }

  useEffect(() => {
    const term = new XTerm({
      cursorBlink: true,
      convertEol: true,
      fontFamily: 'SFMono-Regular, Cascadia Code, Menlo, monospace',
      fontSize: 13,
      theme: {
        background: '#111722',
        foreground: '#d8e1f0',
        cursor: '#81a9ff',
        selectionBackground: '#7597d844'
      }
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(hostRef.current!)
    fit.fit()
    term.writeln('\x1b[36mCPP://Web terminal\x1b[0m — output appears here. Input is forwarded to the running program.')
    term.onData((d) => inputCb.current?.(d))
    term.focus()

    const onResize = () => fit.fit()
    window.addEventListener('resize', onResize)
    termRef.current = term
    fitRef.current = fit
    return () => { window.removeEventListener('resize', onResize); term.dispose() }
  }, [])

  useImperativeHandle(ref, () => ({
    write: (d) => termRef.current?.write(d),
    clear: () => termRef.current?.clear(),
    onInput: (cb) => { inputCb.current = cb },
    focus: focusTerminal
  }))

  return (
    <div
      ref={hostRef}
      tabIndex={0}
      onClick={focusTerminal}
      onFocus={focusTerminal}
      style={{ height: '100%', width: '100%', cursor: 'text' }}
    />
  )
})

export default Terminal
