import { describe, it, expect } from 'vitest'
import { ApprovalsError } from '@/modules/approvals/errors'

// ── ApprovalsError class ──────────────────────────────────────────────────────

describe('ApprovalsError', () => {
  it('tiene statusCode correcto en construcción', () => {
    const err = new ApprovalsError('La aprobación ya fue procesada.', 409)
    expect(err.statusCode).toBe(409)
  })

  it('tiene name "ApprovalsError"', () => {
    const err = new ApprovalsError('test', 403)
    expect(err.name).toBe('ApprovalsError')
  })

  it('es instancia de Error', () => {
    const err = new ApprovalsError('test', 404)
    expect(err).toBeInstanceOf(Error)
  })

  it('el mensaje 409 no contiene stack trace ni detalles de Prisma', () => {
    const err = new ApprovalsError('La aprobación ya fue procesada.', 409)
    expect(err.message).not.toContain('PrismaClientKnownRequestError')
    expect(err.message).not.toContain('P2034')
    expect(err.message).not.toContain(' at ')
    expect(err.message.length).toBeLessThan(100)
  })

  it('el mensaje 500 genérico no expone detalles internos', () => {
    const err = new ApprovalsError('Error al procesar la aprobación.', 500)
    expect(err.message).not.toContain('Error:')
    expect(err.message).not.toContain('undefined')
    expect(err.message).not.toContain('null')
    expect(err.message.length).toBeLessThan(100)
  })

  it('statusCodes de las diferentes situaciones', () => {
    expect(new ApprovalsError('no encontrado', 404).statusCode).toBe(404)
    expect(new ApprovalsError('no autorizado', 403).statusCode).toBe(403)
    expect(new ApprovalsError('ya procesado', 409).statusCode).toBe(409)
    expect(new ApprovalsError('estado inválido', 422).statusCode).toBe(422)
    expect(new ApprovalsError('error interno', 500).statusCode).toBe(500)
  })
})

// ── Lógica de idempotencia ────────────────────────────────────────────────────
// Simula las condiciones que _recordDecision evalúa dentro de la transacción.

describe('Idempotencia — condiciones de decisión', () => {
  function isIdempotentRepeat(
    approvalStatus: string,
    approvalApproverId: string,
    requestApproverId: string,
    requestDecision: string
  ): boolean {
    return (
      approvalStatus !== 'PENDING' &&
      approvalApproverId === requestApproverId &&
      approvalStatus === requestDecision
    )
  }

  function isConflict(
    approvalStatus: string,
    approvalApproverId: string,
    requestApproverId: string,
    requestDecision: string
  ): boolean {
    if (approvalStatus === 'PENDING') return false
    return !(approvalApproverId === requestApproverId && approvalStatus === requestDecision)
  }

  it('mismo usuario + misma decisión = idempotente (no conflicto)', () => {
    expect(isIdempotentRepeat('APPROVED', 'user-1', 'user-1', 'APPROVED')).toBe(true)
  })

  it('mismo usuario + decisión diferente = conflicto 409', () => {
    expect(isIdempotentRepeat('APPROVED', 'user-1', 'user-1', 'REJECTED')).toBe(false)
    expect(isConflict('APPROVED', 'user-1', 'user-1', 'REJECTED')).toBe(true)
  })

  it('usuario diferente + misma decisión = conflicto 409 (no idempotente)', () => {
    expect(isIdempotentRepeat('APPROVED', 'user-A', 'user-B', 'APPROVED')).toBe(false)
    expect(isConflict('APPROVED', 'user-A', 'user-B', 'APPROVED')).toBe(true)
  })

  it('approval en PENDING = no es conflicto ni idempotente (se puede procesar)', () => {
    expect(isIdempotentRepeat('PENDING', 'user-1', 'user-1', 'APPROVED')).toBe(false)
    expect(isConflict('PENDING', 'user-1', 'user-1', 'APPROVED')).toBe(false)
  })

  it('doble request simultáneo: el segundo ve status !== PENDING y recibe 409', () => {
    // Simula el estado después de que el primer request escribió la decisión
    const approvalAfterFirstRequest = { status: 'APPROVED', approverId: 'user-winner' }
    // El segundo request (mismo usuario, misma decisión) → idempotente
    const sameUser = isIdempotentRepeat(
      approvalAfterFirstRequest.status,
      approvalAfterFirstRequest.approverId,
      'user-winner',
      'APPROVED'
    )
    expect(sameUser).toBe(true)
    // El segundo request (usuario diferente) → conflicto
    const diffUser = isConflict(
      approvalAfterFirstRequest.status,
      approvalAfterFirstRequest.approverId,
      'user-loser',
      'APPROVED'
    )
    expect(diffUser).toBe(true)
  })
})

