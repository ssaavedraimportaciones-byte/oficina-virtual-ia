// All legal audit action strings — extend here when adding new events.
// AuditLog records are append-only; never expose update or delete.
export type AuditAction =
  // ── Auth ─────────────────────────────────────────────────────────────────
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_MFA_REQUIRED'
  // ── MFA ──────────────────────────────────────────────────────────────────
  | 'MFA_SETUP_INITIATED'
  | 'MFA_ENABLED'
  | 'MFA_DISABLED'
  | 'MFA_VERIFY_OK'
  | 'MFA_VERIFY_FAILED'
  | 'MFA_DISABLE_FAILED'
  // ── Documents ────────────────────────────────────────────────────────────
  | 'DOCUMENT_CREATED'
  | 'DOCUMENT_READ'
  | 'DOCUMENT_EDITED'
  | 'DOCUMENT_CLOSED'
  | 'DOCUMENT_ARCHIVED'
  // ── Scanning & OCR ───────────────────────────────────────────────────────
  | 'DOCUMENT_SCANNED'
  | 'OCR_EXECUTED'
  | 'OCR_JOB_CREATED'
  | 'OCR_JOB_STARTED'
  | 'OCR_JOB_COMPLETED'
  | 'OCR_JOB_FAILED'
  // ── AI & Rules ───────────────────────────────────────────────────────────
  | 'AI_CLASSIFICATION_EXECUTED'
  | 'RULES_VALIDATED'
  // ── Signatures ───────────────────────────────────────────────────────────
  | 'DOCUMENT_SIGNED'
  // ── Approvals ────────────────────────────────────────────────────────────
  | 'APPROVAL_FLOW_STARTED'
  | 'APPROVAL_COMMENT'
  | 'DOCUMENT_APPROVED'
  | 'DOCUMENT_REJECTED'
  | 'DOCUMENT_OBSERVED'
  // ── Output ───────────────────────────────────────────────────────────────
  | 'PDF_GENERATED'
  | 'PDF_JOB_CREATED'
  | 'PDF_JOB_STARTED'
  | 'PDF_JOB_COMPLETED'
  | 'PDF_JOB_FAILED'
  // ── Notifications ────────────────────────────────────────────────────────
  | 'NOTIFICATION_SENT'
  | 'NOTIFICATION_FAILED'
  // ── Legacy (existing logs in DB — do not remove) ─────────────────────────
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'STATUS_CHANGE'
  | 'REGISTER'

export interface AuditCtx {
  userId: string
  ip?: string
  userAgent?: string
  gpsLat?: number
  gpsLng?: number
}

export interface AuditLogEntry {
  id: string
  documentId: string | null
  userId: string
  action: string
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  deviceInfo: Record<string, unknown> | null
  gpsLat: number | null
  gpsLng: number | null
  createdAt: string
  user: { name: string; email: string; role: string }
  document: { folio: string; type: string } | null
}

export interface QueryLogsParams {
  role: string
  companyId: string
  documentId?: string
  userId?: string
  action?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
  offset?: number
}
