import { useEffect, useRef } from 'react'

interface RunResult {
  fileName: string
  exitCode: number
  ms: number
  compileFailed: boolean
  output: string
}

interface RunResultPopupProps {
  open: boolean
  onClose: () => void
  result: RunResult | null
}

export default function RunResultPopup({ open, onClose, result }: RunResultPopupProps) {
  const popupRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = () => onClose()
    popupRef.current?.focus()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open || !result) return null

  const exitHex = result.exitCode.toString(16).toUpperCase()

  return (
    <div
      className="run-result-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section ref={popupRef} tabIndex={-1} className={'run-result-popup' + (result.exitCode === 0 ? ' success' : ' failure')} role="dialog" aria-modal="true" aria-label={`Run result for ${result.fileName}`}>
        <header className="run-result-titlebar">
          <span>{result.fileName}</span>
          <button className="run-result-close" type="button" aria-label="Close" onClick={onClose}>×</button>
        </header>
        <div className="run-result-body">
          {result.compileFailed && <h2>Build failed</h2>}
          <pre className="run-result-output">{result.output}</pre>
          <div className="run-result-status">
            Process returned {result.exitCode} (0x{exitHex})   execution time : {(result.ms / 1000).toFixed(3)} s
          </div>
          <div className="run-result-prompt">Press any key to continue.</div>
        </div>
      </section>
    </div>
  )
}