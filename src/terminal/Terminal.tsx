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

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function currentTheme() {
  return {
    background: cssVar('--editor-bg'),
    foreground: cssVar('--fg'),
    cursor: cssVar('--fg'),
    selectionBackground: cssVar('--selection')
  }
}

const Terminal = forwardRef<TerminalHandle>(function Terminal(_, ref) {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const inputCb = useRef<((data: string) => void) | null>(null)

  const focusTerminal = () => termRef.current?.focus()

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const term = new XTerm({
      cursorBlink: true,
      convertEol: true,
      fontFamily: cssVar('--font-mono'),
      fontSize: 13,
      theme: currentTheme()
    })
    const fit = new FitAddon()

    term.loadAddon(fit)
    term.open(host)
    fit.fit()
    term.writeln('\x1b[36mCppPad terminal\x1b[0m — output appears here. Input is sent as stdin on the next Run.')
    term.onData((d) => inputCb.current?.(d))

    const resizeObserver = new ResizeObserver(() => fit.fit())
    resizeObserver.observe(host)

    const themeObserver = new MutationObserver(() => {
      term.options.theme = currentTheme()
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    termRef.current = term

    return () => {
      resizeObserver.disconnect()
      themeObserver.disconnect()
      term.dispose()
      termRef.current = null
    }
  }, [])

  useImperativeHandle(ref, () => ({
    write: (d) => termRef.current?.write(d),
    clear: () => termRef.current?.clear(),
    onInput: (cb) => { inputCb.current = cb },
    focus: focusTerminal
  }))

  return <div ref={hostRef} onClick={focusTerminal} style={{ height: '100%', width: '100%', cursor: 'text' }} />
})

export default Terminal
