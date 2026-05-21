export const CONFIDENCE_THRESHOLD = 0.8

export interface OCRWord {
  content: string
  confidence: number
  isHandwritten: boolean
  polygon?: number[]
}

export interface OCRLine {
  content: string
  words: OCRWord[]
  isHandwritten: boolean
  pageNumber: number
}

export interface OCRTableCell {
  text: string
  rowIndex: number
  columnIndex: number
  confidence: number
  rowSpan?: number
  columnSpan?: number
}

export interface OCRTable {
  rowCount: number
  columnCount: number
  cells: OCRTableCell[]
}

export interface OCRField {
  name: string
  value: string
  confidence: number
  isHandwritten: boolean
  requiresReview: boolean
  polygon?: number[]
}

export interface SignatureRegion {
  fieldName: string
  pageNumber: number
  confidence: number
  polygon?: number[]
}

export interface OCRResult {
  rawText: string
  lines: OCRLine[]
  fields: OCRField[]
  tables: OCRTable[]
  signatures: SignatureRegion[]
  averageConfidence: number
  requiresHumanReview: boolean
  hasHandwrittenContent: boolean
  pageCount: number
  language: string
  modelVersion: string
}

export interface UploadedFile {
  originalName: string
  storagePath: string
  storageUrl: string
  mimeType: string
  sizeBytes: number
}

export interface FieldConflict {
  fieldName: string
  existingValue: string
  newValue: string
  newConfidence: number
  isManual: boolean
}
