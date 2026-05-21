'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

interface Props {
  onCapture: (dataUrl: string) => void
  onClear?: () => void
  width?: number
  height?: number
  strokeColor?: string
  disabled?: boolean
}

export default function SignaturePad({
  onCapture,
  onClear,
  width = 480,
  height = 160,
  strokeColor = '#e5e7eb',
  disabled = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#111827'
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [width, height, strokeColor])

  const getPos = (clientX: number, clientY: number, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  const startDraw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return
      drawing.current = true
      const canvas = canvasRef.current!
      const pos =
        'touches' in e
          ? getPos(e.touches[0].clientX, e.touches[0].clientY, canvas)
          : getPos(e.clientX, e.clientY, canvas)
      lastPos.current = pos
    },
    [disabled]
  )

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!drawing.current || disabled) return
      e.preventDefault()
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!
      const pos =
        'touches' in e
          ? getPos(e.touches[0].clientX, e.touches[0].clientY, canvas)
          : getPos(e.clientX, e.clientY, canvas)

      ctx.beginPath()
      ctx.moveTo(lastPos.current.x, lastPos.current.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      lastPos.current = pos
      setIsEmpty(false)
    },
    [disabled]
  )

  const endDraw = useCallback(() => {
    if (!drawing.current) return
    drawing.current = false
    const canvas = canvasRef.current
    if (canvas) {
      onCapture(canvas.toDataURL('image/png'))
    }
  }, [onCapture])

  function clear() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#111827'
    ctx.fillRect(0, 0, width, height)
    setIsEmpty(true)
    onClear?.()
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl overflow-hidden border-2 border-dashed border-gray-600 select-none">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full cursor-crosshair touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-600 text-sm">Firme aquí</p>
          </div>
        )}
        {/* Baseline */}
        <div className="absolute bottom-8 left-6 right-6 border-t border-gray-700 pointer-events-none" />
      </div>

      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-500">
          {isEmpty ? 'Trace su firma sobre el recuadro' : '✓ Firma capturada'}
        </p>
        <button
          type="button"
          onClick={clear}
          disabled={disabled || isEmpty}
          className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30 transition-colors"
        >
          Limpiar
        </button>
      </div>
    </div>
  )
}
