'use client'

import { useState, useEffect, useRef } from 'react'
import SignaturePad from './SignaturePad'
import type { SavedSignature, SigningMethod } from '@/modules/signatures'
import QRCode from 'qrcode'

type ModalMethod = SigningMethod
type ModalStep = 'select' | 'canvas' | 'pin' | 'qr' | 'confirm' | 'submitting' | 'done' | 'error'

interface Props {
  documentId: string
  onClose: () => void
  onSigned: (sig: SavedSignature) => void
}

const METHOD_LABELS: Record<ModalMethod, string> = {
  CANVAS: 'Firma manuscrita',
  PIN: 'Contraseña / PIN',
  QR: 'Código QR',
  CONFIRMED: 'Confirmar con usuario',
}

const METHOD_ICONS: Record<ModalMethod, string> = {
  CANVAS: '✍️',
  PIN: '🔢',
  QR: '📱',
  CONFIRMED: '✅',
}

export default function SignatureModal({ documentId, onClose, onSigned }: Props) {
  const [step, setStep] = useState<ModalStep>('select')
  const [method, setMethod] = useState<ModalMethod>('CONFIRMED')
  const [imageData, setImageData] = useState<string>('')
  const [pin, setPin] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [qrToken, setQrToken] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [gpsLat, setGpsLat] = useState<number | undefined>()
  const [gpsLng, setGpsLng] = useState<number | undefined>()
  const pinRef = useRef<HTMLInputElement>(null)

  // Request GPS once on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsLat(pos.coords.latitude)
          setGpsLng(pos.coords.longitude)
        },
        () => {}
      )
    }
  }, [])

  // Generate QR token when QR method is selected
  useEffect(() => {
    if (step !== 'qr') return

    async function fetchToken() {
      const res = await fetch(`/api/documents/${documentId}/signatures/qr-token`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error generando QR')
        return
      }
      setQrToken(data.token)
      const url = `${window.location.origin}/sign?token=${encodeURIComponent(data.token)}`
      const dataUrl = await QRCode.toDataURL(url, {
        width: 220,
        margin: 2,
        color: { dark: '#e5e7eb', light: '#111827' },
      })
      setQrDataUrl(dataUrl)
    }

    fetchToken()
  }, [step, documentId])

  function selectMethod(m: ModalMethod) {
    setMethod(m)
    setStep(m === 'CANVAS' ? 'canvas' : m === 'PIN' ? 'pin' : m === 'QR' ? 'qr' : 'confirm')
    setTimeout(() => pinRef.current?.focus(), 50)
  }

  async function submit() {
    setStep('submitting')
    setError(null)

    const body: Record<string, unknown> = { method, gpsLat, gpsLng }
    if (method === 'CANVAS') body.imageData = imageData
    if (method === 'PIN') body.pin = pin
    if (method === 'QR') body.qrToken = qrToken

    try {
      const res = await fetch(`/api/documents/${documentId}/signatures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al firmar')
      setStep('done')
      onSigned(data.signature as SavedSignature)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setStep('error')
    }
  }

  const canSubmit =
    (method === 'CANVAS' && imageData !== '') ||
    (method === 'PIN' && pin.length >= 4) ||
    (method === 'QR' && qrToken !== '') ||
    method === 'CONFIRMED'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-gray-950 border border-gray-800 rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-white">Firmar documento</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Method selection */}
          {step === 'select' && (
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(METHOD_LABELS) as ModalMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => selectMethod(m)}
                  className="flex flex-col items-center gap-2 p-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-amber-600 rounded-xl transition-all"
                >
                  <span className="text-2xl">{METHOD_ICONS[m]}</span>
                  <span className="text-sm font-medium text-gray-200">{METHOD_LABELS[m]}</span>
                </button>
              ))}
            </div>
          )}

          {/* Canvas */}
          {step === 'canvas' && (
            <>
              <p className="text-sm text-gray-400">Dibuje su firma en el recuadro:</p>
              <SignaturePad
                onCapture={setImageData}
                onClear={() => setImageData('')}
                height={140}
              />
            </>
          )}

          {/* PIN */}
          {step === 'pin' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">Ingrese su contraseña para confirmar identidad:</p>
              <input
                ref={pinRef}
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && canSubmit && submit()}
                placeholder="Contraseña"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {/* QR */}
          {step === 'qr' && (
            <div className="space-y-3 text-center">
              <p className="text-sm text-gray-400">
                Escanee el código QR con el teléfono del trabajador para confirmar su identidad:
              </p>
              {qrDataUrl ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-gray-900 p-3 rounded-xl inline-block">
                    <img src={qrDataUrl} alt="QR de firma" className="w-44 h-44" />
                  </div>
                  <p className="text-xs text-gray-500">Válido por 15 minutos</p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-44">
                  <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}

          {/* Confirm */}
          {step === 'confirm' && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center space-y-2">
              <p className="text-2xl">✅</p>
              <p className="text-sm text-gray-300">
                Al presionar <strong className="text-white">Firmar</strong>, confirmará su firma
                electrónica como usuario autenticado.
              </p>
              <p className="text-xs text-gray-500">
                Se registrará su identidad, IP, dispositivo y marca temporal.
              </p>
            </div>
          )}

          {/* Submitting */}
          {step === 'submitting' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Guardando firma…</p>
            </div>
          )}

          {/* Done */}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="text-4xl">✅</span>
              <p className="text-white font-semibold">Firma guardada</p>
              <p className="text-sm text-gray-400">
                El documento ha sido firmado correctamente.
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-6 py-2 bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold rounded-lg text-sm transition-colors"
              >
                Cerrar
              </button>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="space-y-3">
              <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-sm text-red-300">
                {error}
              </div>
              <button
                onClick={() => { setStep('select'); setError(null) }}
                className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm transition-colors"
              >
                Intentar de nuevo
              </button>
            </div>
          )}

          {/* Action buttons (non-terminal steps except select) */}
          {['canvas', 'pin', 'qr', 'confirm'].includes(step) && (
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setStep('select')}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
              >
                ← Cambiar método
              </button>
              <button
                onClick={submit}
                disabled={!canSubmit}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-gray-950 font-semibold rounded-xl text-sm transition-colors"
              >
                Firmar
              </button>
            </div>
          )}

          {/* GPS indicator */}
          {gpsLat && (
            <p className="text-xs text-gray-600 text-center">
              📍 GPS: {gpsLat.toFixed(4)}, {gpsLng?.toFixed(4)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
