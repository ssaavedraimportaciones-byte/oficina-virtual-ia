/**
 * Forensic audit module — append-only.
 *
 * Rules:
 *  - AuditLog records are never updated or deleted.
 *  - No update/delete methods are exported from this module.
 *  - SYSTEM_ADMIN: all companies, full deviceInfo.
 *  - AUDITOR: own company only, deviceInfo redacted.
 *  - All other roles: access denied at API layer.
 */
import { prisma } from '@/lib/db/client'
import type { AuditAction, AuditCtx, AuditLogEntry, QueryLogsParams } from './types'

export type { AuditAction, AuditCtx, AuditLogEntry, QueryLogsParams }
export type { AuditAction as AuditActionType }

// ── log() ─────────────────────────────────────────────────────────────────────
/**
 * Appends one immutable audit record.
 * Never throws — a failing audit write must not break the primary operation.
 */
export async function log(
  ctx: AuditCtx,
  action: AuditAction,
  opts: { documentId?: string; metadata?: unknown } = {}
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: ctx.userId,
        action,
        ipAddress: ctx.ip ?? null,
        deviceInfo: ctx.userAgent ? ({ userAgent: ctx.userAgent } as object) : undefined,
        gpsLat: ctx.gpsLat ?? null,
        gpsLng: ctx.gpsLng ?? null,
        documentId: opts.documentId ?? null,
        metadata: opts.metadata !== undefined ? (opts.metadata as object) : undefined,
      },
    })
  } catch (err) {
    // Never surface to caller — audit must not block primary operations
    console.error('[audit] log() failed:', action, err)
  }
}

// ── queryLogs() ───────────────────────────────────────────────────────────────
/**
 * Read-only filtered query.
 * SYSTEM_ADMIN: all companies, full deviceInfo.
 * AUDITOR: own company only, deviceInfo redacted.
 */
export async function queryLogs(
  params: QueryLogsParams
): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const {
    role, companyId, documentId, userId, action,
    dateFrom, dateTo, limit = 100, offset = 0,
  } = params

  const isAdmin   = role === 'SYSTEM_ADMIN'
  const isAuditor = role === 'AUDITOR'
  if (!isAdmin && !isAuditor) return { logs: [], total: 0 }

  const where: Record<string, unknown> = {}
  if (documentId) where.documentId = documentId
  if (userId)     where.userId     = userId
  if (action)     where.action     = action

  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo   ? { lte: new Date(dateTo + 'T23:59:59.999Z') } : {}),
    }
  }

  // AUDITOR scope: restrict to their company's documents
  if (!isAdmin) {
    where.OR = [
      { documentId: null },
      { document: { companyId } },
    ]
  }

  const [rawLogs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
      skip: offset,
      include: {
        user: { select: { name: true, email: true, role: true } },
        document: { select: { folio: true, type: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ])

  return {
    total,
    logs: rawLogs.map((r) => ({
      id: r.id,
      documentId: r.documentId,
      userId: r.userId,
      action: r.action,
      metadata: r.metadata as Record<string, unknown> | null,
      ipAddress: r.ipAddress,
      // Only SYSTEM_ADMIN receives full deviceInfo
      deviceInfo: isAdmin ? (r.deviceInfo as Record<string, unknown> | null) : null,
      gpsLat: r.gpsLat,
      gpsLng: r.gpsLng,
      createdAt: r.createdAt.toISOString(),
      user: { name: r.user.name, email: r.user.email, role: r.user.role },
      document: r.document ? { folio: r.document.folio, type: r.document.type } : null,
    })),
  }
}

// ── getDocumentTimeline() ─────────────────────────────────────────────────────
/**
 * Ordered audit timeline for a single document.
 * Used by the document detail page (already role-gated at page level).
 * deviceInfo always redacted in this context.
 */
export async function getDocumentTimeline(documentId: string): Promise<AuditLogEntry[]> {
  const rows = await prisma.auditLog.findMany({
    where: { documentId },
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { name: true, email: true, role: true } },
      document: { select: { folio: true, type: true } },
    },
  })

  return rows.map((r) => ({
    id: r.id,
    documentId: r.documentId,
    userId: r.userId,
    action: r.action,
    metadata: r.metadata as Record<string, unknown> | null,
    ipAddress: r.ipAddress,
    deviceInfo: null,
    gpsLat: r.gpsLat,
    gpsLng: r.gpsLng,
    createdAt: r.createdAt.toISOString(),
    user: { name: r.user.name, email: r.user.email, role: r.user.role },
    document: r.document ? { folio: r.document.folio, type: r.document.type } : null,
  }))
}
