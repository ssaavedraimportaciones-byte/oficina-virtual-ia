export type DocumentType =
  | 'CHARLA_DE_SEGURIDAD'
  | 'DET'
  | 'ART'
  | 'PERMISO_DE_TRABAJO'
  | 'CHECK_LIST'
  | 'ACTA_DE_REUNION'
  | 'INCIDENTE'
  | 'INVESTIGACION'
  | 'AUDITORIA'
  | 'CAPACITACION'
  | 'OTHER'

export interface AIField {
  value: string | null
  inferred: boolean
}

export interface AIClassificationResult {
  documentType: DocumentType
  confidence: number
  fields: Record<string, AIField>
  missingFields: string[]
  observations: string[]
  inferredFields: string[]
}

export interface FieldSchema {
  name: string
  description: string
  required: boolean
}
