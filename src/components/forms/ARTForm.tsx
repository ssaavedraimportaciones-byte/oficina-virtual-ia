'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { artSchema, type ARTInput } from '@/schemas/forms/art'

interface Props {
  documentId: string
  defaultValues?: Partial<ARTInput>
  onSubmit: (data: ARTInput) => Promise<void>
}

const inputCls =
  'w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm'

export default function ARTForm({ documentId: _docId, defaultValues, onSubmit }: Props) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ARTInput>({
    resolver: zodResolver(artSchema),
    defaultValues: {
      items: [
        {
          actividad: '',
          peligro: '',
          riesgo: '',
          consecuencia: '',
          control: '',
          responsable: '',
          validado: false,
        },
      ],
      ...defaultValues,
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const handleFormSubmit = async (data: ARTInput) => {
    try {
      await onSubmit(data)
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Error al guardar' })
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">
          Actividades / Peligros / Controles
        </h3>
        <button
          type="button"
          onClick={() =>
            append({
              actividad: '',
              peligro: '',
              riesgo: '',
              consecuencia: '',
              control: '',
              responsable: '',
              validado: false,
            })
          }
          className="text-xs text-amber-400 hover:underline"
        >
          + Agregar actividad
        </button>
      </div>

      <div className="space-y-4">
        {fields.map((field, i) => (
          <div
            key={field.id}
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
                Actividad {i + 1}
              </span>
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-xs text-red-500 hover:text-red-400"
                >
                  Eliminar
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Actividad</label>
                <input
                  {...register(`items.${i}.actividad`)}
                  placeholder="Ej: Corte con amoladora"
                  className={inputCls}
                />
                {errors.items?.[i]?.actividad && (
                  <p className="mt-0.5 text-xs text-red-400">
                    {errors.items[i]?.actividad?.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Peligro</label>
                <input
                  {...register(`items.${i}.peligro`)}
                  placeholder="Ej: Chispa / proyección de partículas"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Riesgo</label>
                <input
                  {...register(`items.${i}.riesgo`)}
                  placeholder="Ej: Incendio / quemadura"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Consecuencia</label>
                <input
                  {...register(`items.${i}.consecuencia`)}
                  placeholder="Ej: Quemadura de 2° grado"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Medida de control
                </label>
                <input
                  {...register(`items.${i}.control`)}
                  placeholder="Ej: Uso de careta y guantes"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Responsable del control
                </label>
                <input
                  {...register(`items.${i}.responsable`)}
                  placeholder="Nombre del responsable"
                  className={inputCls}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                {...register(`items.${i}.validado`)}
                className="w-4 h-4 accent-amber-500"
              />
              <span className="text-sm text-gray-300">Control validado en terreno</span>
            </label>
          </div>
        ))}
      </div>

      {errors.root && (
        <div className="bg-red-950 border border-red-800 rounded-lg px-3 py-2">
          <p className="text-sm text-red-400">{errors.root.message}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 font-semibold rounded-lg py-2.5 transition-colors"
      >
        {isSubmitting ? 'Guardando...' : 'Guardar ART'}
      </button>
    </form>
  )
}
