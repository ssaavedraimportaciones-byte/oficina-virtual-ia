import type { RuleDefinition, RuleContext, EvaluationResult } from './ruleTypes'
import type { DocumentStatus } from '@/types/document'
import { DEFAULT_RULES } from './defaultRules'

export function buildRuleContext(input: {
  taskName: string
  workArea: string
  documentType: string
  fields: Record<string, string | null | undefined>
  signatures?: string[]
}): RuleContext {
  const fields: Record<string, string | null> = {}
  for (const [k, v] of Object.entries(input.fields)) {
    fields[k.toLowerCase().replace(/\s+/g, '_')] = v ?? null
  }

  const allText = `${input.taskName} ${input.workArea} ${Object.values(fields).join(' ')}`.toLowerCase()

  const hasField = (...keys: string[]) =>
    keys.some((k) => {
      const v = fields[k.toLowerCase().replace(/\s+/g, '_')]
      return v !== null && v !== undefined && v.trim() !== ''
    })

  return {
    taskName: input.taskName,
    workArea: input.workArea,
    documentType: input.documentType,
    fields,
    signatures: input.signatures ?? [],
    hasCompany: hasField('empresa', 'company', 'companyName') || allText.includes('empresa'),
    hasArea: hasField('area', 'workArea', 'work_area', 'lugar') || input.workArea.trim() !== '',
    hasDate: hasField('fecha', 'date', 'fechaInicio', 'fecha_inicio'),
    hasTask: hasField('tarea', 'task', 'taskName', 'task_name') || input.taskName.trim() !== '',
    hasResponsible: hasField('responsable', 'responsible', 'supervisor', 'relator', 'instructor'),
  }
}

function recommendStatus(
  blockingFailed: boolean,
  missingSignatures: boolean,
  hasWarnings: boolean
): DocumentStatus {
  if (missingSignatures) return 'PENDING_SIGNATURE'
  if (blockingFailed) return 'OBSERVED'
  if (hasWarnings) return 'OBSERVED'
  return 'SCANNED'
}

export function evaluateRules(
  ctx: RuleContext,
  rules: RuleDefinition[] = DEFAULT_RULES
): EvaluationResult {
  const ruleResults = rules
    .filter((r) => r.matches(ctx))
    .map((r) => r.evaluate(ctx))

  const blocking = ruleResults.filter((r) => r.severity === 'blocking' && !r.passed)
  const warnings = ruleResults.filter((r) => r.severity === 'warning' && !r.passed)

  const missingSignatures = ruleResults.some(
    (r) => r.ruleId === 'FIRMA_001' && !r.passed
  )

  const blockingFailed = blocking.filter((r) => r.ruleId !== 'FIRMA_001').length > 0

  const allRequiredActions = [
    ...new Set(ruleResults.flatMap((r) => r.requiredActions)),
  ]

  return {
    statusRecommendation: recommendStatus(blockingFailed, missingSignatures, warnings.length > 0),
    passed: blocking.length === 0 && warnings.length === 0,
    blockingIssues: blocking.map((r) => r.message),
    warnings: warnings.map((r) => r.message),
    requiredActions: allRequiredActions,
    ruleResults,
  }
}
