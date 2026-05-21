'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { detSchema, type DETInput } from '@/schemas/forms/det'

interface Props {
  documentId: string
  defaultValues?: Partial<DETInput>
  onSubmit: (data: DETInput) => Promise<void>
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

export default function DETForm({ documentId: _docId, defaultValues, onSubmit }: Props) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<DETInput>({
    resolver: zodResolver(detSchema),
    defaultValues: {
      pasosDelTrabajo: [{ descripcion: '', riesgos: [''], controles: [''] }],
      trabajadores: [{ nombre: '', rut: '' }],
      ...defaultValues,
    },
  })

  const pasos = useFieldArray({ control, name: 'pasosDelTrabajo' })
  const trabajadores = useFieldArray({ control, name: 'trabajadores' })

  const handleFormSubmit = async (data: DETInput) => {
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
          <input {...register('area')} placeholder="Área de trabajo" className={inputCls} />
        </Field>
        <Field label="Fecha" error={errors.fecha?.message}>
          <input type="date" {...register('fecha')} className={inputCls} />
        </Field>
      </div>

      <Field label="Descripción de la tarea" error={errors.tarea?.message}>
        <textarea
          {...register('tarea')}
          rows={2}
          placeholder="Describa la tarea a realizar"
          className={`${inputCls} resize-none`}
        />
      </Field>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-300">Pasos del trabajo</h3>
          <button
            type="button"
            onClick={() => pasos.append({ descripcion: '', riesgos: [''], controles: [''] })}
            className="text-xs text-amber-400 hover:underline"
          >
            + Agregar paso
          </button>
        </div>

        <div className="space-y-4">
          {pasos.fields.map((paso, i) => (
            <div key={paso.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
                  Paso {i + 1}
                </span>
                {pasos.fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => pasos.remove(i)}
                    className="text-xs text-red-500 hover:text-red-400"
                  >
                    Eliminar
                  </button>
                )}
              </div>

              <Field
                label="Descripción del paso"
                error={errors.pasosDelTrabajo?.[i]?.descripcion?.message}
              >
                <input
                  {...register(`pasosDelTrabajo.${i}.descripcion`)}
                  placeholder="Ej: Bloqueo y etiquetado de energía"
                  className={inputCls}
                />
              </Field>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Riesgos asociados
                  </label>
                  <input
                    {...register(`pasosDelTrabajo.${i}.riesgos.0`)}
                    placeholder="Riesgo principal"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Controles
                  </label>
                  <input
                    {...register(`pasosDelTrabajo.${i}.controles.0`)}
                    placeholder="Control aplicado"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Responsable" error={errors.responsable?.message}>
          <input {...register('responsable')} placeholder="Nombre del responsable" className={inputCls} />
        </Field>
        <Field label="Supervisor" error={errors.supervisor?.message}>
          <input {...register('supervisor')} placeholder="Nombre del supervisor" className={inputCls} />
        </Field>
      </div>

      <section>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">Trabajadores</label>
          <button
            type="button"
            onClick={() => trabajadores.append({ nombre: '', rut: '' })}
            className="text-xs text-amber-400 hover:underline"
          >
            + Agregar
          </button>
        </div>
        <div className="space-y-2">
          {trabajadores.fields.map((t, i) => (
            <div key={t.id} className="flex gap-2">
              <input
                {...register(`trabajadores.${i}.nombre`)}
                placeholder="Nombre"
                className={`${inputCls} flex-1`}
              />
              <input
                {...register(`trabajadores.${i}.rut`)}
                placeholder="RUT"
                className={`${inputCls} w-32`}
              />
              {trabajadores.fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => trabajadores.remove(i)}
                  className="text-red-500 text-sm px-1"
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
          rows={2}
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
        {isSubmitting ? 'Guardando...' : 'Guardar DET'}
      </button>
    </form>
  )
}
