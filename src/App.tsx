import { useCallback, useEffect, useRef, useState } from 'react'
import FileManager from './fs/FileManager'
import Editor from './editor/Editor'
import Terminal, { TerminalHandle } from './terminal/Terminal'
import CanvasWindow, { GuiMessage } from './gui/CanvasWindow'
import { ensureDefaultProject, writeFile, readAll } from './fs/vfs'
import { compileProject, toolchainStatus } from './compiler/clang'
import { WorkerHost } from './runner/WorkerHost'

export default function App() {
  const [files, setFiles] = useState<Record<string, string>>({})
  const [openTabs, setOpenTabs] = useState<string[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [tcStatus, setTcStatus] = useState<'checking' | 'demo' | 'ready'>('checking')
  const [busy, setBusy] = useState(false)
  const [guiOpen, setGuiOpen] = useState(false)
  const [guiOp, setGuiOp] = useState<GuiMessage | null>(null)
  const [programInput, setProgramInput] = useState('')
  const termRef = useRef<TerminalHandle | null>(null)
  const hostRef = useRef<WorkerHost | null>(null)
  const filesRef = useRef(files)
  filesRef.current = files

  useEffect(() => {
    ;(async () => {
      await ensureDefaultProject()
      const all = await readAll()
      setFiles(all)
      const first = Object.keys(all).sort()[0]
      if (first) {
        setOpenTabs([first])
        setActive(first)
      }
      const st = await toolchainStatus()
      setTcStatus(st.ready ? 'ready' : 'demo')
    })()
    return () => hostRef.current?.kill()
  }, [])

  const log = useCallback((s: string) => termRef.current?.write(s), [])

  const openFile = useCallback(async (path: string) => {
    setFiles((f) => ({ ...f, [path]: f[path] ?? '' }))
    setOpenTabs((tabs) => (tabs.includes(path) ? tabs : [...tabs, path]))
    setActive(path)
  }, [])

  const closeTab = useCallback((path: string) => {
    setOpenTabs((tabs) => {
      const next = tabs.filter((t) => t !== path)
      if (active === path) setActive(next[next.length - 1] ?? null)
      return next
    })
  }, [active])

  const handleDeleted = useCallback((path: string) => {
    setOpenTabs((tabs) => tabs.filter((tab) => tab !== path))
    if (active === path) {
      setActive(null)
    }
  }, [active])

  const onEdit = useCallback((v: string) => {
    if (!active) return
    setFiles((f) => ({ ...f, [active]: v }))
    void writeFile(active, v)
  }, [active])

  const run = useCallback(async () => {
    if (!active) return
    setBusy(true)
    termRef.current?.clear()
    try {
      const source = filesRef.current[active] ?? ''
      await writeFile(active, source)
      const compiled = await compileProject(source, new AbortController().signal, programInput)
      hostRef.current ??= new WorkerHost()
      setGuiOpen(true)
      hostRef.current.run(compiled, {
        onStdout: (d) => termRef.current?.write(d),
        onGui: (m) => setGuiOp(m),
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

  const stop = useCallback(() => {
    hostRef.current?.kill()
    setBusy(false)
    log('\x1b[31m── killed ──\x1b[0m\n')
  }, [log])

  const guiDemo = useCallback(() => {
    setGuiOpen(true)
    let x = 50
    let y = 50
    let dx = 4
    let dy = 3
    const id = setInterval(() => {
      x += dx
      y += dy
      if (x < 20 || x > 620) dx *= -1
      if (y < 20 || y > 460) dy *= -1
      setGuiOp({ op: 'clear', r: 15, g: 17, b: 23 })
      setGuiOp({ op: 'circle', x, y, rad: 20, r: 88, g: 166, b: 255 })
    }, 16)
    setTimeout(() => clearInterval(id), 30000)
  }, [])

  useEffect(() => {
    termRef.current?.onInput((line) => setProgramInput((v) => v + line))
  }, [])

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
        <FileManager
          active={active}
          refreshKey={refreshKey}
          onOpen={openFile}
          onChanged={() => setRefreshKey((k) => k + 1)}
          onDeleted={handleDeleted}
        />
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
          {active ? (
            <Editor
              key={active}
              value={files[active] ?? ''}
              onChange={onEdit}
              onRun={run}
              onCursor={() => undefined}
            />
          ) : <div className="empty-editor">Open or create a file to start coding</div>}
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
