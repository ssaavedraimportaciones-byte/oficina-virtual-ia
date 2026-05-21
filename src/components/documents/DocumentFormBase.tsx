'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { z } from 'zod'

export const documentBaseSchema = z.object({
  type: z.enum([
    'SAFETY_TALK', 'DET', 'ART', 'AST', 'WORK_PERMIT',
    'LOTO', 'HEIGHT_WORK', 'CONFINED_SPACE', 'LIFTING_PLAN',
    'EQUIPMENT_CHECKLIST', 'OTHER',
  ]),
  taskName: z.string().min(3, 'Nombre de tarea requerido'),
  workArea: z.string().min(2, 'Área de trabajo requerida'),
  supervisorId: z.string().cuid().optional().or(z.literal('')),
  saveDraft: z.boolean().optional(),
})

export type DocumentBaseInput = z.infer<typeof documentBaseSchema>

const TYPE_OPTIONS = [
  { value: 'SAFETY_TALK',       label: 'Charla de Seguridad' },
  { value: 'DET',               label: 'DET' },
  { value: 'ART',               label: 'ART' },
  { value: 'AST',               label: 'AST' },
  { value: 'WORK_PERMIT',       label: 'Permiso de Trabajo' },
  { value: 'LOTO',              label: 'LOTO' },
  { value: 'HEIGHT_WORK',       label: 'Trabajo en Altura' },
  { value: 'CONFINED_SPACE',    label: 'Espacio Confinado' },
  { value: 'LIFTING_PLAN',      label: 'Plan de Izaje' },
  { value: 'EQUIPMENT_CHECKLIST', label: 'Checklist Equipos' },
  { value: 'OTHER',             label: 'Otro' },
]

interface Props {
  defaultValues?: Partial<DocumentBaseInput>
  onSuccess?: (docId: string) => void
}

export default function DocumentFormBase({ defaultValues, onSuccess }: Props) {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<DocumentBaseInput>({
    resolver: zodResolver(documentBaseSchema),
    defaultValues: { type: 'SAFETY_TALK', saveDraft: false, ...defaultValues },
  })

  const onSubmit = async (data: DocumentBaseInput) => {
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al crear documento')
      if (onSuccess) {
        onSuccess(json.document.id)
      } else {
        router.push(`/documents/${json.document.id}`)
      }
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : 'Error al guardar',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Tipo de documento <span className="text-red-400">*</span>
        </label>
        <select
          {...register('type')}
          className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {errors.type && <p className="mt-1 text-xs text-red-400">{errors.type.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Nombre de la tarea <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          {...register('taskName')}
          placeholder="Ej: Mantención bomba sector norte"
          className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        {errors.taskName && (
          <p className="mt-1 text-xs text-red-400">{errors.taskName.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Área de trabajo <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          {...register('workArea')}
          placeholder="Ej: Planta concentradora, nivel -200"
          className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        {errors.workArea && (
          <p className="mt-1 text-xs text-red-400">{errors.workArea.message}</p>
        )}
      </div>

      {errors.root && (
        <div className="bg-red-950 border border-red-800 rounded-lg px-3 py-2">
          <p className="text-sm text-red-400">{errors.root.message}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => {
            const form = document.querySelector('form')
            if (form) {
              const input = form.querySelector<HTMLInputElement>('[name=saveDraft]')
              if (input) input.value = 'true'
            }
            handleSubmit((data) => onSubmit({ ...data, saveDraft: true }))()
          }}
          disabled={isSubmitting}
          className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 font-medium rounded-lg py-2.5 transition-colors"
        >
          Guardar borrador
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 font-semibold rounded-lg py-2.5 transition-colors"
        >
          {isSubmitting ? 'Guardando...' : 'Crear documento'}
        </button>
      </div>
    </form>
  )
}
