import { CAMPOS_REQUERIDOS } from '@/lib/constants'
import type { DocumentTipo } from '@/types/document'

export interface ValidationResult {
  valido: boolean
  errores: string[]
}

export function validarCampos(tipo: DocumentTipo, campos: Record<string, unknown>): ValidationResult {
  const errores: string[] = []
  for (const campo of CAMPOS_REQUERIDOS[tipo]) {
    const v = campos[campo]
    if (v === undefined || v === null || v === '') errores.push(`"${campo}" es obligatorio`)
    else if (Array.isArray(v) && v.length === 0) errores.push(`"${campo}" debe tener al menos un elemento`)
  }
  return { valido: errores.length === 0, errores }
}
