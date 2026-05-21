import type { DocumentStatus } from '@/types/document'

export type RuleSeverity = 'blocking' | 'warning'

export interface RuleContext {
  taskName: string
  workArea: string
  documentType: string
  fields: Record<string, string | null>
  signatures: string[]
  hasCompany: boolean
  hasArea: boolean
  hasDate: boolean
  hasTask: boolean
  hasResponsible: boolean
}

export interface RuleResult {
  ruleId: string
  passed: boolean
  severity: RuleSeverity
  message: string
  requiredActions: string[]
}

export interface RuleDefinition {
  id: string
  name: string
  severity: RuleSeverity
  /** Returns true when this rule should be evaluated */
  matches: (ctx: RuleContext) => boolean
  evaluate: (ctx: RuleContext) => RuleResult
}

export interface EvaluationResult {
  statusRecommendation: DocumentStatus
  passed: boolean
  blockingIssues: string[]
  warnings: string[]
  requiredActions: string[]
  ruleResults: RuleResult[]
}
