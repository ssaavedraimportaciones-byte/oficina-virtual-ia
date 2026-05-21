import { z } from 'zod'

const PERMIT_TYPES = [
  'TRABAJO_EN_CALIENTE',
  'TRABAJO_EN_ALTURA',
  'ESPACIO_CONFINADO',
  'TRABAJO_ELECTRICO',
  'EXCAVACION',
  'IZAJE_CRITICO',
  'OTRO',
] as const

const autorizadorSchema = z.object({
  nombre: z.string().min(2, 'Nombre del autorizador requerido'),
  cargo: z.string().min(2, 'Cargo requerido'),
  firma: z.boolean().default(false),
})

export const workPermitSchema = z.object({
  tipoPermiso: z.enum(PERMIT_TYPES, { errorMap: () => ({ message: 'Tipo de permiso inválido' }) }),
  tarea: z.string().min(5, 'Descripción de la tarea requerida'),
  area: z.string().min(2, 'Área requerida'),
  responsable: z.string().min(2, 'Responsable requerido'),
  vigenciaDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Fecha/hora inválida'),
  vigenciaHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Fecha/hora inválida'),
  controlesObligatorios: z
    .array(z.string().min(2))
    .min(1, 'Debe especificar al menos un control obligatorio'),
  autorizadores: z
    .array(autorizadorSchema)
    .min(1, 'Debe haber al menos un autorizador'),
})

export type WorkPermitInput = z.infer<typeof workPermitSchema>
export const PERMIT_TYPE_OPTIONS = PERMIT_TYPES
