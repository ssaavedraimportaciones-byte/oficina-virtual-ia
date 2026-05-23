import { Inngest } from 'inngest'
import { createJob } from './db'
import { runOcrWorker, runPdfWorker } from './workers'
import type { OcrJobPayload, PdfJobPayload, JobRecord } from './types'

export const inngestClient = new Inngest({
  id: 'safecheck-ai',
  eventKey: process.env.INNGEST_EVENT_KEY,
})

type OcrEvent = {
  name: 'safecheck/ocr.requested'
  data: { jobId: string; documentId: string; userId: string; payload: OcrJobPayload }
}

type PdfEvent = {
  name: 'safecheck/pdf.requested'
  data: { jobId: string; documentId: string; userId: string; payload: PdfJobPayload }
}

export const ocrFunction = inngestClient.createFunction(
  { id: 'process-ocr', name: 'Process OCR Job', retries: 2, triggers: { event: 'safecheck/ocr.requested' } },
  async ({ event }: { event: OcrEvent }) => {
    const { jobId, documentId, userId, payload } = event.data
    await runOcrWorker(jobId, documentId, userId, payload)
  }
)

export const pdfFunction = inngestClient.createFunction(
  { id: 'process-pdf', name: 'Generate PDF Job', retries: 2, triggers: { event: 'safecheck/pdf.requested' } },
  async ({ event }: { event: PdfEvent }) => {
    const { jobId, documentId, userId, payload } = event.data
    await runPdfWorker(jobId, documentId, userId, payload)
  }
)

export async function enqueueOcr(
  documentId: string,
  userId: string,
  payload: OcrJobPayload
): Promise<JobRecord> {
  const job = await createJob('OCR', documentId, userId, payload as unknown as Record<string, unknown>)
  await inngestClient.send({ name: 'safecheck/ocr.requested', data: { jobId: job.id, documentId, userId, payload } })
  return job
}

export async function enqueuePdf(
  documentId: string,
  userId: string,
  payload: PdfJobPayload
): Promise<JobRecord> {
  const job = await createJob('PDF', documentId, userId, payload as unknown as Record<string, unknown>)
  await inngestClient.send({ name: 'safecheck/pdf.requested', data: { jobId: job.id, documentId, userId, payload } })
  return job
}
