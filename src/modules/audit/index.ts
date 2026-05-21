import { prisma } from '@/lib/db/client'

export interface AuditCtx {
  userId: string
  ip?: string
  userAgent?: string
  gpsLat?: number
  gpsLng?: number
}

export async function log(
  ctx: AuditCtx,
  action: string,
  opts: {
    documentId?: string
    metadata?: unknown
  } = {}
) {
  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      action,
      ipAddress: ctx.ip,
      deviceInfo: ctx.userAgent ? { userAgent: ctx.userAgent } : undefined,
      gpsLat: ctx.gpsLat,
      gpsLng: ctx.gpsLng,
      documentId: opts.documentId,
      metadata: opts.metadata !== undefined ? (opts.metadata as object) : undefined,
    },
  })
}
