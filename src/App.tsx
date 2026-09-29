import { useCallback, useEffect, useRef, useState } from 'react'
import FileManager from './fs/FileManager'
import Editor from './editor/Editor'
import Terminal, { TerminalHandle } from './terminal/Terminal'
import CanvasWindow, { GuiMessage } from './gui/CanvasWindow'
import { ensureDefaultProject, readFile, writeFile, readAll } from './fs/vfs'
import { compileProject, toolchainStatus } from './compiler/clang'
import { WorkerHost } from './runner/WorkerHost'

export default function App() {
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [files, setFiles] = useState<Record<string, string>>({})
  const [openTabs, setOpenTabs] = useState<string[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [tcStatus, setTcStatus] = useState<'checking' | 'demo' | 'ready'>('checking')
  const [busy, setBusy] = useState(false)
  const [guiOpen, setGuiOpen] = useState(false)
  const [guiOp, setGuiOp] = useState<GuiMessage | null>(null)
  const termRef = useRef<TerminalHandle>(null)
  const hostRef = useRef<WorkerHost | null>(null)
  const filesRef = useRef(files)
  filesRef.current = files

  useEffect(() => {
    ;(async () => {
      await ensureDefaultProject()
      const all = await readAll()
      setFiles(all)
      const first = Object.keys(all).sort()[0]
      if (first) { setOpenTabs([first]); setActive(first) }
      const st = await toolchainStatus()
      setTcStatus(st.ready ? 'ready' : 'demo')
    })()
    return () => hostRef.current?.kill()
  }, [])

  const log = useCallback((s: string) => termRef.current?.write(s), [])

  const openFile = useCallback(async (path: string) => {
    setFiles((f) => ({ ...f, [path]: f[path] ?? '' }))
    setOpenTabs((t) => (t.includes(path) ? t : [...t, path]))
    setActive(path)
  }, [])

  const closeTab = useCallback((path: string) => {
    setOpenTabs((t) => {
      const next = t.filter((x) => x !== path)
      if (active === path) setActive(next[next.length - 1] ?? null)
      return next
    })
  }, [active])

  const onEdit = useCallback((v: string) => {
    if (!active) return
    setFiles((f) => ({ ...f, [active]: v }))
    writeFile(active, v) // persist to IndexedDB (debounce in production)
  }, [active])

  const run = useCallback(async () => {
    if (!active) return
    setBusy(true)
    termRef.current?.clear()
    try {
      await writeFile(active, filesRef.current[active] ?? '')
      const wasm = await compileProject(filesRef.current, log)
      hostRef.current ??= new WorkerHost()
      setGuiOpen(true)
      hostRef.current.run(wasm, {
        onStdout: (d) => termRef.current?.write(d),
        onGui: (m) => setGuiOp(m as GuiMessage),
        onExit: (code) => {
          log(`\x1b[32m── program exited (code ${code}) ──\x1b[0m\n`)
          setBusy(false)
        }
      })
    } catch (e: any) {
      log(`\x1b[31mcompile error: ${e?.message ?? e}\x1b[0m\n`)
      setBusy(false)
    }
  }, [active, log])

  const stop = useCallback(() => { hostRef.current?.kill(); setBusy(false); log('\x1b[31m── killed ──\x1b[0m\n') }, [log])

  // Demo GUI program: bouncing ball, driven through the same message channel
  const guiDemo = useCallback(() => {
    setGuiOpen(true)
    let x = 50, y = 50, dx = 4, dy = 3
    const id = setInterval(() => {
      x += dx; y += dy
      if (x < 20 || x > 620) dx *= -1
      if (y < 20 || y > 460) dy *= -1
      setGuiOp({ op: 'clear', r: 15, g: 17, b: 23 })
      setGuiOp({ op: 'circle', x, y, rad: 20, r: 88, g: 166, b: 255 })
    }, 16)
    setTimeout(() => clearInterval(id), 30000)
  }, [])

  useEffect(() => {
    termRef.current?.onInput((d) => {
      if (d === '\r') hostRef.current?.sendStdin('\n')
      else hostRef.current?.sendStdin(d)
    })
  }, [workspaceOpen])

  if (!workspaceOpen) {
    return (
      <main className="landing">
        <div className="landing-wash landing-wash-peach" />
        <div className="landing-wash landing-wash-lilac" />
        <div className="landing-grain" />
        <header className="landing-nav">
          <a className="landing-brand" href="#home" aria-label="CPP Web home">
            <span className="landing-mark">{'{;}'}</span>
            <span>CPP<span className="landing-brand-light">://</span>Web</span>
          </a>
          <span className="landing-nav-note"><span className="landing-live-dot" /> C / C++ IN YOUR BROWSER</span>
        </header>

        <section className="landing-content" id="home">
          <div className="landing-copy">
            <span className="landing-eyebrow"><span /> YOUR NEXT IDEA STARTS HERE</span>
            <h1>Build in C.<br /><span>Right here.</span></h1>
            <p className="landing-description">A focused C and C++ workspace that lives in your browser. Write, compile, and run your code without breaking your flow.</p>
            <div className="landing-actions">
              <button className="landing-cta" onClick={() => setWorkspaceOpen(true)}>
                Continue to compiler <span aria-hidden="true">-&gt;</span>
              </button>
              <span className="landing-no-setup">No setup. Just start.</span>
            </div>
            <div className="landing-proof">
              <span className="landing-proof-icon">C</span>
              <span><strong>Made for the work</strong><small>Files, terminal, and canvas in one place</small></span>
            </div>
          </div>

          <div className="landing-stage" aria-label="Preview of the browser compiler workspace">
            <div className="landing-orbit landing-orbit-one" />
            <div className="landing-orbit landing-orbit-two" />
            <div className="landing-float-chip chip-c">C</div>
            <div className="landing-float-chip chip-braces">{'{ }'}</div>
            <div className="landing-preview">
              <div className="preview-topline">
                <div className="preview-brand"><span>{'{;}'}</span> CPP://Web</div>
                <div className="preview-window-dots"><i /><i /><i /></div>
              </div>
              <div className="preview-toolbar"><span>⌘ &nbsp; main.c</span><span className="preview-run"><b /> Run</span></div>
              <div className="preview-editor">
                <div className="preview-line"><span>01</span><code><i>#include</i> &lt;stdio.h&gt;</code></div>
                <div className="preview-line"><span>02</span><code /></div>
                <div className="preview-line"><span>03</span><code><em>int</em> main() {'{'}</code></div>
                <div className="preview-line"><span>04</span><code>&nbsp;&nbsp;printf(<strong>"Hello, world!\n"</strong>);</code></div>
                <div className="preview-line"><span>05</span><code>&nbsp;&nbsp;<em>return</em> 0;</code></div>
                <div className="preview-line"><span>06</span><code>{'}'}</code></div>
              </div>
              <div className="preview-console">
                <div className="preview-console-head"><span>OUTPUT</span><span>RUN COMPLETE</span></div>
                <code><b>&gt;</b> Hello, world!</code>
                <small>Process exited successfully <i>0.02s</i></small>
              </div>
              <div className="preview-reflection" />
            </div>
            <div className="landing-caption"><span /> LIVE WORKSPACE PREVIEW <span className="caption-line" /></div>
          </div>
        </section>
        <footer className="landing-footer"><span>THOUGHTFUL TOOLS FOR YOUR NEXT COMPILE</span><span>COMPILE. RUN. KEEP GOING.</span></footer>
      </main>
    )
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">{`{;}`}</span>
          <span className="logo">CPP://Web</span>
          <span className="workspace-label">LOCAL WORKSPACE</span>
        </div>
        <div className="run-controls">
          <button className="btn primary" onClick={run} disabled={busy || !active}><span className="btn-icon">▶</span> Run</button>
          <button className="btn" onClick={stop} disabled={!busy}><span className="btn-icon">■</span> Stop</button>
          <button className="btn btn-quiet" onClick={guiDemo}><span className="btn-icon">◈</span> Canvas</button>
        </div>
        <span className={'status ' + (tcStatus === 'ready' ? 'ok' : tcStatus === 'demo' ? 'err' : '')}>
          <span className="status-dot" />
          {tcStatus === 'checking' ? 'toolchain: checking…'
            : tcStatus === 'ready' ? 'toolchain: READY'
            : 'toolchain: DEMO MODE'}
        </span>
      </div>
      <div className="sidebar">
        <FileManager active={active} refreshKey={refreshKey}
          onOpen={openFile} onChanged={() => setRefreshKey((k) => k + 1)} />
      </div>
      <div className="main">
        <div className="tabs">
          {openTabs.map((t) => (
            <span key={t} className={'tab' + (t === active ? ' active' : '')}
              onClick={() => setActive(t)}>
              {t.replace(/^\//, '')} <span style={{ opacity: .5 }} onClick={(e) => { e.stopPropagation(); closeTab(t) }}>×</span>
            </span>
          ))}
        </div>
        <div className="editor-host">
          {active ? <Editor key={active} value={files[active] ?? ''} onChange={onEdit} />
                  : <div className="empty-editor">Open or create a file to start coding</div>}
        </div>
      </div>
      <div className="terminal-panel">
        <div className="term-head">Terminal</div>
        <div className="term-host"><Terminal ref={termRef} /></div>
      </div>
      {guiOpen && <CanvasWindow title="Program Output — 640×480" onClose={() => setGuiOpen(false)} op={guiOp} />}
    </div>
  )
}
