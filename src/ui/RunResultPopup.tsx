import { useEffect, useMemo, useRef, useState } from 'react'

export interface RunResult {
  fileName: string
  exitCode: number
  ms: number
  compileFailed: boolean
  output: string
}

interface Props {
  fileName: string
  source: string
  result: RunResult | null
  onClose: () => void
  onCancel: () => void
}

function errorLines(text: string): Set<number> {
  const lines = new Set<number>()
  for (const match of text.matchAll(/prog\.[a-z+]+:(\d+):\d+:\s*(?:fatal )?error/gi)) {
    lines.add(Number(match[1]))
  }
  return lines
}

export default function RunResultPopup({ fileName, source, result, onClose, onCancel }: Props) {
  const ref = useRef<HTMLElement>(null)
  const compiling = result === null
  const [elapsed, setElapsed] = useState(0)
  const [tab, setTab] = useState<'output' | 'code'>('output')
  const bad = useMemo(() => (result ? errorLines(result.output) : new Set<number>()), [result])
  const codeLines = useMemo(() => source.split('\n'), [source])

  useEffect(() => { ref.current?.focus() }, [])

  useEffect(() => {
    if (!compiling) return
    const startedAt = performance.now()
    const id = setInterval(() => setElapsed(performance.now() - startedAt), 100)
    return () => clearInterval(id)
  }, [compiling])

  useEffect(() => {
    if (result) setTab(result.compileFailed && bad.size > 0 ? 'code' : 'output')
  }, [result, bad])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (compiling) {
        if (event.key === 'Escape') onCancel()
        return
      }
      if (event.key === 'Tab' || event.key === 'Shift') return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [compiling, onClose, onCancel])

  const ok = result ? result.exitCode === 0 && !result.compileFailed : false
  const dismiss = compiling ? onCancel : onClose

  const codeView = (
    <pre className="run-popup-code" aria-label="Source code preview">
      {codeLines.map((text, index) => (
        <span key={index} className={'code-line' + (bad.has(index + 1) ? ' error' : '')}>
          <span className="code-no">{index + 1}</span>{text || ' '}{'\n'}
        </span>
      ))}
    </pre>
  )

  return (
    <div className="run-backdrop" onClick={(event) => { if (event.target === event.currentTarget) dismiss() }}>
      <section ref={ref} tabIndex={-1} className="run-popup" role="dialog" aria-modal="true" aria-busy={compiling} aria-label={`Run result for ${fileName}`}>
        <header className="run-popup-title">
          <span>{fileName}</span>
          <button className="icon-btn" type="button" aria-label="Close" onClick={dismiss}>
            <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </header>

        {compiling ? (
          <div className="run-popup-body">
            <div className="run-popup-loading" role="status">
              <span className="spinner" aria-hidden="true" />
              <div>
                <div>Compiling with GCC via Wandbox…</div>
                <div className="run-popup-hint">{(elapsed / 1000).toFixed(1)} s · Esc to cancel</div>
              </div>
              <div className="run-popup-bar" aria-hidden="true"><span /></div>
            </div>
            {codeView}
          </div>
        ) : (
          <>
            <div className="run-popup-tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'output'} className={tab === 'output' ? 'active' : ''} onClick={() => setTab('output')}>Output</button>
              <button role="tab" aria-selected={tab === 'code'} className={tab === 'code' ? 'active' : ''} onClick={() => setTab('code')}>
                Code{bad.size > 0 ? ` (${bad.size} error${bad.size > 1 ? 's' : ''})` : ''}
              </button>
            </div>
            <div className="run-popup-body">
              {tab === 'output' ? (
                <>
                  {result.compileFailed && <div className="run-popup-fail">Build failed</div>}
                  <pre className="run-popup-output">{result.output}</pre>
                </>
              ) : codeView}
              <div className={'run-popup-status ' + (ok ? 'ok' : 'bad')}>
                Process returned {result.exitCode} (0x{result.exitCode.toString(16).toUpperCase()})   execution time : {(result.ms / 1000).toFixed(3)} s
              </div>
              <div className="run-popup-hint">Press any key to continue.</div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}