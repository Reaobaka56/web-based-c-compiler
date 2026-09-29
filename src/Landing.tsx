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
      <main className="landing-inner">
        <section className="landing-copy-block">
          <h1 className="landing-title">CppPad</h1>
          <p className="landing-byline">by NullEntity</p>
          <p className="landing-copy">A C++ editor that compiles with GCC in your browser.</p>

          <div className="code-preview" aria-label="Sample C++ output preview">
            <div className="code-preview-bar">
              <span className="dot r" />
              <span className="dot y" />
              <span className="dot g" />
              <span className="code-file-name">main.cpp</span>
            </div>

            <pre className="code-preview-body"><code>{`#include <iostream>\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}`}</code></pre>

            <div className="code-preview-output">
              <span className="prompt">$ ./a.out</span>
              <span className="stdout">Hello, World!</span>
              <span className="status">Process exited with code 0</span>
            </div>
          </div>

          <button type="button" className="btn primary landing-button" onClick={onOpenEditor}>
            Open editor
          </button>

          <p className="landing-disclosure">Your code is sent to Wandbox when you press Run.</p>
        </section>

        <aside className="developer-card" aria-label="Developer profiles">
          <div className="developer-header">
            <span className="developer-label">Developers</span>
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
