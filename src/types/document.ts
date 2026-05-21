export type DocumentTipo =
  | 'CHARLA' | 'DET' | 'ART' | 'AST' | 'PERMISO'
  | 'LOTO' | 'ALTURA' | 'IZAJE' | 'ESPACIO_CONFINADO'

export type DocumentEstado =
  | 'BORRADOR' | 'COMPLETADO' | 'FIRMADO' | 'PENDIENTE_APROBACION'
  | 'APROBADO' | 'RECHAZADO' | 'TIMBRADO' | 'ARCHIVADO'

export interface GpsData {
  lat: number
  lng: number
  precision: number
  status: 'disponible' | 'denegado' | 'no_soportado' | 'timeout'
}

export interface DocumentTypeConfig {
  label: string
  descripcion: string
  requiereGps: boolean
  aprobacionesRequeridas: number
  camposRequeridos: string[]
}
