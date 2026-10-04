import { useCallback, useEffect, useRef, useState } from 'react'

const BASE = '/presentation'
const TOTAL = 14
const TRANSITION_MS = 4000
const TILES = 6
const NO_TRANSITION = new Set([10, 13])

const pad = (n: number) => String(n).padStart(2, '0')
const slideSrc = (i: number) => `${BASE}/slide-${pad(i + 1)}.jpg`
const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface Props {
  onClose: () => void
}

export default function PresentationViewer({ onClose }: Props) {
  const [index, setIndex] = useState(0)
  const [leaving, setLeaving] = useState<number | null>(null)
  const [introKey, setIntroKey] = useState(0)
  const [assetError, setAssetError] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const touchX = useRef<number | null>(null)
  const suppressClick = useRef(false)
  const indexRef = useRef(0)

  useEffect(() => {
    for (let i = 0; i < TOTAL; i++) new Image().src = slideSrc(i)
    new Image().src = `${BASE}/slide-01-base.jpg`
    new Image().src = `${BASE}/slide-01-title.jpg`
  }, [])

  const finishTransition = useCallback(() => {
    window.clearTimeout(timerRef.current)
    setLeaving(null)
  }, [])

  const goTo = useCallback((target: number) => {
    const current = indexRef.current
    if (target < 0 || target >= TOTAL || target === current) return
    window.clearTimeout(timerRef.current)
    const animate = !NO_TRANSITION.has(target) && !reducedMotion() && target > current
    if (animate) {
      setLeaving(current)
      timerRef.current = window.setTimeout(() => setLeaving(null), TRANSITION_MS)
    } else {
      setLeaving(null)
    }
    if (target === 0) setIntroKey((key) => key + 1)
    indexRef.current = target
    setIndex(target)
    setAssetError(false)
  }, [])

  const next = useCallback(() => {
    if (leaving !== null) {
      finishTransition()
      return
    }
    goTo(index + 1)
  }, [leaving, index, goTo, finishTransition])

  const prev = useCallback(() => {
    finishTransition()
    goTo(index - 1)
  }, [index, goTo, finishTransition])

  const toggleFullscreen = useCallback(() => {
    const element = rootRef.current
    if (!element) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void element.requestFullscreen?.()
  }, [])

  useEffect(() => {
    rootRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      window.clearTimeout(timerRef.current)
      if (document.fullscreenElement === rootRef.current) void document.exitFullscreen()
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
        case 'Enter':
          event.preventDefault()
          next()
          break
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
        case 'Backspace':
          event.preventDefault()
          prev()
          break
        case 'Home':
          event.preventDefault()
          finishTransition()
          goTo(0)
          break
        case 'End':
          event.preventDefault()
          finishTransition()
          goTo(TOTAL - 1)
          break
        case 'f':
        case 'F':
          toggleFullscreen()
          break
        case 'Escape':
          if (!document.fullscreenElement) onClose()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, goTo, finishTransition, toggleFullscreen, onClose])

  const onTouchStart = (event: React.TouchEvent) => {
    touchX.current = event.touches[0]?.clientX ?? null
  }

  const onTouchEnd = (event: React.TouchEvent) => {
    if (touchX.current === null) return
    const dx = event.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) > 50) {
      suppressClick.current = true
      window.setTimeout(() => { suppressClick.current = false }, 400)
      ;(dx < 0 ? next : prev)()
    }
  }

  return (
    <div
      className="pv-backdrop"
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Presentation: Linked Lists – Insertion and Deletion"
      tabIndex={-1}
    >
      <div className="pv-topbar">
        <span className="pv-title">NullEntity — Linked Lists: Insertion &amp; Deletion</span>
        <span className="pv-spacer" />
        <button className="pv-icon-btn" type="button" onClick={toggleFullscreen} title="Fullscreen (F)" aria-label="Toggle fullscreen">⛶</button>
        <button className="pv-icon-btn" type="button" onClick={onClose} title="Close (Esc)" aria-label="Close presentation">✕</button>
      </div>

      <div className="pv-stage-wrap" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="pv-stage" onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false
            return
          }
          next()
        }}>
          {leaving !== null && (
            <div className="pv-layer pv-out" style={{ animationDuration: `${TRANSITION_MS}ms` }}>
              <img src={slideSrc(leaving)} alt="" draggable={false} onError={() => setAssetError(true)} />
            </div>
          )}

          {index === 0 ? (
            <div className="pv-layer" key={`intro-${introKey}`}>
              <img src={`${BASE}/slide-01-base.jpg`} alt="" draggable={false} onError={() => setAssetError(true)} />
              <img className="pv-fade" style={{ animationDelay: '1000ms' }} src={`${BASE}/slide-01-title.jpg`} alt="" draggable={false} onError={() => setAssetError(true)} />
              <img className="pv-fade" style={{ animationDelay: '1500ms' }} src={slideSrc(0)} alt="Slide 1" draggable={false} onError={() => setAssetError(true)} />
            </div>
          ) : leaving !== null ? (
            <div className="pv-layer pv-vortex" key={`in-${index}`}>
              {Array.from({ length: TILES }, (_, tile) => (
                <div
                  key={tile}
                  className="pv-tile"
                  style={{
                    clipPath: `inset(${(tile * 100) / TILES}% 0 ${100 - ((tile + 1) * 100) / TILES}% 0)`,
                    animationDuration: `${TRANSITION_MS}ms`,
                    animationDelay: `${tile * (TRANSITION_MS * 0.06)}ms`,
                    ['--spin' as string]: `${tile % 2 ? -1 : 1}`
                  }}
                >
                  <img src={slideSrc(index)} alt={tile === 0 ? `Slide ${index + 1}` : ''} draggable={false} onError={() => setAssetError(true)} />
                </div>
              ))}
            </div>
          ) : (
            <div className="pv-layer" key={`static-${index}`}>
              <img src={slideSrc(index)} alt={`Slide ${index + 1}`} draggable={false} onError={() => setAssetError(true)} />
            </div>
          )}

          {assetError && (
            <div className="pv-error" role="alert">
              <strong>Slide previews are unavailable.</strong>
              <span>You can still open the PowerPoint presentation.</span>
              <a className="btn" href={`${BASE}/slide-deck.pptx`} target="_blank" rel="noreferrer">
                Open PowerPoint presentation
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="pv-controls">
        <button className="pv-nav" type="button" onClick={prev} disabled={index === 0} aria-label="Previous slide">‹</button>
        <span className="pv-count" aria-live="polite">{index + 1} / {TOTAL}</span>
        <button className="pv-nav" type="button" onClick={next} disabled={index === TOTAL - 1 && leaving === null} aria-label="Next slide">›</button>
      </div>
    </div>
  )
}
