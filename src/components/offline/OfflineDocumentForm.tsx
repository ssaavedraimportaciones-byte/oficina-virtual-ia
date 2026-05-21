'use client'

import { useCallback, useRef, useState } from 'react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { saveLocalDraft, saveLocalSignature, saveLocalPhoto } from '@/modules/offline/saveLocalDraft'
import { queueOfflineAction } from '@/modules/offline/queueOfflineAction'
import { syncPendingActions } from '@/modules/offline/syncPendingActions'
import { isSupported } from '@/modules/offline/db'
import type { DocumentType } from '@/types/document'
import type { LocalDraft } from '@/modules/offline'

const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'SAFETY_TALK',        label: 'Charla de Seguridad' },
  { value: 'ART',                label: 'ART' },
  { value: 'AST',                label: 'AST' },
  { value: 'DET',                label: 'DET' },
  { value: 'WORK_PERMIT',        label: 'Permiso de Trabajo' },
  { value: 'HEIGHT_WORK',        label: 'Trabajo en Altura' },
  { value: 'LOTO',               label: 'LOTO' },
  { value: 'CONFINED_SPACE',     label: 'Espacio Confinado' },
  { value: 'LIFTING_PLAN',       label: 'Plan de Izaje' },
  { value: 'EQUIPMENT_CHECKLIST',label: 'Checklist Equipos' },
  { value: 'OTHER',              label: 'Otro' },
]

interface Props {
  userId: string
  companyId: string
  onSaved?: (draft: LocalDraft) => void
}

type Step = 'form' | 'signature' | 'photos' | 'done'