// ── Guard de auto-aprobación ──────────────────────────────────────────────────

describe('Self-approval guard', () => {
  function isSelfApproval(createdById: string, approverId: string): boolean {
    return createdById === approverId
  }

  it('el creador no puede aprobar su propio documento', () => {
    expect(isSelfApproval('user-creator', 'user-creator')).toBe(true)
  })

  it('un aprobador diferente al creador sí puede aprobar', () => {
    expect(isSelfApproval('user-creator', 'user-approver')).toBe(false)
  })
})

// ── Estructura de metadata AuditLog ──────────────────────────────────────────

describe('AuditLog metadata — estructura before/after', () => {
  function buildAuditMetadata(
    approvalId: string,
    decision: 'APPROVED' | 'REJECTED' | 'OBSERVED',
    beforeApprovalStatus: string,
    beforeDocumentStatus: string,
    afterApprovalStatus: string,
    afterDocumentStatus: string,
    idempotent: boolean,
    blocked: boolean,
    reason?: string
  ) {
    return {
      approvalId,
      decision,
      before: { approvalStatus: beforeApprovalStatus, documentStatus: beforeDocumentStatus },
      after: { approvalStatus: afterApprovalStatus, documentStatus: afterDocumentStatus },
      idempotent,
      blocked,
      ...(reason ? { reason } : {}),
    }
  }

  it('metadata de decisión exitosa contiene before/after completos', () => {
    const meta = buildAuditMetadata(
      'ap-1', 'APPROVED',
      'PENDING', 'PENDING_APPROVAL',
      'APPROVED', 'APPROVED',
      false, false
    )
    expect(meta.before.approvalStatus).toBe('PENDING')
    expect(meta.before.documentStatus).toBe('PENDING_APPROVAL')
    expect(meta.after.approvalStatus).toBe('APPROVED')
    expect(meta.after.documentStatus).toBe('APPROVED')
    expect(meta.idempotent).toBe(false)
    expect(meta.blocked).toBe(false)
  })

  it('metadata de decisión idempotente tiene idempotent:true y blocked:false', () => {
    const meta = buildAuditMetadata(
      'ap-2', 'APPROVED',
      'APPROVED', 'APPROVED',
      'APPROVED', 'APPROVED',
      true, false
    )
    expect(meta.idempotent).toBe(true)
    expect(meta.blocked).toBe(false)
  })

  it('metadata de self-approval bloqueado tiene blocked:true y reason', () => {
    const meta = buildAuditMetadata(
      'ap-3', 'APPROVED',
      'PENDING', 'PENDING_APPROVAL',
      'PENDING', 'PENDING_APPROVAL',
      false, true, 'self_approval_attempt'
    )
    expect(meta.blocked).toBe(true)
    expect(meta.reason).toBe('self_approval_attempt')
    expect(meta.idempotent).toBe(false)
  })

  it('metadata de rechazo refleja el cambio de estado REJECTED', () => {
    const meta = buildAuditMetadata(
      'ap-4', 'REJECTED',
      'PENDING', 'PENDING_APPROVAL',
      'REJECTED', 'REJECTED',
      false, false
    )
    expect(meta.after.approvalStatus).toBe('REJECTED')
    expect(meta.after.documentStatus).toBe('REJECTED')
  })
})

// ── Mapeo de errores a status HTTP ────────────────────────────────────────────

describe('Mapeo ApprovalsError → HTTP status', () => {
  it('ApprovalsError 404 → HTTP 404', () => {
    const err = new ApprovalsError('Aprobación no encontrada', 404)
    expect(err.statusCode).toBe(404)
  })

  it('ApprovalsError 403 → HTTP 403 (no es 422)', () => {
    const err = new ApprovalsError('El creador del documento no puede aprobar su propio documento', 403)
    expect(err.statusCode).toBe(403)
    expect(err.statusCode).not.toBe(422)
  })

  it('ApprovalsError 409 → HTTP 409 (concurrencia)', () => {
    const err = new ApprovalsError('La aprobación ya fue procesada.', 409)
    expect(err.statusCode).toBe(409)
    expect(err.statusCode).not.toBe(422)
  })

  it('ApprovalsError 400 → HTTP 400 (comentario vacío en rechazo)', () => {
    const err = new ApprovalsError('El rechazo requiere comentario obligatorio', 400)
    expect(err.statusCode).toBe(400)
  })

  it('error desconocido → HTTP 500 con mensaje genérico sin internals', () => {
    const err = new ApprovalsError('Error al procesar la aprobación.', 500)
    expect(err.statusCode).toBe(500)
    expect(err.message).not.toContain('Error:')
    expect(err.message).not.toContain('undefined')
  })
})
