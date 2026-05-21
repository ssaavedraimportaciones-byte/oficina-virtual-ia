import type { DocumentTipo } from '@/types/document'
import { DOCUMENT_TYPES } from './document-types'

export interface ValidationResult {
  valido: boolean
  errores: string[]
}

export function validarCamposDocumento(
  tipo: DocumentTipo,
  campos: Record<string, unknown>
): ValidationResult {
  const config = DOCUMENT_TYPES[tipo]
  const errores: string[] = []

  for (const campo of config.camposRequeridos) {
    const valor = campos[campo]
    if (valor === undefined || valor === null || valor === '') {
      errores.push(`El campo "${campo}" es obligatorio`)
      continue
    }
    if (Array.isArray(valor) && valor.length === 0) {
      errores.push(`El campo "${campo}" debe tener al menos un elemento`)
    }
  }

  return { valido: errores.length === 0, errores }
}
