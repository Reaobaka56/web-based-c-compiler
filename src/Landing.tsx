type LandingProps = {
  onOpenEditor: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

const DEV_TEAM = [
  'Reaobaka56',
  'Reginald8712',
  'kelebohilemonaheng-code',
]

export default function Landing({ onOpenEditor, theme, onToggleTheme }: LandingProps) {
  return (
    <div className="landing">
      <header className="landing-nav">
        <a className="brand landing-brand" href="#top" aria-label="CppPad home">
          <svg className="brand-icon" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="6" fill="currentColor" />
            <text x="16" y="21" textAnchor="middle" fill="var(--on-accent)" fontFamily="monospace" fontSize="12" fontWeight="700">C++</text>
          </svg>
          <span>CppPad</span>
        </a>
        <button type="button" className="theme-toggle" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
          {theme === 'dark'
            ? <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M8 1.5v1.4M8 13.1v1.4M1.5 8h1.4M13.1 8h1.4m-10.1-4.6 1 1m5.2 5.2 1 1m0-7.3-1 1m-5.2 5.2-1 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
            : <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.4 10.2A5.9 5.9 0 0 1 5.8 2.6 5.9 5.9 0 1 0 13.4 10.2Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>}
        </button>
      </header>
      <main className="landing-inner" id="top">
        <section className="landing-copy-block">
          <h1 className="landing-title">CppPad</h1>
          <p className="landing-copy">Write C++ in your browser. Compiles with GCC.</p>
          <button type="button" className="btn primary landing-button" onClick={onOpenEditor}>
            Open editor
          </button>
          <p className="landing-disclosure">Your code is sent to Wandbox when you press Run.</p>
        </section>
      </main>

      <footer className="landing-footer">
        <span>Built by {DEV_TEAM.map((login, index) => (
          <span key={login}>
            {index > 0 && ', '}
            <a href={`https://github.com/${login}`} target="_blank" rel="noreferrer">{login}</a>
          </span>
        ))} · NullEntity · CMPG 172 Project</span>
      </footer>
    </div>
  )
}
