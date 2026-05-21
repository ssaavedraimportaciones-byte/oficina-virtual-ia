import { prisma } from '@/lib/db/client'
import type { AuditAccion } from '@/types/audit'

export interface AuditCtx {
  userId: string
  userEmail: string
  userRole: string
  ip: string
  userAgent: string
  gpsLat?: number
  gpsLng?: number
}

// sc: append-only — nunca llamar UPDATE/DELETE en audit_logs
export async function log(
  ctx: AuditCtx,
  accion: AuditAccion,
  opts: { documentId?: string; documentTipo?: string; antes?: unknown; despues?: unknown; metadata?: unknown } = {}
) {
  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      userRole: ctx.userRole,
      accion,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      gpsLat: ctx.gpsLat,
      gpsLng: ctx.gpsLng,
      documentId: opts.documentId,
      documentTipo: opts.documentTipo,
      antes: opts.antes !== undefined ? (opts.antes as object) : undefined,
      despues: opts.despues !== undefined ? (opts.despues as object) : undefined,
      metadata: opts.metadata !== undefined ? (opts.metadata as object) : undefined,
    },
  })
}
