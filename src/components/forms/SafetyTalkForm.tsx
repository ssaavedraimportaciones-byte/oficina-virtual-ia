'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { safetyTalkSchema, type SafetyTalkInput } from '@/schemas/forms/safety-talk'

interface Props {
  documentId: string
  defaultValues?: Partial<SafetyTalkInput>
  onSubmit: (data: SafetyTalkInput) => Promise<void>
}

export default function SafetyTalkForm({ documentId: _docId, defaultValues, onSubmit }: Props) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<SafetyTalkInput>({
    resolver: zodResolver(safetyTalkSchema),
    defaultValues: {
      participantes: [{ nombre: '', rut: '' }],
      riesgosTratados: [''],
      controlesTratados: [''],
      ...defaultValues,
    },
  })

  const participantes = useFieldArray({ control, name: 'participantes' })
  const riesgos = useFieldArray({ control, name: 'riesgosTratados' as never })
  const controles = useFieldArray({ control, name: 'controlesTratados' as never })

  const handleFormSubmit = async (data: SafetyTalkInput) => {
    try {
      await onSubmit(data)
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Error al guardar' })
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Empresa" error={errors.empresa?.message}>
          <input {...register('empresa')} placeholder="Nombre de la empresa" className={inputCls} />
        </Field>
        <Field label="Área" error={errors.area?.message}>
          <input {...register('area')} placeholder="Ej: Planta Norte" className={inputCls} />
        </Field>
        <Field label="Fecha" error={errors.fecha?.message}>
          <input type="date" {...register('fecha')} className={inputCls} />
        </Field>
        <Field label="Hora" error={errors.hora?.message}>
          <input type="time" {...register('hora')} className={inputCls} />
        </Field>
      </div>

      <Field label="Tema de la charla" error={errors.tema?.message}>
        <input {...register('tema')} placeholder="Tema principal tratado" className={inputCls} />
      </Field>

      <Field label="Relator" error={errors.relator?.message}>
        <input {...register('relator')} placeholder="Nombre completo del relator" className={inputCls} />
      </Field>

      <section>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">Participantes</label>
          <button
            type="button"
            onClick={() => participantes.append({ nombre: '', rut: '' })}
            className="text-xs text-amber-400 hover:underline"
          >
            + Agregar
          </button>
        </div>
        <div className="space-y-2">
          {participantes.fields.map((f, i) => (
            <div key={f.id} className="flex gap-2">
              <input
                {...register(`participantes.${i}.nombre`)}
                placeholder="Nombre"
                className={`${inputCls} flex-1`}
              />
              <input
                {...register(`participantes.${i}.rut`)}
                placeholder="RUT"
                className={`${inputCls} w-32`}
              />
              {participantes.fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => participantes.remove(i)}
                  className="text-red-500 hover:text-red-400 text-sm px-1"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        {errors.participantes?.root && (
          <p className="mt-1 text-xs text-red-400">{errors.participantes.root.message}</p>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">Riesgos tratados</label>
          <button
            type="button"
            onClick={() => (riesgos as unknown as ReturnType<typeof useFieldArray>).append('')}
            className="text-xs text-amber-400 hover:underline"
          >
            + Agregar
          </button>
        </div>
        <div className="space-y-2">
          {riesgos.fields.map((f, i) => (
            <div key={f.id} className="flex gap-2">
              <input
                {...register(`riesgosTratados.${i}` as never)}
                placeholder="Ej: Caída a distinto nivel"
                className={`${inputCls} flex-1`}
              />
              {riesgos.fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => riesgos.remove(i)}
                  className="text-red-500 hover:text-red-400 text-sm px-1"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">Controles tratados</label>
          <button
            type="button"
            onClick={() => (controles as unknown as ReturnType<typeof useFieldArray>).append('')}
            className="text-xs text-amber-400 hover:underline"
          >
            + Agregar
          </button>
        </div>
        <div className="space-y-2">
          {controles.fields.map((f, i) => (
            <div key={f.id} className="flex gap-2">
              <input
                {...register(`controlesTratados.${i}` as never)}
                placeholder="Ej: Uso de arnés certificado"
                className={`${inputCls} flex-1`}
              />
              {controles.fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => controles.remove(i)}
                  className="text-red-500 hover:text-red-400 text-sm px-1"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <Field label="Observaciones" error={errors.observaciones?.message}>
        <textarea
          {...register('observaciones')}
          rows={3}
          placeholder="Observaciones adicionales (opcional)"
          className={`${inputCls} resize-none`}
        />
      </Field>

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
        {isSubmitting ? 'Guardando...' : 'Guardar Charla de Seguridad'}
      </button>
    </form>
  )
}

const inputCls =
  'w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm'

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}