export default function OfflineDocumentForm({ userId, companyId, onSaved }: Props) {
  const { isOnline } = useNetworkStatus()
  const [step, setStep] = useState<Step>('form')
  const [draft, setDraft] = useState<LocalDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [hasSig, setHasSig] = useState(false)

  // Form fields
  const [type, setType] = useState<DocumentType>('SAFETY_TALK')
  const [taskName, setTaskName] = useState('')
  const [workArea, setWorkArea] = useState('')

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  const inputCls = 'w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-600'
  const selectCls = 'w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-600 appearance-none'

  // ── Step 1: Save form ────────────────────────────────────────────────────────

  async function handleSaveForm(e: React.FormEvent) {
    e.preventDefault()
    if (!taskName.trim() || !workArea.trim()) return
    setSaving(true)
    setError(null)
    try {
      const saved = await saveLocalDraft({ type, taskName, workArea, companyId, createdById: userId })
      await queueOfflineAction({
        draftId: saved.id,
        type: 'CREATE_DOCUMENT',
        payload: { type, taskName, workArea },
      })
      setDraft(saved)
      setStep('signature')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar borrador')
    } finally {
      setSaving(false)
    }
  }

  // ── Step 2: Capture signature ─────────────────────────────────────────────

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#f59e0b'
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
    setHasSig(true)
  }

  function endDraw() { drawing.current = false }

  function clearSig() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    setHasSig(false)
  }

  async function handleSaveSignature() {
    if (!hasSig || !draft || !canvasRef.current) return
    setSaving(true)
    setError(null)
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png')
      const photo = await saveLocalSignature({ draftId: draft.id, imageDataUrl: dataUrl, signerName: userId, method: 'CANVAS' })
      await queueOfflineAction({
        draftId: draft.id,
        type: 'ADD_SIGNATURE',
        payload: { photoId: photo.id, method: 'CANVAS' },
      })
      setStep('photos')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar firma')
    } finally {
      setSaving(false)
    }
  }

  // ── Step 3: Capture photos ────────────────────────────────────────────────

  const handlePhotoCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !draft) return
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      try {
        const photo = await saveLocalPhoto({ draftId: draft.id, dataUrl, mimeType: file.type })
        await queueOfflineAction({
          draftId: draft.id,
          type: 'SAVE_PHOTO',
          payload: { photoId: photo.id },
        })
        setPhotos((p) => [...p, dataUrl])
      } catch {
        setError('Error al guardar foto')
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [draft])

  // ── Step 4: Sync or finish ────────────────────────────────────────────────

  async function handleFinish() {
    if (!draft) return
    onSaved?.(draft)

    if (!isOnline) {
      setStep('done')
      return
    }

    setSyncing(true)
    setError(null)
    try {
      await syncPendingActions()
      setStep('done')
    } catch (err) {
      setError('Documento guardado localmente. Se sincronizará al volver a conectar.')
      setStep('done')
    } finally {
      setSyncing(false)
    }
  }

  if (!isSupported()) {
    return (
      <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-sm text-red-300">
        Este navegador no soporta almacenamiento offline. Use Chrome, Edge o Safari actualizado.
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Offline indicator */}
      {!isOnline && (
        <div className="bg-red-950/60 border-b border-red-800 px-4 py-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-red-300">Modo offline — los datos se guardan localmente</span>
        </div>
      )}

      {/* Progress steps */}
      <div className="flex border-b border-gray-800">
        {(['form', 'signature', 'photos', 'done'] as Step[]).map((s, i) => {
          const labels = ['Datos', 'Firma', 'Evidencia', 'Listo']
          const active = step === s
          const done = ['form', 'signature', 'photos', 'done'].indexOf(step) > i
          return (
            <div key={s} className={`flex-1 py-2.5 text-center text-xs font-medium border-b-2 transition-colors ${
              active ? 'border-amber-500 text-amber-400' :
              done   ? 'border-green-700 text-green-600' :
                       'border-transparent text-gray-600'
            }`}>
              {done ? '✓ ' : `${i + 1}. `}{labels[i]}
            </div>
          )
        })}
      </div>

      <div className="p-5">
        {error && (
          <div className="mb-4 bg-orange-950 border border-orange-800 rounded-lg px-3 py-2.5 text-xs text-orange-300">
            {error}
          </div>
        )}

        {/* ── Step: Form ──────────────────────────────────────────────────── */}
        {step === 'form' && (
          <form onSubmit={handleSaveForm} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Tipo de documento</label>
              <select value={type} onChange={(e) => setType(e.target.value as DocumentType)} className={selectCls}>
                {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Tarea / Actividad *</label>
              <input
                required
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="Descripción de la tarea"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Faena / Área *</label>
              <input
                required
                value={workArea}
                onChange={(e) => setWorkArea(e.target.value)}
                placeholder="Nombre del área o faena"
                className={inputCls}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 font-semibold rounded-xl text-sm transition-colors"
            >
              {saving ? 'Guardando…' : 'Guardar y continuar →'}
            </button>
          </form>
        )}

        {/* ── Step: Signature ─────────────────────────────────────────────── */}
        {step === 'signature' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Dibuja tu firma en el área de abajo</p>
            <div className="rounded-xl border-2 border-dashed border-gray-700 bg-gray-950 overflow-hidden">
              <canvas
                ref={canvasRef}
                width={480}
                height={160}
                className="w-full touch-none cursor-crosshair"
                onPointerDown={startDraw}
                onPointerMove={draw}
                onPointerUp={endDraw}
                onPointerLeave={endDraw}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={clearSig}
                className="flex-1 py-2.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors"
              >
                Limpiar
              </button>
              <button
                onClick={handleSaveSignature}
                disabled={!hasSig || saving}
                className="flex-1 py-2.5 text-sm bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-gray-950 font-semibold rounded-xl transition-colors"
              >
                {saving ? 'Guardando…' : 'Guardar firma →'}
              </button>
            </div>
            <button
              onClick={() => setStep('photos')}
              className="w-full text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Omitir firma por ahora
            </button>
          </div>
        )}

        {/* ── Step: Photos ─────────────────────────────────────────────────── */}
        {step === 'photos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">Evidencia fotográfica (opcional)</p>
              <span className="text-xs text-gray-600">{photos.length} foto{photos.length !== 1 ? 's' : ''}</span>
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((src, i) => (
                  <img key={i} src={src} alt="" className="w-full aspect-square object-cover rounded-lg" />
                ))}
              </div>
            )}

            <label className="flex items-center justify-center gap-2 w-full py-8 border-2 border-dashed border-gray-700 rounded-xl cursor-pointer hover:border-amber-600 transition-colors">
              <span className="text-2xl">📷</span>
              <span className="text-sm text-gray-400">Tomar foto o seleccionar</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                className="sr-only"
              />
            </label>

            <button
              onClick={handleFinish}
              disabled={syncing}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 font-semibold rounded-xl text-sm transition-colors"
            >
              {syncing ? 'Sincronizando…' : isOnline ? 'Finalizar y sincronizar' : 'Finalizar (sin conexión)'}
            </button>
          </div>
        )}

        {/* ── Step: Done ───────────────────────────────────────────────────── */}
        {step === 'done' && (
          <div className="text-center py-6 space-y-3">
            <div className="text-5xl">{isOnline ? '✅' : '📋'}</div>
            <h3 className="text-lg font-semibold text-white">
              {isOnline ? 'Documento sincronizado' : 'Documento guardado localmente'}
            </h3>
            <p className="text-sm text-gray-400">
              {isOnline
                ? `Folio asignado: ${draft?.serverId ? '(ver documentos)' : draft?.folio}`
                : `Guardado con folio temporal ${draft?.folio}. Se sincronizará al recuperar conexión.`
              }
            </p>
            {!isOnline && (
              <div className="bg-amber-950/40 border border-amber-800/50 rounded-xl px-4 py-3 text-xs text-amber-300">
                El estado de sincronización aparece en la barra lateral. Cuando recuperes internet, el documento se subirá automáticamente.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
