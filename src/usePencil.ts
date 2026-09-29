import { RefObject, useEffect } from 'react'

type UsePencilOptions = {
  containerRef: RefObject<HTMLElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  pencilRef: RefObject<HTMLDivElement | null>
}

type Point = { x: number; y: number }

type Stroke = {
  points: Point[]
  startedAt: number
  width: number
}

const DRAW_DURATION_MS = 5000
const isInteractiveTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('button, a, .landing-toggle, .landing-button, .status-btn, .profile-avatar'))
}

export function usePencil({ containerRef, canvasRef, pencilRef }: UsePencilOptions) {
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const pencil = pencilRef.current
    if (!container || !canvas || !pencil) return

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const strokes: Stroke[] = []
    let rafId = 0
    let lastPoint: Point | null = null

    const hidePencil = () => {
      pencil.style.opacity = '0'
      pencil.style.transform = 'translate3d(0, 0, 0) rotate(-35deg)'
    }

    const setPencilLocation = (x: number, y: number) => {
      pencil.style.opacity = '1'
      pencil.style.transform = `translate3d(${x - 18}px, ${y - 9}px, 0) rotate(-35deg)`
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      const ratio = window.devicePixelRatio || 1
      const width = Math.floor(window.innerWidth * ratio)
      const height = Math.floor(window.innerHeight * ratio)
      canvas.width = width
      canvas.height = height
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    const drawStroke = (stroke: Stroke) => {
      if (stroke.points.length === 0) return

      const elapsed = performance.now() - stroke.startedAt
      const alpha = Math.max(0, 1 - elapsed / DRAW_DURATION_MS)
      if (alpha <= 0) return

      const muted = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#8e929c'
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = muted
      ctx.lineWidth = stroke.width
      ctx.globalAlpha = alpha

      const [first, ...rest] = stroke.points
      ctx.beginPath()
      ctx.moveTo(first.x, first.y)

      let previous = first
      for (let i = 0; i < rest.length; i += 1) {
        const next = rest[i]
        const midX = (previous.x + next.x) / 2
        const midY = (previous.y + next.y) / 2
        ctx.quadraticCurveTo(previous.x, previous.y, midX, midY)
        previous = next
      }

      const finalPoint = stroke.points[stroke.points.length - 1]
      ctx.lineTo(finalPoint.x, finalPoint.y)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    const animate = () => {
      if (reducedMotionQuery.matches) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        rafId = 0
        return
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (let i = strokes.length - 1; i >= 0; i -= 1) {
        const stroke = strokes[i]
        drawStroke(stroke)
        if (performance.now() - stroke.startedAt >= DRAW_DURATION_MS) {
          strokes.splice(i, 1)
        }
      }

      if (strokes.length > 0) {
        rafId = window.requestAnimationFrame(animate)
      } else {
        rafId = 0
      }
    }

    const addStroke = (from: Point, to: Point) => {
      const distance = Math.hypot(to.x - from.x, to.y - from.y)
      const width = 1.2 + Math.min(distance * 0.05, 2.2)
      strokes.push({ points: [from, to], startedAt: performance.now(), width })
      if (!rafId) {
        rafId = window.requestAnimationFrame(animate)
      }
    }

    const handleMove = (event: PointerEvent) => {
      if (reducedMotionQuery.matches || event.pointerType !== 'mouse') {
        hidePencil()
        return
      }

      if (isInteractiveTarget(event.target)) {
        hidePencil()
        return
      }

      const point = { x: event.clientX, y: event.clientY }
      setPencilLocation(point.x, point.y)

      if (!lastPoint) {
        lastPoint = point
        return
      }

      addStroke(lastPoint, point)
      lastPoint = point
    }

    const handleLeave = () => {
      hidePencil()
      lastPoint = null
    }

    resizeCanvas()
    hidePencil()
    container.style.cursor = 'none'

    container.addEventListener('pointermove', handleMove)
    container.addEventListener('pointerleave', handleLeave)
    window.addEventListener('resize', resizeCanvas)

    return () => {
      container.style.cursor = ''
      container.removeEventListener('pointermove', handleMove)
      container.removeEventListener('pointerleave', handleLeave)
      window.removeEventListener('resize', resizeCanvas)
      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }
      canvas.remove()
      pencil.remove()
    }
  }, [canvasRef, containerRef, pencilRef])
}
