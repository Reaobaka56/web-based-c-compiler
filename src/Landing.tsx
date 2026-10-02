import { useEffect, useRef, useState } from 'react'
import { LINKED_LIST_EXAMPLE } from './fs/vfs'

type LandingProps = {
  onOpenEditor: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

export default function Landing({ onOpenEditor, theme, onToggleTheme }: LandingProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const aboutDialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!menuOpen) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }

    document.addEventListener('keydown', closeOnEscape)
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('pointerdown', closeOnOutsideClick)
    }
  }, [menuOpen])

  useEffect(() => {
    const dialog = aboutDialogRef.current
    if (!dialog) return
    if (aboutOpen && !dialog.open) dialog.showModal()
    if (!aboutOpen && dialog.open) dialog.close()
  }, [aboutOpen])

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="landing">
      <header className="landing-nav" ref={headerRef}>
        <a className="brand landing-brand" href="#top" aria-label="CppPad home">
          <svg className="brand-icon" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="6" fill="currentColor" />
            <text x="16" y="21" textAnchor="middle" fill="var(--on-accent)" fontFamily="monospace" fontSize="12" fontWeight="700">C++</text>
          </svg>
          <span>CppPad</span>
        </a>
        <nav className={'landing-links' + (menuOpen ? ' open' : '')} id="landing-menu" aria-label="Main navigation">
          <button
            type="button"
            className="landing-nav-link"
            aria-haspopup="dialog"
            onClick={() => { closeMenu(); setAboutOpen(true) }}
          >
            About
          </button>
          <button type="button" className="theme-toggle landing-menu-theme" onClick={() => { onToggleTheme(); closeMenu() }} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            <ThemeIcon theme={theme} />
          </button>
        </nav>
        <div className="landing-nav-actions">
          <button type="button" className="theme-toggle landing-desktop-theme" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            <ThemeIcon theme={theme} />
          </button>
          <button
            type="button"
            className={'landing-menu-button' + (menuOpen ? ' is-open' : '')}
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-controls="landing-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>
      <main className="landing-inner" id="top">
        <section className="landing-copy-block">
          <h1 className="landing-title">CppPad</h1>
          <p className="landing-copy">Write C++ in your browser. Compiles with GCC.</p>
          <p className="landing-disclosure">Your code is sent to Wandbox when you press Run.</p>
        </section>
        <section className="landing-example" id="example" aria-label="Default C++ example">
          <div className="code-card">
            <div className="code-card-header">
              <span>main.cpp</span>
              <button
                type="button"
                className="btn code-test-button"
                onClick={onOpenEditor}
              >
                Test code
              </button>
            </div>
            <pre><code>{LINKED_LIST_EXAMPLE}</code></pre>
          </div>
        </section>
      </main>

      <dialog
        ref={aboutDialogRef}
        className="about-dialog"
        aria-labelledby="about-dialog-title"
        onClose={() => setAboutOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close()
        }}
      >
        <div className="about-dialog-content">
          <h2 id="about-dialog-title">About CppPad</h2>
          <p>A code editor made by NullEntity for CMPG172.</p>
          <button type="button" className="btn primary" onClick={() => aboutDialogRef.current?.close()} autoFocus>
            Close
          </button>
        </div>
      </dialog>

      <footer className="landing-footer">
        <span className="landing-credit">
          <span>NullEntity · CMPG 172 Project || Built with love (well, mostly TypeScript, but love)</span>
          <svg className="south-africa-flag" viewBox="0 0 36 24" role="img" aria-label="South African flag">
            <path fill="#e03c31" d="M0 0h36v12H0z" />
            <path fill="#001489" d="M0 12h36v12H0z" />
            <path d="M0 0 18 12h18M0 24l18-12" fill="none" stroke="#fff" strokeWidth="10" />
            <path d="M0 0 18 12h18M0 24l18-12" fill="none" stroke="#007749" strokeWidth="6" />
            <path fill="#ffb81c" d="M0 0 18 12 0 24z" />
            <path fill="#000" d="M0 3 13.5 12 0 21z" />
          </svg>
        </span>
      </footer>
    </div>
  )
}

function ThemeIcon({ theme }: { theme: 'dark' | 'light' }) {
  return theme === 'dark'
    ? <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M8 1.5v1.4M8 13.1v1.4M1.5 8h1.4M13.1 8h1.4m-10.1-4.6 1 1m5.2 5.2 1 1m0-7.3-1 1m-5.2 5.2-1 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
    : <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.4 10.2A5.9 5.9 0 0 1 5.8 2.6 5.9 5.9 0 1 0 13.4 10.2Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
}
