export type JobType = 'OCR' | 'PDF'
export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
export type JobProvider = 'memory' | 'inngest'

export interface JobRecord {
  id: string
  type: JobType
  status: JobStatus
  documentId: string
  userId: string
  payload: Record<string, unknown>
  result: Record<string, unknown> | null
  error: string | null
  attempts: number
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
}

export interface OcrJobPayload {
  storageUrl: string
  fileName: string
  mimeType: string
  forceOverwrite: boolean
  ip: string
  userAgent: string
}

export interface PdfJobPayload {
  ip: string
  userAgent: string
}
