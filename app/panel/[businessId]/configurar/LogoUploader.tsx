'use client'

import { useState } from 'react'
import { resizeForUpload } from '@/lib/imageResize'

/**
 * Logo del negocio: mismo patrón que la foto de un producto en Catálogo y
 * pedidos. Se muestra donde hoy va el emoji del rubro (menú del negocio,
 * lista de "Tus negocios") apenas se sube.
 */
export default function LogoUploader({
  businessId,
  emoji,
  logoVersion,
  onChange,
}: {
  businessId: string
  emoji: string
  logoVersion: number | null
  onChange: (version: number | null) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    setUploading(true)
    setError(null)
    try {
      const resized = await resizeForUpload(file)
      const form = new FormData()
      form.append('file', resized, 'logo')
      const res = await fetch(`/api/businesses/${businessId}/logo`, { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'No se pudo subir el logo.')
        return
      }
      onChange(data.logoVersion ?? Date.now())
    } catch {
      setError('No se pudo procesar la imagen.')
    } finally {
      setUploading(false)
    }
  }

  async function remove() {
    setUploading(true)
    await fetch(`/api/businesses/${businessId}/logo`, { method: 'DELETE' })
    setUploading(false)
    onChange(null)
  }

  return (
    <div className="flex items-center gap-4 rounded-lg border border-gray-800 p-5">
      <label
        title={logoVersion ? 'Cambiar logo' : 'Subir logo'}
        className="relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-gray-700 text-2xl hover:border-amber-500"
      >
        {logoVersion ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/imagenes/negocio/${businessId}?v=${logoVersion}`}
            alt="Logo del negocio"
            className="h-full w-full object-cover"
          />
        ) : (
          <span aria-hidden="true">{emoji}</span>
        )}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-gray-950/70 text-[9px] text-white">
            Subiendo…
          </span>
        )}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) upload(file)
          }}
        />
      </label>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">Logo del negocio</p>
        <p className="mt-0.5 text-xs text-gray-500">
          Se muestra en tu panel. Sin uno, usamos el emoji de tu rubro.
        </p>
        {logoVersion && (
          <button
            type="button"
            onClick={remove}
            disabled={uploading}
            className="mt-1.5 text-xs text-gray-500 hover:text-danger disabled:opacity-50"
          >
            Quitar logo
          </button>
        )}
        {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
      </div>
    </div>
  )
}
