import type { UserRole } from '@/types/user'

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'OBSERVED'
export type StepType = 'SIGNATURE' | 'APPROVAL' | 'NOTIFICATION'

export interface FlowStep {
  order: number
  requiredRole: UserRole
  label: string
  type: StepType
  /** True for informational steps that don't block progression */
  nonBlocking?: boolean
}

export interface ApprovalFlow {
  flowType: string
  steps: FlowStep[]
}

export interface FlowProgress {
  step: FlowStep
  status: ApprovalStatus
  approvalId: string | null
  approverName: string | null
  approverRole: UserRole | null
  comment: string | null
  decidedAt: string | null
}

export interface ApprovalResult {
  approvalId: string
  documentId: string
  newDocumentStatus: string
  flowComplete: boolean
}

export interface PendingApprovalItem {
  documentId: string
  folio: string
  taskName: string
  workArea: string
  documentType: string
  flowStep: FlowStep
  pendingApprovalId: string | null
  submittedAt: string
}
