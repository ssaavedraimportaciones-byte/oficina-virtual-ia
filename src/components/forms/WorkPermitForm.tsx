'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { workPermitSchema, type WorkPermitInput, PERMIT_TYPE_OPTIONS } from '@/schemas/forms/work-permit'

interface Props {
  documentId: string
  defaultValues?: Partial<WorkPermitInput>
  onSubmit: (data: WorkPermitInput) => Promise<void>
}

const inputCls =
  'w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm'

const PERMIT_LABELS: Record<string, string> = {
  TRABAJO_EN_CALIENTE:  'Trabajo en Caliente',
  TRABAJO_EN_ALTURA:    'Trabajo en Altura',
  ESPACIO_CONFINADO:    'Espacio Confinado',
  TRABAJO_ELECTRICO:    'Trabajo Eléctrico',
  EXCAVACION:           'Excavación',
  IZAJE_CRITICO:        'Izaje Crítico',
  OTRO:                 'Otro',
}

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

export default function WorkPermitForm({ documentId: _docId, defaultValues, onSubmit }: Props) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<WorkPermitInput>({
    resolver: zodResolver(workPermitSchema),
    defaultValues: {
      controlesObligatorios: [''],
      autorizadores: [{ nombre: '', cargo: '', firma: false }],
      ...defaultValues,
    },
  })

  const controles = useFieldArray({ control, name: 'controlesObligatorios' as never })
  const autorizadores = useFieldArray({ control, name: 'autorizadores' })

  const handleFormSubmit = async (data: WorkPermitInput) => {
    try {
      await onSubmit(data)
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Error al guardar' })
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Tipo de permiso" error={errors.tipoPermiso?.message}>
          <select {...register('tipoPermiso')} className={inputCls}>
            <option value="">Seleccionar tipo</option>
            {PERMIT_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {PERMIT_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Responsable" error={errors.responsable?.message}>
          <input
            {...register('responsable')}
            placeholder="Nombre del responsable"
            className={inputCls}
          />
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

      <Field label="Área de trabajo" error={errors.area?.message}>
        <input {...register('area')} placeholder="Ej: Subestación eléctrica, nivel -100" className={inputCls} />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Vigencia desde" error={errors.vigenciaDesde?.message}>
          <input type="datetime-local" {...register('vigenciaDesde')} className={inputCls} />
        </Field>
        <Field label="Vigencia hasta" error={errors.vigenciaHasta?.message}>
          <input type="datetime-local" {...register('vigenciaHasta')} className={inputCls} />
        </Field>
      </div>

      <section>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">Controles obligatorios</label>
          <button
            type="button"
            onClick={() => (controles as ReturnType<typeof useFieldArray>).append('')}
            className="text-xs text-amber-400 hover:underline"
          >
            + Agregar
          </button>
        </div>
        <div className="space-y-2">
          {controles.fields.map((f, i) => (
            <div key={f.id} className="flex gap-2">
              <input
                {...register(`controlesObligatorios.${i}` as never)}
                placeholder="Ej: Bloqueo LOTO, verificar atmósfera, etc."
                className={`${inputCls} flex-1`}
              />
              {controles.fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => controles.remove(i)}
                  className="text-red-500 text-sm px-1"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        {errors.controlesObligatorios?.root && (
          <p className="mt-1 text-xs text-red-400">
            {errors.controlesObligatorios.root.message}
          </p>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">Autorizadores</label>
          <button
            type="button"
            onClick={() => autorizadores.append({ nombre: '', cargo: '', firma: false })}
            className="text-xs text-amber-400 hover:underline"
          >
            + Agregar
          </button>
        </div>
        <div className="space-y-3">
          {autorizadores.fields.map((a, i) => (
            <div key={a.id} className="flex gap-2 items-start">
              <input
                {...register(`autorizadores.${i}.nombre`)}
                placeholder="Nombre"
                className={`${inputCls} flex-1`}
              />
              <input
                {...register(`autorizadores.${i}.cargo`)}
                placeholder="Cargo"
                className={`${inputCls} flex-1`}
              />
              <label className="flex items-center gap-1 pt-2 cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  {...register(`autorizadores.${i}.firma`)}
                  className="w-4 h-4 accent-amber-500"
                />
                <span className="text-xs text-gray-400">Firmado</span>
              </label>
              {autorizadores.fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => autorizadores.remove(i)}
                  className="text-red-500 text-sm pt-2"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

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
        {isSubmitting ? 'Guardando...' : 'Guardar Permiso de Trabajo'}
      </button>
    </form>
  )
}
