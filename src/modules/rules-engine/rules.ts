import type { RuleDefinition, RuleContext, RuleResult } from './ruleTypes'

function containsAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase()
  return needles.some((n) => lower.includes(n.toLowerCase()))
}

function fieldHasValue(ctx: RuleContext, ...keys: string[]): boolean {
  return keys.some(
    (k) => ctx.fields[k] !== null && ctx.fields[k] !== undefined && ctx.fields[k] !== ''
  )
}

function signaturesInclude(ctx: RuleContext, roles: string[]): boolean {
  return roles.every((r) => ctx.signatures.some((s) => s.toLowerCase().includes(r.toLowerCase())))
}

// ── Height Work ──────────────────────────────────────────────────────────────

export const alturaRule: RuleDefinition = {
  id: 'ALTURA_001',
  name: 'Trabajo en altura',
  severity: 'blocking',
  matches: (ctx) =>
    containsAny(`${ctx.taskName} ${ctx.workArea}`, ['altura', 'elevado', 'andamio', 'techo', 'escalera', 'torre']) ||
    ctx.documentType === 'HEIGHT_WORK',
  evaluate: (ctx): RuleResult => {
    const requiredActions: string[] = []

    if (!fieldHasValue(ctx, 'arnes', 'arnés', 'harness'))
      requiredActions.push('Registrar uso de arnés de seguridad')
    if (!fieldHasValue(ctx, 'linea_de_vida', 'linea vida', 'lifeline'))
      requiredActions.push('Registrar línea de vida')
    if (
      !fieldHasValue(ctx, 'permiso_altura', 'permiso_trabajo', 'tipo_permiso') &&
      ctx.documentType !== 'WORK_PERMIT' &&
      ctx.documentType !== 'HEIGHT_WORK'
    )
      requiredActions.push('Adjuntar permiso de trabajo en altura')
    if (!fieldHasValue(ctx, 'trabajador_autorizado', 'responsable', 'operador'))
      requiredActions.push('Identificar trabajador autorizado para trabajo en altura')
    if (!signaturesInclude(ctx, ['supervisor']) && ctx.signatures.length === 0)
      requiredActions.push('Firma de supervisor obligatoria para trabajo en altura')

    return {
      ruleId: 'ALTURA_001',
      passed: requiredActions.length === 0,
      severity: 'blocking',
      message:
        requiredActions.length === 0
          ? 'Requisitos de trabajo en altura cumplidos'
          : `Trabajo en altura detectado — ${requiredActions.length} control(es) faltante(s)`,
      requiredActions,
    }
  },
}

// ── Energy / Electrical ──────────────────────────────────────────────────────

export const energiaRule: RuleDefinition = {
  id: 'ENERGIA_001',
  name: 'Control de energías peligrosas',
  severity: 'blocking',
  matches: (ctx) =>
    containsAny(`${ctx.taskName} ${ctx.workArea}`, [
      'energía',
      'energia',
      'eléctrico',
      'electrico',
      'bloqueo',
      'loto',
      'lockout',
      'tagout',
      'voltaje',
      'corriente',
      'tablero',
      'transformador',
    ]) || ctx.documentType === 'LOTO',
  evaluate: (ctx): RuleResult => {
    const requiredActions: string[] = []

    if (!fieldHasValue(ctx, 'loto', 'bloqueo', 'lockout', 'tagout'))
      requiredActions.push('Registrar aplicación de LOTO (Lockout/Tagout)')
    if (!fieldHasValue(ctx, 'energia_cero', 'verificacion_energia', 'energia cero', 'zero energy'))
      requiredActions.push('Documentar verificación de energía cero')
    if (!fieldHasValue(ctx, 'responsable_autorizado', 'responsable', 'operador'))
      requiredActions.push('Identificar responsable autorizado para trabajo con energías')
    if (!signaturesInclude(ctx, ['supervisor']) && ctx.signatures.length === 0)
      requiredActions.push('Firma de supervisor obligatoria para trabajo con energías peligrosas')

    return {
      ruleId: 'ENERGIA_001',
      passed: requiredActions.length === 0,
      severity: 'blocking',
      message:
        requiredActions.length === 0
          ? 'Controles de energías peligrosas cumplidos'
          : `Energías peligrosas detectadas — ${requiredActions.length} control(es) faltante(s)`,
      requiredActions,
    }
  },
}

// ── Lifting / Crane ──────────────────────────────────────────────────────────

