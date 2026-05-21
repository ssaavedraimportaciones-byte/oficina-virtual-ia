export type DocumentType =
  | 'SAFETY_TALK'
  | 'DET'
  | 'ART'
  | 'AST'
  | 'WORK_PERMIT'
  | 'LOTO'
  | 'HEIGHT_WORK'
  | 'CONFINED_SPACE'
  | 'LIFTING_PLAN'
  | 'EQUIPMENT_CHECKLIST'
  | 'OTHER'

export type DocumentStatus =
  | 'DRAFT'
  | 'SCANNED'
  | 'AI_REVIEW'
  | 'OBSERVED'
  | 'PENDING_SIGNATURE'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CLOSED'
  | 'ARCHIVED'

export interface DocumentSummary {
  id: string
  folio: string
  type: DocumentType
  status: DocumentStatus
  taskName: string
  workArea: string
  companyId: string
  createdById: string
  createdAt: Date
  updatedAt: Date
}
