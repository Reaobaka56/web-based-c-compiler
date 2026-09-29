import { useEffect, useState } from 'react'

type LandingProps = {
  onOpenEditor: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

type GitHubProfile = {
  login: string
  name: string
  bio: string | null
  public_repos: number
  followers: number
  following: number
  html_url: string
  avatar_url: string
}

const DEV_TEAM = [
  'Reaobaka56',
  'Reginald8712',
  'kelebohilemonaheng-code',
]

export default function Landing({ onOpenEditor, theme, onToggleTheme }: LandingProps) {
  const [profile, setProfile] = useState<GitHubProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (!target) return

      const popover = target.closest('.profile-popover')
      const avatar = target.closest('.profile-avatar')
      if (!popover && !avatar) {
        setProfile(null)
      }
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfile(null)
    }

    window.addEventListener('pointerdown', closeOnOutsideClick)
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      window.removeEventListener('pointerdown', closeOnOutsideClick)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const openProfile = async (login: string) => {
    setLoadingProfile(true)
    try {
      const response = await fetch(`https://api.github.com/users/${login}`)
      if (!response.ok) throw new Error('GitHub profile unavailable')
      const data = (await response.json()) as GitHubProfile
      setProfile((current) => (current?.login === login ? null : data))
    } catch {
      setProfile(null)
    } finally {
      setLoadingProfile(false)
    }
  }

  return (
    <div className="landing">
      <div className="lp-bg" aria-hidden="true">
        <span className="lp-orb lp-orb-a" />
        <span className="lp-orb lp-orb-b" />
        <span className="lp-grid" />
      </div>

      <header className="lp-nav">
        <span className="lp-logo"><span className="logo-mark">C++</span>CppPad</span>
        <a className="lp-nav-link" href="https://github.com/Reaobaka56" target="_blank" rel="noreferrer">GitHub</a>
      </header>

      <main className="landing-inner">
        <section className="landing-copy-block">
          <span className="lp-badge"><i /> GCC · runs in your browser</span>
          <h1 className="landing-title">Write C++.<br /><span className="grad">Run it anywhere.</span></h1>
          <p className="landing-copy">
            A fast, zero-install C++ playground. Your workspace lives in the browser, compiles with GCC, and prints straight to a real terminal.
          </p>

          <div className="lp-cta">
            <button type="button" className="btn primary landing-button" onClick={onOpenEditor}>
              Open editor
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8M6.5 2.5 10 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <span className="lp-hint"><kbd>Ctrl</kbd><kbd>↵</kbd> to run</span>
          </div>

          <ul className="lp-chips" aria-label="Features">
            {['GCC head', 'Multi-file workspace', 'Persistent storage', 'Light & dark'].map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </section>

        <div className="lp-window" aria-hidden="true">
          <div className="lp-window-bar">
            <span className="dot r" />
            <span className="dot y" />
            <span className="dot g" />
            <span className="lp-window-title">main.cpp</span>
          </div>
          <pre className="lp-code">
            <code>
              <span className="ln" style={{ ['--i' as string]: 0 }}><b className="m">#include</b> <b className="s">&lt;iostream&gt;</b></span>
              <span className="ln" style={{ ['--i' as string]: 1 }}>&nbsp;</span>
              <span className="ln" style={{ ['--i' as string]: 2 }}><b className="t">int</b> <b className="f">main</b>() {'{'}</span>
              <span className="ln" style={{ ['--i' as string]: 3 }}>{'    '}<b className="t">std</b>::cout &lt;&lt; <b className="s">"Hello, World!"</b> &lt;&lt; std::endl;</span>
              <span className="ln" style={{ ['--i' as string]: 4 }}>{'    '}<b className="k">return</b> <b className="n">0</b>;</span>
              <span className="ln" style={{ ['--i' as string]: 5 }}>{'}'}<i className="caret" /></span>
            </code>
          </pre>
          <div className="lp-out">
            <span className="lp-out-prompt">$ ./a.out</span>
            <span className="lp-out-line">Hello, World!</span>
            <span className="lp-out-meta">Process exited with code 0</span>
          </div>
        </div>

        <p className="landing-disclosure">Your active file is sent to Wandbox when you press Run.</p>

        <aside className="developer-card" aria-label="Developer profiles">
          <div className="developer-header">
            <span className="developer-label">Built by</span>
          </div>

          <div className="profile-stack" aria-label="Stacked profile images">
            {DEV_TEAM.map((login, index) => (
              <button
                key={login}
                type="button"
                className="profile-avatar"
                style={{ zIndex: DEV_TEAM.length - index }}
                onClick={() => void openProfile(login)}
                aria-label={`Open profile for ${login}`}
                title={login}
              >
                <img src={`https://github.com/${login}.png?size=120`} alt={login} />
              </button>
            ))}
          </div>

          {profile && (
            <div className="profile-popover" role="dialog" aria-live="polite">
              <div className="profile-popover-head">
                <img src={profile.avatar_url} alt={profile.login} />
                <div>
                  <strong>{profile.name || profile.login}</strong>
                  <a href={profile.html_url} target="_blank" rel="noreferrer">@{profile.login}</a>
                </div>
              </div>

              <p>{profile.bio || 'Developer profile'}</p>

              <div className="profile-stats">
                <div>
                  <span>Repos</span>
                  <strong>{profile.public_repos}</strong>
                </div>
                <div>
                  <span>Followers</span>
                  <strong>{profile.followers}</strong>
                </div>
                <div>
                  <span>Following</span>
                  <strong>{profile.following}</strong>
                </div>
              </div>
            </div>
          )}

          {loadingProfile && !profile && <div className="profile-loading">Loading profile…</div>}
        </aside>
      </main>

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
    </div>
  )
}
