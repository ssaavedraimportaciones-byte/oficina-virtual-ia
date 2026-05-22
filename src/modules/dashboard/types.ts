import { z } from 'zod'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const DOCUMENT_TYPES = [
  'SAFETY_TALK', 'DET', 'ART', 'AST', 'WORK_PERMIT', 'LOTO',
  'HEIGHT_WORK', 'CONFINED_SPACE', 'LIFTING_PLAN', 'EQUIPMENT_CHECKLIST', 'OTHER',
] as const

export const DOCUMENT_STATUSES = [
  'DRAFT', 'SCANNED', 'AI_REVIEW', 'OBSERVED', 'PENDING_SIGNATURE',
  'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CLOSED', 'ARCHIVED',
] as const

export const dashboardFiltersSchema = z.object({
  dateFrom:  z.string().regex(DATE_REGEX, 'Formato de fecha inválido (YYYY-MM-DD)').optional(),
  dateTo:    z.string().regex(DATE_REGEX, 'Formato de fecha inválido (YYYY-MM-DD)').optional(),
  companyId: z.string().cuid('companyId inválido').optional(),
  workArea:  z.string().max(200).optional(),
  docType:   z.enum(DOCUMENT_TYPES).optional(),
  status:    z.enum(DOCUMENT_STATUSES).optional(),
  createdBy: z.string().cuid('createdBy inválido').optional(),
  cursor:    z.string().optional(),
  take:      z.coerce.number().int().min(1).max(100).default(25),
})

export type DashboardFilters = z.infer<typeof dashboardFiltersSchema>

export interface ComplianceByArea {
  area: string
  total: number
  approved: number
  rate: number
}

export interface ComplianceByCompany {
  companyId: string
  companyName: string
  total: number
  approved: number
  rejected: number
  observed: number
  rate: number
}

export interface CriticalRisk {
  documentId: string
  folio: string
  type: string
  workArea: string
  companyName: string
  blockingIssues: string[]
}

export interface PendingApprovalItem {
  approvalId: string
  documentId: string
  folio: string
  taskName: string
  workArea: string
  type: string
  requiredRole: string
  companyName: string
  createdByName: string
  createdAt: string
  waitingHours: number
}

export interface DashboardStats {
  kpis: {
    createdToday: number
    approved: number
    rejected: number
    observed: number
    pendingSignature: number
    pendingApproval: number
    docsWithoutSignature: number
    avgApprovalHours: number | null
    criticalRisksCount: number
    total: number
  }
  complianceByArea: ComplianceByArea[]
  complianceByCompany: ComplianceByCompany[]
  topErrors: { issue: string; count: number }[]
  criticalRisks: CriticalRisk[]
  byType: { type: string; count: number }[]
  pendingApprovals: {
    items: PendingApprovalItem[]
    nextCursor: string | null
    hasMore: boolean
  }
  companies: { id: string; name: string }[]
  filters: { dateFrom: string; dateTo: string }
}
