import { getDb } from './firebase-admin'
import type { AuditAccion, AuditLog } from '@/types/audit'

export interface AuditContext {
  userId: string
  userEmail: string
  userRole: string
  ip: string
  userAgent: string
  gps?: { lat: number; lng: number; precision: number } | null
}

export interface AuditEntry {
  accion: AuditAccion
  documentId?: string | null
  documentTipo?: string | null
  antes?: Record<string, unknown> | null
  despues?: Record<string, unknown> | null
  metadata?: Record<string, unknown>
}

// sc_audit_log es append-only.
// Firestore Security Rules deben denegar UPDATE y DELETE en esta colección.
export async function registrarAuditoria(
  ctx: AuditContext,
  entry: AuditEntry
): Promise<void> {
  const db = getDb()
  const log: Omit<AuditLog, 'id'> = {
    timestamp: new Date().toISOString(),
    userId: ctx.userId,
    userEmail: ctx.userEmail,
    userRole: ctx.userRole,
    accion: entry.accion,
    documentId: entry.documentId ?? null,
    documentTipo: entry.documentTipo ?? null,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    gps: ctx.gps ?? null,
    antes: entry.antes ?? null,
    despues: entry.despues ?? null,
    metadata: entry.metadata ?? {},
  }
  await db.collection('sc_audit_log').add(log)
}
