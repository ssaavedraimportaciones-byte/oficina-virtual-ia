import type { RuleDefinition } from './ruleTypes'
import {
  alturaRule,
  energiaRule,
  izajeRule,
  espacioConfinadoRule,
  firmasRule,
  camposObligatoriosRule,
} from './rules'

/**
 * Ordered list of default safety rules.
 * Rules run in order; all applicable rules are evaluated regardless of earlier failures.
 * Blocking rules take priority over warnings in status recommendation.
 */
export const DEFAULT_RULES: RuleDefinition[] = [
  // Blocking — high-risk work categories
  alturaRule,
  energiaRule,
  izajeRule,
  espacioConfinadoRule,
  firmasRule,
  // Warning — completeness
  camposObligatoriosRule,
]
