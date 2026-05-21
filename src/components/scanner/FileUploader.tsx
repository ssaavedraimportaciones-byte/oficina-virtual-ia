'use client'

import { useRef, useState } from 'react'

const ACCEPTED = [
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/heic',
  'image/webp',
  'application/pdf',
]
const ACCEPTED_EXT = '.jpg,.jpeg,.png,.tiff,.tif,.heic,.webp,.pdf'
const MAX_MB = 50

interface Props {
  onFileSelected: (file: File) => void
  disabled?: boolean
}

export default function FileUploader({ onFileSelected, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function validate(file: File): string | null {
    if (!ACCEPTED.includes(file.type)) {
      return `Formato no permitido. Acepta: JPG, PNG, TIFF, HEIC, WebP, PDF`
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      return `El archivo supera el límite de ${MAX_MB} MB`
    }
    return null
  }

  function processFile(file: File) {
    const validationError = validate(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setFileName(file.name)

    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setPreview(null)
    }

    onFileSelected(file)
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          disabled
            ? 'border-gray-700 cursor-not-allowed opacity-50'
            : dragging
            ? 'border-amber-500 bg-amber-500/5'
            : 'border-gray-700 hover:border-gray-500 hover:bg-gray-800/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXT}
          className="hidden"
          onChange={onInputChange}
          disabled={disabled}
        />

        {preview ? (
          <div className="space-y-2">
            <img
              src={preview}
              alt="Vista previa"
              className="max-h-48 mx-auto rounded-lg object-contain"
            />
            <p className="text-sm text-gray-400">{fileName}</p>
            <p className="text-xs text-amber-400 hover:underline">Cambiar archivo</p>
          </div>
        ) : fileName ? (
          <div className="space-y-2">
            <div className="w-12 h-12 mx-auto bg-red-900/50 rounded-xl flex items-center justify-center">
              <span className="text-2xl">📄</span>
            </div>
            <p className="text-sm text-gray-300">{fileName}</p>
            <p className="text-xs text-amber-400 hover:underline">Cambiar archivo</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-14 h-14 mx-auto bg-gray-800 rounded-2xl flex items-center justify-center">
              <span className="text-3xl">📁</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-300">
                Arrastra un archivo o{' '}
                <span className="text-amber-400">selecciona desde tu dispositivo</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                JPG, PNG, TIFF, HEIC, WebP, PDF — máx {MAX_MB} MB
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
