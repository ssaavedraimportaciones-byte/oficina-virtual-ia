export type DocumentTipo =
  | 'CHARLA'
  | 'DET'
  | 'ART'
  | 'AST'
  | 'PERMISO'
  | 'LOTO'
  | 'ALTURA'
  | 'IZAJE'
  | 'ESPACIO_CONFINADO'

export type DocumentEstado =
  | 'borrador'
  | 'completado'
  | 'firmado'
  | 'pendiente_aprobacion'
  | 'aprobado'
  | 'rechazado'
  | 'timbrado'
  | 'archivado'

export interface GpsData {
  lat: number
  lng: number
  precision: number
  status: 'disponible' | 'denegado' | 'no_soportado' | 'timeout'
}

export interface SafeDocument {
  id: string
  tipo: DocumentTipo
  version: number
  estado: DocumentEstado
  estadoAnterior: DocumentEstado | null
  faena: string
  area: string
  fecha_trabajo: string
  createdBy: string
  createdByNombre: string
  campos: Record<string, unknown>
  participantes: string[]
  firmasRequeridas: string[]
  firmasCompletadas: string[]
  aprobacionesRequeridas: number
  aprobacionesCompletadas: number
  timbreId: string | null
  createdAt: string
  updatedAt: string
}

export interface Signature {
  id: string
  documentId: string
  userId: string
  userName: string
  userRut: string
  userRole: string
  firma_base64: string
  hash_documento: string
  firmadoAt: string
  ip: string
  userAgent: string
  gps: GpsData | null
}

export interface Approval {
  id: string
  documentId: string
  nivel: 1 | 2 | 3
  aprobadorId: string
  aprobadorNombre: string
  aprobadorRole: string
  decision: 'aprobado' | 'rechazado'
  comentario: string
  timestamp: string
  ip: string
  gps: GpsData | null
}

export interface Stamp {
  id: string
  documentId: string
  numero_timbre: string
  hash_final: string
  generadoPor: string
  timestamp: string
  ip: string
}
