import { useEffect, useRef } from 'react'

export type GuiMessage =
  | { op: 'clear'; r: number; g: number; b: number }
  | { op: 'rect'; x: number; y: number; w: number; h: number; r: number; g: number; b: number }
  | { op: 'circle'; x: number; y: number; rad: number; r: number; g: number; b: number }

interface Props {
  title: string
  onClose: () => void
  op: GuiMessage | null
}

export default function CanvasWindow({ title, onClose, op }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)

    if (!op) return

    switch (op.op) {
      case 'clear': {
        ctx.fillStyle = `rgb(${op.r}, ${op.g}, ${op.b})`
        ctx.fillRect(0, 0, width, height)
        break
      }
      case 'rect': {
        ctx.fillStyle = `rgb(${op.r}, ${op.g}, ${op.b})`
        ctx.fillRect(op.x, op.y, op.w, op.h)
        break
      }
      case 'circle': {
        ctx.fillStyle = `rgb(${op.r}, ${op.g}, ${op.b})`
        ctx.beginPath()
        ctx.arc(op.x, op.y, op.rad, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      default:
        break
    }
  }, [op])

  return (
    <div className="gui-wrap">
      <div className="gui-head">
        <span>{title}</span>
        <button className="btn btn-quiet" onClick={onClose} aria-label="Close panel">✕</button>
      </div>
      <canvas ref={canvasRef} width={640} height={480} />
    </div>
  )
}
