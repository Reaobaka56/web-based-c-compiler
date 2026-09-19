import { useEffect, useRef } from 'react'

export interface GuiMessage {
  op: 'clear' | 'rect' | 'circle'
  x?: number; y?: number; w?: number; h?: number
  rad?: number; r: number; g: number; b: number
}

interface Props {
  title: string
  onClose: () => void
  /** Latest GUI op to draw; null clears */
  op: GuiMessage | null
}

export default function CanvasWindow({ title, onClose, op }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cv = canvasRef.current!
    const ctx = cv.getContext('2d')!
    if (!op) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height); return }
    const c = `rgb(${op.r},${op.g},${op.b})`
    if (op.op === 'clear') { ctx.fillStyle = c; ctx.fillRect(0, 0, cv.width, cv.height) }
    else if (op.op === 'rect') { ctx.fillStyle = c; ctx.fillRect(op.x!, op.y!, op.w!, op.h!) }
    else if (op.op === 'circle') {
      ctx.fillStyle = c; ctx.beginPath()
      ctx.arc(op.x!, op.y!, op.rad!, 0, Math.PI * 2); ctx.fill()
    }
  }, [op])

  // Simple drag-to-move
  useEffect(() => {
    const head = headRef.current!, wrap = wrapRef.current!
    let sx = 0, sy = 0, ox = 0, oy = 0, drag = false
    const down = (e: MouseEvent) => { drag = true; sx = e.clientX; sy = e.clientY; const r = wrap.getBoundingClientRect(); ox = r.left; oy = r.top }
    const move = (e: MouseEvent) => { if (!drag) return; wrap.style.position = 'fixed'; wrap.style.left = ox + e.clientX - sx + 'px'; wrap.style.top = oy + e.clientY - sy + 'px'; wrap.style.right = 'auto'; wrap.style.bottom = 'auto' }
    const up = () => { drag = false }
    head.addEventListener('mousedown', down)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { head.removeEventListener('mousedown', down); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [])

  return (
    <div className="gui-wrap" ref={wrapRef}>
      <div className="gui-head" ref={headRef}>
        <span>🖥 {title}</span>
        <button className="btn" onClick={onClose} style={{ padding: '1px 8px' }}>✕</button>
      </div>
      <canvas ref={canvasRef} width={640} height={480} />
    </div>
  )
}
