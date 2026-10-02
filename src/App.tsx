import { useCallback, useEffect, useRef, useState } from 'react'
import Landing from './Landing'
import FileManager from './fs/FileManager'
import Editor from './editor/Editor'
import Terminal, { TerminalHandle } from './terminal/Terminal'
import RunResultPopup, { type RunResult } from './ui/RunResultPopup'
import { ensureDefaultProject, readAll, writeFile } from './fs/vfs'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const RUN_HINT = isMac ? '⌘↵' : 'Ctrl+Enter'
const STATUS_BAR_HEIGHT = 24
const MIN_PANEL = 80
const BACKENDS = (import.meta.env.VITE_BACKENDS || window.location.origin)
  .split(',')
  .map((value: string) => value.trim().replace(/\/+$/, ''))
  .filter(Boolean)

type Theme = 'dark' | 'light'

export default function App() {
  const [files, setFiles] = useState<Record<string, string>>({})
  const [openTabs, setOpenTabs] = useState<string[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [showLanding, setShowLanding] = useState(true)
  const [showWelcome, setShowWelcome] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [panelHeight, setPanelHeight] = useState(220)
  const [showFiles, setShowFiles] = useState(true)
  const [showTerminal, setShowTerminal] = useState(true)
  const [popup, setPopup] = useState<{ fileName: string; result: RunResult | null } | null>(null)
  const [backendStatus, setBackendStatus] = useState('')
  const [showPopup, setShowPopup] = useState(() => {
    try { return localStorage.getItem('showRunPopup') !== 'false' } catch { return true }
  })
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = document.documentElement.getAttribute('data-theme') as Theme | null
    return saved === 'light' || saved === 'dark' ? saved : 'dark'
  })
  const termRef = useRef<TerminalHandle>(null)
  const sessionRef = useRef<WebSocket | null>(null)
  const inputLineRef = useRef('')
  const filesRef = useRef(files)
  filesRef.current = files

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('theme', theme) } catch { /* storage blocked */ }
  }, [theme])

  useEffect(() => {
    if (!showWelcome) return
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowWelcome(false)
    }
    window.addEventListener('keydown', dismissOnEscape)
    return () => window.removeEventListener('keydown', dismissOnEscape)
  }, [showWelcome])

  useEffect(() => {
    ;(async () => {
      await ensureDefaultProject()
      const all = await readAll()
      setFiles(all)
      setRefreshKey((k) => k + 1)
      const first = all['/main.cpp'] !== undefined ? '/main.cpp' : Object.keys(all).sort()[0]
      if (first) { setOpenTabs([first]); setActive(first) }
    })()
    return () => sessionRef.current?.close()
  }, [])

  const log = useCallback((s: string) => termRef.current?.write(s), [])

  useEffect(() => {
    try { localStorage.setItem('showRunPopup', String(showPopup)) } catch { /* storage blocked */ }
  }, [showPopup])

  useEffect(() => {
    if (showLanding) return
    termRef.current?.onInput((data) => {
      const session = sessionRef.current
      if (session?.readyState !== WebSocket.OPEN) return

      if (data.startsWith('\x1b')) return
      for (const character of data) {
        if (character === '\r' || character === '\n') {
          termRef.current?.write('\r\n')
          session.send(JSON.stringify({ type: 'input', data: `${inputLineRef.current}\n` }))
          inputLineRef.current = ''
        } else if (character === '\x7f' || character === '\b') {
          const characters = Array.from(inputLineRef.current)
          if (characters.length > 0) {
            inputLineRef.current = characters.slice(0, -1).join('')
            termRef.current?.write('\b \b')
          }
        } else if (character >= ' ') {
          inputLineRef.current += character
          termRef.current?.write(character)
        }
      }
    })
  }, [showLanding])

  const openFile = useCallback(async (path: string) => {
    setFiles((f) => ({ ...f, [path]: f[path] ?? '' }))
    setOpenTabs((t) => (t.includes(path) ? t : [...t, path]))
    setActive(path)
  }, [])

  const closeTab = useCallback((path: string) => {
    const idx = openTabs.indexOf(path)
    const next = openTabs.filter((x) => x !== path)
    setOpenTabs(next)
    if (active === path) setActive(next[Math.min(idx, next.length - 1)] ?? null)
  }, [openTabs, active])

  const onFileDeleted = useCallback((path: string) => {
    closeTab(path)
    setFiles((f) => {
      const { [path]: _gone, ...rest } = f
      return rest
    })
  }, [closeTab])

  const onEdit = useCallback((v: string) => {
    if (!active) return
    setFiles((f) => ({ ...f, [active]: v }))
    writeFile(active, v)
  }, [active])

  const pickBackend = useCallback(async (): Promise<string | null> => {
    for (const backend of BACKENDS) {
      try {
        const controller = new AbortController()
        const timeout = window.setTimeout(() => controller.abort(), 60_000)
        const response = await fetch(`${backend}/health`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: { Accept: 'application/json' }
        })
        window.clearTimeout(timeout)

        if (!response.ok) continue
        const payload = await response.json() as { ok?: boolean; active?: number; max?: number }
        if (payload.ok && typeof payload.active === 'number' && typeof payload.max === 'number' && payload.active < payload.max) {
          return backend
        }
      } catch {
        // Move to the next backend if this one is down or just waking up.
      }
    }
    return null
  }, [])

  const run = useCallback(async () => {
    if (!active || busy) return
    setBusy(true)
    setShowTerminal(true)
    termRef.current?.clear()
    inputLineRef.current = ''
    setPopup(null)
    setBackendStatus('Connecting... (server may be waking up, up to 60s)')

    const fileName = active.replace(/^\//, '')
    const t0 = performance.now()
    let output = ''
    let compileFailed = false
    let exited = false

    const connectSession = async () => {
      const backend = await pickBackend()
      if (!backend) {
        setBusy(false)
        setBackendStatus('All servers busy, try again in a minute')
        return
      }

      const endpoint = new URL(`${backend}/ws/run`)
      endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:'
      endpoint.search = ''

      const session = new WebSocket(endpoint)
      sessionRef.current = session

      const finish = (exitCode: number) => {
        if (exited) return
        exited = true
        log(`\x1b[2mProcess exited with code ${exitCode}\x1b[0m\r\n`)
        if (sessionRef.current === session) sessionRef.current = null
        setBusy(false)
        setBackendStatus('')
        if (showPopup) {
          setPopup({
            fileName,
            result: { fileName, exitCode, ms: performance.now() - t0, compileFailed: compileFailed || exitCode !== 0, output }
          })
        }
      }

      session.onopen = () => {
        log('\x1b[2mConnecting to interactive C++ runner…\x1b[0m\r\n')
        session.send(JSON.stringify({ type: 'start', entry: active, files: filesRef.current }))
        termRef.current?.focus()
      }
      session.onmessage = (event) => {
        let message: { type?: string; message?: string; data?: string; code?: number }
        try {
          message = JSON.parse(String(event.data))
        } catch {
          return
        }
        if (message.type === 'status' && message.message) log(message.message)
        if (message.type === 'output' && message.data) {
          output += message.data
          log(message.data)
        }
        if (message.type === 'error' && message.message) {
          compileFailed = true
          output += `${message.message}\n`
          log(`\x1b[31m${message.message}\x1b[0m\r\n`)
        }
        if (message.type === 'exit') finish(Number(message.code ?? 1))
      }
      session.onerror = () => {
        if (exited) return
        setBackendStatus('Connecting... (server may be waking up, up to 60s)')
        if (sessionRef.current === session) {
          sessionRef.current = null
          void connectSession()
        }
      }
      session.onclose = () => {
        if (!exited && sessionRef.current === session) {
          setBackendStatus('Connecting... (server may be waking up, up to 60s)')
          sessionRef.current = null
          void connectSession()
        }
      }
    }

    await connectSession()
  }, [active, busy, log, pickBackend, showPopup])

  const stop = useCallback(() => {
    sessionRef.current?.close(1000, 'Stopped')
    sessionRef.current = null
    inputLineRef.current = ''
    setBusy(false)
    setPopup(null)
    log('\x1b[2mStopped\x1b[0m\r\n')
    requestAnimationFrame(() => termRef.current?.focus())
  }, [log])

  const toggleTheme = () => setTheme((theme) => (theme === 'dark' ? 'light' : 'dark'))

  const closePopup = useCallback(() => {
    setPopup(null)
    requestAnimationFrame(() => termRef.current?.focus())
  }, [])

  const openEditor = useCallback(() => {
    const target = files['/main.cpp'] !== undefined ? '/main.cpp' : Object.keys(files).sort()[0] ?? null
    if (!target) return
    setOpenTabs((tabs) => (tabs.includes(target) ? tabs : [target]))
    setActive(target)
    setShowLanding(false)
    setShowWelcome(true)
  }, [files])

  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      const h = window.innerHeight - STATUS_BAR_HEIGHT - ev.clientY
      setPanelHeight(Math.max(MIN_PANEL, Math.min(window.innerHeight - 200, h)))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  if (showLanding) {
    return <Landing onOpenEditor={openEditor} theme={theme} onToggleTheme={toggleTheme} />
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setShowLanding(true)} aria-label="CppPad home" title="Back to landing page">
          <svg className="brand-icon" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="6" fill="currentColor" />
            <text x="16" y="21" textAnchor="middle" fill="var(--on-accent)" fontFamily="monospace" fontSize="12" fontWeight="700">C++</text>
          </svg>
        </button>
        <nav className="workspace-nav" aria-label="Workspace panels">
          <button className={'nav-btn' + (showFiles ? ' selected' : '')} type="button" onClick={() => setShowFiles((shown) => !shown)} aria-expanded={showFiles}>
            Files
          </button>
          <button className={'nav-btn' + (showTerminal ? ' selected' : '')} type="button" onClick={() => setShowTerminal((shown) => !shown)} aria-expanded={showTerminal}>
            Terminal
          </button>
        </nav>
        <div className="run-controls">
          <button className="btn primary" onClick={run} disabled={busy || !active} title={`Run (${RUN_HINT})`}>
            {busy ? <span className="spinner small" aria-hidden="true" /> : <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1l7 4-7 4z" fill="currentColor" /></svg>}
            {busy ? 'Running…' : 'Run'}
          </button>
          <button className="btn" onClick={stop} disabled={!busy} title="Stop">
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="2" y="2" width="6" height="6" fill="currentColor" /></svg>
            Stop
          </button>
        </div>
        <label className="popup-toggle" title="Show a result popup after each run">
          <input type="checkbox" checked={showPopup} onChange={(event) => setShowPopup(event.target.checked)} />
          Result popup
        </label>
        <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
          {theme === 'dark'
            ? <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M8 1.5v1.4M8 13.1v1.4M1.5 8h1.4M13.1 8h1.4m-10.1-4.6 1 1m5.2 5.2 1 1m0-7.3-1 1m-5.2 5.2-1 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
            : <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.4 10.2A5.9 5.9 0 0 1 5.8 2.6 5.9 5.9 0 1 0 13.4 10.2Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>}
        </button>
      </header>

      <div className="body">
        <aside className={'sidebar' + (showFiles ? '' : ' collapsed')}>
          <FileManager active={active} refreshKey={refreshKey}
            onOpen={openFile} onChanged={() => setRefreshKey((k) => k + 1)} onDeleted={onFileDeleted} />
        </aside>

        <div className="center">
          <div className="tabs" role="tablist">
            {openTabs.map((t) => (
              <div key={t} className={'tab' + (t === active ? ' active' : '')}>
                <button className="tab-label" role="tab" aria-selected={t === active} onClick={() => setActive(t)}>
                  {t.replace(/^\//, '')}
                </button>
                <button className="tab-close" onClick={() => closeTab(t)} aria-label={`Close ${t}`} title="Close">
                  <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden="true">
                    <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div className="editor-host">
            {active
              ? <Editor key={active} value={files[active] ?? ''} onChange={onEdit} onRun={run} onCursor={(line, col) => setCursor({ line, col })} />
              : <div className="empty-editor">No file open. Create one with + in the Files list.</div>}
          </div>

          <div className={'splitter' + (showTerminal ? '' : ' collapsed')} role="separator" aria-orientation="horizontal" aria-label="Resize terminal" onPointerDown={startResize} />

          <section className={'panel' + (showTerminal ? '' : ' collapsed')} style={showTerminal ? { height: panelHeight } : undefined}>
            <div className="pane-head">
              <span>Terminal</span>
              <button className="text-btn" onClick={() => termRef.current?.clear()}>Clear</button>
            </div>
            <div className="term-host"><Terminal ref={termRef} /></div>
          </section>
        </div>
      </div>

      <footer className="statusbar">
        <div className="status-group">
          <span className="status-item" title="Your active file is compiled to WebAssembly and run in Wasmtime on the server.">
            clang++ · WASI sandbox
          </span>
          {backendStatus && <span className="status-item">{backendStatus}</span>}
          {busy && <span className="status-item">Running</span>}
        </div>
        <div className="status-group">
          <span className="status-item">Ln {cursor.line}, Col {cursor.col}</span>
          <span className="status-item">C++</span>
          <span className="status-item copyright">© 2026 NullEntity · CMPG 172 Project</span>
        </div>
      </footer>

      {popup && (
        <RunResultPopup
          fileName={popup.fileName}
          result={popup.result}
          onClose={closePopup}
          onCancel={stop}
        />
      )}

      {showWelcome && (
        <div className="welcome-backdrop" onClick={() => setShowWelcome(false)}>
          <section
            className="welcome-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h1 id="welcome-title">Welcome to cppPad</h1>
            <p className="welcome-intro">A code editor made by NullEntity for CMPG172.</p>
            <p className="welcome-description">
              This editor was built using TypeScript. It's a browser-based C++ editor with an IndexedDB-backed workspace and online compilation through Wandbox.
            </p>
            <p className="welcome-description">
              The purpose of this compiler is to demonstrate linked-list insertion and deletion.
            </p>
            <div className="welcome-actions">
              <a
                className="btn welcome-source"
                href="https://github.com/Reaobaka56/web-based-c-compiler"
                target="_blank"
                rel="noopener noreferrer"
              >
                View Compiler Source Code
              </a>
              <button className="btn primary" type="button" autoFocus onClick={() => setShowWelcome(false)}>
                Get Started
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
