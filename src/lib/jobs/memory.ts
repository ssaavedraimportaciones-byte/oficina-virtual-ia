import { after } from 'next/server'
import { createJob } from './db'
import { runOcrWorker, runPdfWorker } from './workers'
import type { OcrJobPayload, PdfJobPayload, JobRecord } from './types'

export async function enqueueOcr(
  documentId: string,
  userId: string,
  payload: OcrJobPayload
): Promise<JobRecord> {
  const job = await createJob('OCR', documentId, userId, payload as unknown as Record<string, unknown>)
  after(async () => runOcrWorker(job.id, documentId, userId, payload))
  return job
}

export async function enqueuePdf(
  documentId: string,
  userId: string,
  payload: PdfJobPayload
): Promise<JobRecord> {
  const job = await createJob('PDF', documentId, userId, payload as unknown as Record<string, unknown>)
  after(async () => runPdfWorker(job.id, documentId, userId, payload))
  return job
}
