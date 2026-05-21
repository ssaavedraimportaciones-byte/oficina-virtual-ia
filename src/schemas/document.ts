import { z } from 'zod'

const TIPOS = ['CHARLA', 'DET', 'ART', 'AST', 'PERMISO', 'LOTO', 'ALTURA', 'IZAJE', 'ESPACIO_CONFINADO'] as const
const ESTADOS = ['BORRADOR', 'COMPLETADO', 'FIRMADO', 'PENDIENTE_APROBACION', 'APROBADO', 'RECHAZADO', 'TIMBRADO', 'ARCHIVADO'] as const

export const crearDocumentoSchema = z.object({
  tipo: z.enum(TIPOS),
  faenaId: z.string().min(1, 'Faena requerida'),
  area: z.string().min(1, 'Área requerida'),
  fechaTrabajo: z.string().min(1, 'Fecha requerida'),
  campos: z.record(z.unknown()),
  participantesIds: z.array(z.string()).default([]),
})

export const actualizarEstadoSchema = z.object({
  estado: z.enum(ESTADOS),
})

export const firmaSchema = z.object({
  documentId: z.string().min(1),
  firmaBase64: z.string().min(1),
  gps: z.object({
    lat: z.number(),
    lng: z.number(),
    precision: z.number(),
    status: z.enum(['disponible', 'denegado', 'no_soportado', 'timeout']),
  }).nullable().optional(),
})

export const aprobacionSchema = z.object({
  documentId: z.string().min(1),
  decision: z.enum(['aprobado', 'rechazado']),
  comentario: z.string().optional().default(''),
  gps: z.object({
    lat: z.number(),
    lng: z.number(),
    precision: z.number(),
    status: z.enum(['disponible', 'denegado', 'no_soportado', 'timeout']),
  }).nullable().optional(),
})

export type CrearDocumentoInput = z.infer<typeof crearDocumentoSchema>
export type ActualizarEstadoInput = z.infer<typeof actualizarEstadoSchema>
export type FirmaInput = z.infer<typeof firmaSchema>
export type AprobacionInput = z.infer<typeof aprobacionSchema>
