'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  onCapture: (file: File) => void
  disabled?: boolean
}

type CameraState = 'idle' | 'requesting' | 'active' | 'captured' | 'error'

export default function CameraScanner({ onCapture, disabled }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [state, setState] = useState<CameraState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Tu dispositivo no soporta acceso a cámara')
      setState('error')
      return
    }

    setState('requesting')
    setError(null)

    try {
      stopStream()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setState('active')
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Acceso a cámara denegado. Habilita el permiso en tu navegador.'
          : 'No se pudo iniciar la cámara'
      setError(msg)
      setState('error')
    }
  }, [facingMode, stopStream])

  useEffect(() => {
    return () => stopStream()
  }, [stopStream])

  function capture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    setPreview(dataUrl)
    setState('captured')
    stopStream()

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `camara-${Date.now()}.jpg`, { type: 'image/jpeg' })
        onCapture(file)
      },
      'image/jpeg',
      0.92
    )
  }

  function retake() {
    setPreview(null)
    setState('idle')
  }

  function toggleFacing() {
    setFacingMode((f) => (f === 'environment' ? 'user' : 'environment'))
    if (state === 'active') startCamera()
  }

  return (
    <div className="space-y-3">
      <div className="relative bg-gray-900 border border-gray-800 rounded-xl overflow-hidden aspect-video flex items-center justify-center">
        {state === 'idle' && (
          <div className="text-center space-y-3 p-6">
            <div className="w-16 h-16 mx-auto bg-gray-800 rounded-2xl flex items-center justify-center">
              <span className="text-3xl">📷</span>
            </div>
            <div>
              <p className="text-sm text-gray-300">
                Captura el documento con la cámara
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Asegúrate de que el documento esté bien iluminado y recto
              </p>
            </div>
            <button
              onClick={startCamera}
              disabled={disabled}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
            >
              Abrir cámara
            </button>
          </div>
        )}

        {state === 'requesting' && (
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-400">Iniciando cámara...</p>
          </div>
        )}

        {state === 'active' && (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            {/* Document guide overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-6 border-2 border-amber-400/60 rounded-lg">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg -translate-x-0.5 -translate-y-0.5" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg translate-x-0.5 -translate-y-0.5" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-lg -translate-x-0.5 translate-y-0.5" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-lg translate-x-0.5 translate-y-0.5" />
              </div>
              <p className="absolute bottom-8 left-0 right-0 text-center text-xs text-amber-300/80">
                Alinea el documento dentro del marco
              </p>
            </div>
          </>
        )}

        {state === 'captured' && preview && (
          <img
            src={preview}
            alt="Captura"
            className="w-full h-full object-contain"
          />
        )}

        {state === 'error' && (
          <div className="text-center space-y-2 p-6">
            <span className="text-3xl">⚠️</span>
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={startCamera}
              className="text-sm text-amber-400 hover:underline"
            >
              Reintentar
            </button>
          </div>
        )}
      </div>

      {state === 'active' && (
        <div className="flex gap-2">
          <button
            onClick={capture}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            📸 Capturar
          </button>
          <button
            onClick={toggleFacing}
            className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
            title="Cambiar cámara"
          >
            🔄
          </button>
          <button
            onClick={() => { stopStream(); setState('idle') }}
            className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl text-sm transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {state === 'captured' && (
        <button
          onClick={retake}
          className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-xl text-sm transition-colors"
        >
          Volver a tomar
        </button>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
