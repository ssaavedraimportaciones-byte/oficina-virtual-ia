export type AuditAccion =
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'SIGN'
  | 'APPROVE'
  | 'REJECT'
  | 'STAMP'
  | 'ARCHIVE'
  | 'REVERT'
  | 'LOGIN'
  | 'LOGOUT'
  | 'DELETE_ATTEMPT'
  | 'ACCESS_DENIED'

export interface AuditLog {
  id: string
  timestamp: string
  userId: string
  userEmail: string
  userRole: string
  accion: AuditAccion
  documentId: string | null
  documentTipo: string | null
  ip: string
  userAgent: string
  gps: { lat: number; lng: number; precision: number } | null
  antes: Record<string, unknown> | null
  despues: Record<string, unknown> | null
  metadata: Record<string, unknown>
}
