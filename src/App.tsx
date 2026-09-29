import { useCallback, useEffect, useRef, useState } from 'react'
import FileManager from './fs/FileManager'
import Editor from './editor/Editor'
import Terminal, { TerminalHandle } from './terminal/Terminal'
import { ensureDefaultProject, readAll, writeFile } from './fs/vfs'
import { compileProject } from './compiler/clang'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const RUN_HINT = isMac ? '⌘↵' : 'Ctrl+Enter'
const STATUS_BAR_HEIGHT = 24
const MIN_PANEL = 80

type Theme = 'dark' | 'light'

export default function App() {
  const [files, setFiles] = useState<Record<string, string>>({})
  const [openTabs, setOpenTabs] = useState<string[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [showHome, setShowHome] = useState(true)
  const [projectLoaded, setProjectLoaded] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [panelHeight, setPanelHeight] = useState(220)
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = document.documentElement.getAttribute('data-theme') as Theme | null
    return saved === 'light' || saved === 'dark' ? saved : 'dark'
  })
  const termRef = useRef<TerminalHandle>(null)
  const abortRef = useRef<AbortController | null>(null)
  const filesRef = useRef(files)
  filesRef.current = files

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('theme', theme) } catch { /* storage blocked */ }
  }, [theme])

  useEffect(() => {
    ;(async () => {
      await ensureDefaultProject()
      const all = await readAll()
      setFiles(all)
      setProjectLoaded(true)
    })()
    return () => abortRef.current?.abort()
  }, [])

  const log = useCallback((s: string) => termRef.current?.write(s), [])

  const openFile = useCallback(async (path: string) => {
    setFiles((f) => ({ ...f, [path]: f[path] ?? '' }))
    setOpenTabs((t) => (t.includes(path) ? t : [...t, path]))
    setActive(path)
    setShowHome(false)
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

  const run = useCallback(async () => {
    if (!active || busy) return
    setBusy(true)
    termRef.current?.clear()
    const controller = new AbortController()
    abortRef.current = controller
    try {
      log('\x1b[2mCompiling and running with Wandbox (GCC)...\x1b[0m\r\n')
      const result = await compileProject(filesRef.current[active] ?? '', controller.signal)
      if (result.compilerOutput) log(result.compilerOutput.replace(/\n/g, '\r\n'))
      if (result.compilerError) log(`\x1b[31m${result.compilerError.replace(/\n/g, '\r\n')}\x1b[0m`)
      if (result.output) log(result.output.replace(/\n/g, '\r\n'))
      if (result.programError) log(`\x1b[31m${result.programError.replace(/\n/g, '\r\n')}\x1b[0m`)
      log(`\x1b[2mProcess exited with code ${result.status}\x1b[0m\r\n`)
    } catch (e: any) {
      if (!controller.signal.aborted) log(`\x1b[31mCompile error: ${e?.message ?? e}\x1b[0m\r\n`)
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setBusy(false)
      }
    }
  }, [active, busy, log])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setBusy(false)
    log('\x1b[2mStopped\x1b[0m\r\n')
  }, [log])

  const toggleTheme = () => setTheme((theme) => (theme === 'dark' ? 'light' : 'dark'))

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

  const startPath = files['/main.cpp'] !== undefined ? '/main.cpp' : Object.keys(files).sort()[0]
  const previewLines = (files['/main.cpp'] ?? '').split('\n').slice(0, 8)

  return (
    <div className="app">
      {showHome ? (
        <>
          <header className="topbar welcome-topbar">
            <span className="app-name">CppPad</span>
            <span className="welcome-topbar-label">BROWSER C++ WORKSPACE</span>
            <span className="welcome-topbar-spacer" />
            <span className="welcome-topbar-status"><span className="compiler-dot" /> GCC COMPILER</span>
          </header>

          <main className="welcome-screen">
            <div className="welcome-inner">
              <section className="welcome-intro">
                <p className="welcome-kicker"><span className="compiler-dot" /> YOUR WORKSPACE</p>
                <h1>CppPad</h1>
                <p className="welcome-lede">Write, compile, and run C++.</p>
                <p className="welcome-description">Your project is saved in this browser and ready to open.</p>
                <div className="welcome-actions">
                  <button className="btn primary" onClick={() => startPath && void openFile(startPath)} disabled={!projectLoaded || !startPath}>
                    Open {startPath?.replace(/^\//, '') ?? 'project'}
                    <span aria-hidden="true">-&gt;</span>
                  </button>
                  <span className="welcome-language">C++ / GCC</span>
                </div>
              </section>

              <section className="welcome-preview" aria-label="main.cpp preview">
                <div className="welcome-preview-head">
                  <span className="compiler-dot" />
                  <span>main.cpp</span>
                  <span className="welcome-preview-mode">C++</span>
                </div>
                <pre>{projectLoaded ? previewLines.map((line, index) => (
                  <span className="welcome-code-line" key={index}>
                    <span className="welcome-line-number">{String(index + 1).padStart(2, '0')}</span>{line || ' '}
                  </span>
                )) : <span className="welcome-loading">Loading project...</span>}</pre>
              </section>

              <section className="welcome-files" aria-labelledby="welcome-files-title">
                <div className="welcome-files-heading">
                  <h2 id="welcome-files-title">Project files</h2>
                  <span>{projectLoaded ? `${Object.keys(files).length} files` : 'Loading'}</span>
                </div>
                <ul className="welcome-file-list">
                  {Object.keys(files).sort().map((path) => (
                    <li key={path}>
                      <button className="welcome-file" onClick={() => void openFile(path)}>
                        <span className="welcome-file-type">C++</span>
                        <span className="welcome-file-name">{path.replace(/^\//, '')}</span>
                        <span className="welcome-file-open">Open</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </main>

          <footer className="statusbar">
            <div className="status-group">
              <span className="status-item compiler online">Wandbox GCC</span>
              <span className="status-item welcome-privacy">Active source is sent to Wandbox on Run</span>
            </div>
            <div className="status-group">
              <span className="status-item copyright">© 2026 NullEntity · CMPG 172 Project</span>
              <button className="status-item status-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
                {theme === 'dark' ? 'Dark' : 'Light'}
              </button>
            </div>
          </footer>
        </>
      ) : (
        <>
      <header className="topbar">
        <button className="app-name" onClick={() => setShowHome(true)} title="Back to home">CppPad</button>
        <div className="run-controls">
          <button className="btn primary" onClick={run} disabled={busy || !active} title={`Run (${RUN_HINT})`}>
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1l7 4-7 4z" fill="currentColor" /></svg>
            Run
          </button>
          <button className="btn" onClick={stop} disabled={!busy} title="Stop">
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="2" y="2" width="6" height="6" fill="currentColor" /></svg>
            Stop
          </button>
        </div>
      </header>

      <div className="body">
        <aside className="sidebar">
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
            {active ? <Editor key={active} value={files[active] ?? ''} onChange={onEdit} onRun={run} onCursor={(line, col) => setCursor({ line, col })} />
              : <div className="empty-editor">No file open. Create one with + in the Files list.</div>}
          </div>

          <div className="splitter" role="separator" aria-orientation="horizontal" aria-label="Resize terminal" onPointerDown={startResize} />

          <section className="panel" style={{ height: panelHeight }}>
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
          <span className="status-item compiler online" title="Your active source file is sent to Wandbox for compilation and execution.">C++ compiler: Wandbox GCC</span>
          {busy && <span className="status-item">Running</span>}
        </div>
        <div className="status-group">
          <span className="status-item copyright">© 2026 NullEntity · CMPG 172 Project</span>
          <span className="status-item">Ln {cursor.line}, Col {cursor.col}</span>
          <span className="status-item">C++</span>
          <button className="status-item status-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            {theme === 'dark' ? 'Dark' : 'Light'}
          </button>
        </div>
      </footer>
        </>
      )}
    </div>
  )
}