export const izajeRule: RuleDefinition = {
  id: 'IZAJE_001',
  name: 'Operaciones de izaje',
  severity: 'blocking',
  matches: (ctx) =>
    containsAny(`${ctx.taskName} ${ctx.workArea}`, [
      'izaje',
      'izamiento',
      'grúa',
      'grua',
      'carga suspendida',
      'carga colgante',
      'aparejo',
      'eslinga',
      'camión pluma',
      'camion pluma',
      'horquilla',
      'tecle',
    ]) || ctx.documentType === 'LIFTING_PLAN',
  evaluate: (ctx): RuleResult => {
    const requiredActions: string[] = []

    if (!fieldHasValue(ctx, 'plan_izaje', 'plan izaje', 'lifting_plan'))
      requiredActions.push('Adjuntar plan de izaje aprobado')
    if (!fieldHasValue(ctx, 'operador_autorizado', 'operador', 'operator'))
      requiredActions.push('Identificar operador de grúa autorizado')
    if (!fieldHasValue(ctx, 'rigger', 'rigger_certificado', 'aparejador'))
      requiredActions.push('Identificar rigger certificado')
    if (!fieldHasValue(ctx, 'area_segregada', 'segregacion', 'perimetro'))
      requiredActions.push('Documentar segregación de área bajo carga suspendida')

    return {
      ruleId: 'IZAJE_001',
      passed: requiredActions.length === 0,
      severity: 'blocking',
      message:
        requiredActions.length === 0
          ? 'Requisitos de izaje cumplidos'
          : `Operación de izaje detectada — ${requiredActions.length} control(es) faltante(s)`,
      requiredActions,
    }
  },
}

// ── Confined Space ───────────────────────────────────────────────────────────

export const espacioConfinadoRule: RuleDefinition = {
  id: 'ESPCONF_001',
  name: 'Espacio confinado',
  severity: 'blocking',
  matches: (ctx) =>
    containsAny(`${ctx.taskName} ${ctx.workArea}`, [
      'espacio confinado',
      'tanque',
      'silo',
      'pozo',
      'excavación',
      'excavacion',
      'túnel',
      'tunel',
      'foso',
      'cisterna',
      'alcantarilla',
    ]) || ctx.documentType === 'CONFINED_SPACE',
  evaluate: (ctx): RuleResult => {
    const requiredActions: string[] = []

    if (!fieldHasValue(ctx, 'medicion_gases', 'gases', 'atmosfera', 'atmosférica', 'LEL', 'O2'))
      requiredActions.push('Registrar medición de gases (O₂, gases tóxicos, explosividad)')
    if (!fieldHasValue(ctx, 'vigia', 'vigía', 'watchman', 'sentinela'))
      requiredActions.push('Designar vigía externo para espacio confinado')
    if (
      !fieldHasValue(ctx, 'permiso_especial', 'permiso_confinado', 'tipo_permiso') &&
      ctx.documentType !== 'WORK_PERMIT' &&
      ctx.documentType !== 'CONFINED_SPACE'
    )
      requiredActions.push('Obtener permiso especial para trabajo en espacio confinado')
    if (!fieldHasValue(ctx, 'plan_rescate', 'rescate', 'emergencia'))
      requiredActions.push('Adjuntar plan de rescate para espacio confinado')

    return {
      ruleId: 'ESPCONF_001',
      passed: requiredActions.length === 0,
      severity: 'blocking',
      message:
        requiredActions.length === 0
          ? 'Requisitos de espacio confinado cumplidos'
          : `Espacio confinado detectado — ${requiredActions.length} control(es) faltante(s)`,
      requiredActions,
    }
  },
}

// ── Required Signatures ──────────────────────────────────────────────────────

export const firmasRule: RuleDefinition = {
  id: 'FIRMA_001',
  name: 'Firmas obligatorias',
  severity: 'blocking',
  matches: () => true,
  evaluate: (ctx): RuleResult => {
    const requiredActions: string[] = []

    const requiresSupervisor = containsAny(`${ctx.taskName} ${ctx.workArea}`, [
      'altura', 'energía', 'energia', 'eléctrico', 'electrico', 'confinado',
      'izaje', 'explosivo', 'excavación', 'excavacion', 'bloqueo', 'loto',
    ]) || ['WORK_PERMIT', 'HEIGHT_WORK', 'CONFINED_SPACE', 'LOTO', 'LIFTING_PLAN'].includes(ctx.documentType)

    if (requiresSupervisor && ctx.signatures.length === 0) {
      requiredActions.push('Se requiere firma de supervisor para este tipo de trabajo')
    }

    return {
      ruleId: 'FIRMA_001',
      passed: requiredActions.length === 0,
      severity: 'blocking',
      message:
        requiredActions.length === 0
          ? 'Firmas requeridas presentes o no aplica'
          : 'Firma(s) obligatoria(s) faltante(s)',
      requiredActions,
    }
  },
}

// ── Mandatory Fields ─────────────────────────────────────────────────────────

export const camposObligatoriosRule: RuleDefinition = {
  id: 'CAMPOS_001',
  name: 'Campos obligatorios del documento',
  severity: 'warning',
  matches: () => true,
  evaluate: (ctx): RuleResult => {
    const missing: string[] = []
    if (!ctx.hasCompany) missing.push('empresa')
    if (!ctx.hasArea) missing.push('área')
    if (!ctx.hasDate) missing.push('fecha')
    if (!ctx.hasTask) missing.push('tarea')
    if (!ctx.hasResponsible) missing.push('responsable')

    return {
      ruleId: 'CAMPOS_001',
      passed: missing.length === 0,
      severity: 'warning',
      message:
        missing.length === 0
          ? 'Campos obligatorios completos'
          : `Campos faltantes: ${missing.join(', ')}`,
      requiredActions: missing.map((m) => `Completar campo: ${m}`),
    }
  },
}
