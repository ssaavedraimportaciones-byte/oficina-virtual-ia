import type { ApprovalFlow } from './types'

// Critical-work document types that require the 3-step manager flow
const CRITICAL_TYPES = new Set([
  'WORK_PERMIT',
  'HEIGHT_WORK',
  'CONFINED_SPACE',
  'LOTO',
  'LIFTING_PLAN',
])

/**
 * Returns the approval flow definition for a given document type.
 * Flow steps are ordered — each step must be completed before the next unlocks.
 */
export function getFlowForDocumentType(documentType: string): ApprovalFlow {
  if (documentType === 'SAFETY_TALK') {
    return {
      flowType: 'SAFETY_TALK',
      steps: [
        {
          order: 1,
          requiredRole: 'SUPERVISOR',
          label: 'Firma supervisor',
          type: 'SIGNATURE',
        },
        {
          order: 2,
          requiredRole: 'PREVENTIONIST',
          label: 'Revisión prevencionista',
          type: 'APPROVAL',
        },
      ],
    }
  }

  if (documentType === 'DET' || documentType === 'ART' || documentType === 'AST') {
    return {
      flowType: 'DET',
      steps: [
        {
          order: 1,
          requiredRole: 'SUPERVISOR',
          label: 'Firma supervisor',
          type: 'SIGNATURE',
        },
        {
          order: 2,
          requiredRole: 'PREVENTIONIST',
          label: 'Aprobación prevencionista',
          type: 'APPROVAL',
        },
        {
          order: 3,
          requiredRole: 'CONTRACT_ADMIN',
          label: 'Recibe copia — administrador de contratos',
          type: 'NOTIFICATION',
          nonBlocking: true,
        },
      ],
    }
  }

  if (CRITICAL_TYPES.has(documentType)) {
    return {
      flowType: 'CRITICAL',
      steps: [
        {
          order: 1,
          requiredRole: 'SUPERVISOR',
          label: 'Aprobación supervisor',
          type: 'APPROVAL',
        },
        {
          order: 2,
          requiredRole: 'PREVENTIONIST',
          label: 'Aprobación prevencionista',
          type: 'APPROVAL',
        },
        {
          order: 3,
          requiredRole: 'MANAGER',
          label: 'Aprobación gerencia',
          type: 'APPROVAL',
        },
      ],
    }
  }

  // Default: single-step supervisor approval
  return {
    flowType: 'DEFAULT',
    steps: [
      {
        order: 1,
        requiredRole: 'SUPERVISOR',
        label: 'Revisión y aprobación',
        type: 'APPROVAL',
      },
    ],
  }
}
