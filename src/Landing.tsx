import { useRef } from 'react'
import { usePencil } from './usePencil'

type LandingProps = {
  onOpenEditor: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

const PENCIL_SVG = `
  <svg viewBox="0 0 30 12" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M1 10.5 L10 2.5 L19 2.5 L28 10.5 L19 10.5 L17 12 L9 12 L7 10.5 Z" fill="var(--chrome-bg)" stroke="var(--fg)" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="M18.5 2.5 L28 1.5 L25.2 4.5 Z" fill="var(--muted)"/>
    <path d="M9 2.5 L17 2.5 L17 10.5 L9 10.5 Z" fill="var(--editor-bg)"/>
    <path d="M0.8 10.5 L9.2 2.1 L10.3 2.8 L2.2 10.5 Z" fill="var(--muted)" opacity="0.7"/>
    <rect x="17.5" y="2.1" width="9.2" height="2" rx="0.7" fill="var(--fg)" opacity="0.9"/>
    <path d="M18.8 3.6 L28.8 2.4 L27.4 4.5 Z" fill="var(--muted)"/>
    <path d="M2 10.5 L7.5 10.5 L6.4 12 L1 12 Z" fill="var(--fg)" opacity="0.7"/>
  </svg>
`

export default function Landing({ onOpenEditor, theme, onToggleTheme }: LandingProps) {
  const landingRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pencilRef = useRef<HTMLDivElement>(null)

  usePencil({ containerRef: landingRef, canvasRef, pencilRef })

  return (
    <div className="landing" ref={landingRef}>
      <canvas ref={canvasRef} className="landing-canvas" aria-hidden="true" />
      <div
        ref={pencilRef}
        className="landing-pencil"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: PENCIL_SVG }}
      />

      <main className="landing-inner">
        <h1 className="landing-title">CppPad</h1>
        <p className="landing-copy">A C++ editor that compiles with GCC in your browser.</p>

        <button type="button" className="btn primary landing-button" onClick={onOpenEditor}>
          Open editor
        </button>

        <p className="landing-disclosure">Your code is sent to Wandbox when you press Run.</p>

        <footer className="landing-footer">
          <span className="landing-footer-text">© 2026 NullEntity · CMPG 172 Project</span>
          <button
            type="button"
            className="status-item status-btn landing-toggle"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? 'Dark' : 'Light'}
          </button>
        </footer>
      </main>
    </div>
  )
}
