import { markRunning, markCompleted, markFailed } from './db'
import { runOCR, extractFields, persistFields } from '@/modules/ocr'
import { readFile } from '@/modules/ocr/storage'
import { generateFinalPdf } from '@/modules/pdf'
import { log } from '@/modules/audit'
import type { OcrJobPayload, PdfJobPayload } from './types'

const OCR_ERROR = 'Error de procesamiento. Intente nuevamente o contacte soporte.'
const PDF_ERROR = 'PDF no pudo generarse. Intente nuevamente o contacte soporte.'

export async function runOcrWorker(
  jobId: string,
  documentId: string,
  userId: string,
  payload: OcrJobPayload
): Promise<void> {
  const { ip, userAgent, storageUrl, mimeType, forceOverwrite } = payload
  await markRunning(jobId)
  try { await log({ userId, ip, userAgent }, 'OCR_JOB_STARTED', { documentId, metadata: { jobId } }) } catch { /* audit must not abort job */ }

  try {
    const buffer = await readFile(storageUrl)
    const ocrResult = await runOCR({ buffer, mimeType, documentId, userId, ip, userAgent })
    const fields = extractFields(ocrResult)
    const { conflicts, saved } = await persistFields({ documentId, fields, userId, ip, userAgent, forceOverwrite })

    await markCompleted(jobId, {
      storageUrl,
      averageConfidence: ocrResult.averageConfidence,
      pageCount: ocrResult.pageCount,
      fieldsExtracted: fields.length,
      requiresHumanReview: ocrResult.requiresHumanReview,
      fieldsSaved: saved,
      conflicts: conflicts.length,
    })
    try { await log({ userId, ip, userAgent }, 'OCR_JOB_COMPLETED', { documentId, metadata: { jobId } }) } catch { /* audit must not abort job */ }
  } catch {
    await markFailed(jobId, OCR_ERROR)
    try { await log({ userId, ip, userAgent }, 'OCR_JOB_FAILED', { documentId, metadata: { jobId } }) } catch { /* audit must not abort job */ }
  }
}

export async function runPdfWorker(
  jobId: string,
  documentId: string,
  userId: string,
  payload: PdfJobPayload
): Promise<void> {
  const { ip, userAgent } = payload
  await markRunning(jobId)
  try { await log({ userId, ip, userAgent }, 'PDF_JOB_STARTED', { documentId, metadata: { jobId } }) } catch { /* audit must not abort job */ }

  try {
    const result = await generateFinalPdf(documentId, userId, ip)
    await markCompleted(jobId, {
      finalPdfUrl: result.pdfUrl,
      qrCode: result.qrCode,
      documentHash: result.documentHash,
      version: result.version,
    })
    try { await log({ userId, ip, userAgent }, 'PDF_JOB_COMPLETED', { documentId, metadata: { jobId, pdfUrl: result.pdfUrl } }) } catch { /* audit must not abort job */ }
  } catch {
    await markFailed(jobId, PDF_ERROR)
    try { await log({ userId, ip, userAgent }, 'PDF_JOB_FAILED', { documentId, metadata: { jobId } }) } catch { /* audit must not abort job */ }
  }
}
