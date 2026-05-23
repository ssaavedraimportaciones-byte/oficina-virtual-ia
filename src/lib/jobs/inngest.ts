import { Inngest, NonRetriableError } from 'inngest'
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

async function emitDeadLetter(
  type: string,
  originalData: Record<string, unknown>,
  errorMessage: string
): Promise<void> {
  await inngestClient.send({
    name: 'safecheck/job.dead_letter',
    data: {
      type,
      jobId: originalData['jobId'],
      documentId: originalData['documentId'],
      userId: originalData['userId'],
      error: errorMessage,
      failedAt: new Date().toISOString(),
    },
  }).catch((e) => console.error('[inngest] DLQ emit failed', e))
}

export const ocrFunction = inngestClient.createFunction(
  {
    id: 'process-ocr',
    name: 'Process OCR Job',
    retries: 4,
    triggers: [{ event: 'safecheck/ocr.requested' }],
    onFailure: async ({ event }: { event: { data: { event: OcrEvent; error: { message: string } } } }) => {
      await emitDeadLetter(
        'OCR',
        event.data.event.data as unknown as Record<string, unknown>,
        event.data.error.message
      )
    },
  },
  async ({ event }: { event: OcrEvent }) => {
    const { jobId, documentId, userId, payload } = event.data
    try {
      await runOcrWorker(jobId, documentId, userId, payload)
    } catch (err) {
      if (err instanceof Error && err.message.includes('INVALID_FORMAT')) {
        throw new NonRetriableError(err.message)
      }
      throw err
    }
  }
)

export const pdfFunction = inngestClient.createFunction(
  {
    id: 'process-pdf',
    name: 'Generate PDF Job',
    retries: 3,
    triggers: [{ event: 'safecheck/pdf.requested' }],
    onFailure: async ({ event }: { event: { data: { event: PdfEvent; error: { message: string } } } }) => {
      await emitDeadLetter(
        'PDF',
        event.data.event.data as unknown as Record<string, unknown>,
        event.data.error.message
      )
    },
  },
  async ({ event }: { event: PdfEvent }) => {
    const { jobId, documentId, userId, payload } = event.data
    await runPdfWorker(jobId, documentId, userId, payload)
  }
)

// DLQ consumer — alerts on permanently failed jobs via Slack webhook if configured
export const dlqFunction = inngestClient.createFunction(
  {
    id: 'job-dead-letter',
    name: 'Job Dead Letter Queue',
    retries: 0,
    triggers: [{ event: 'safecheck/job.dead_letter' }],
  },
  async ({ event }: { event: { data: Record<string, unknown> } }) => {
    const { type, jobId, documentId, userId, error, failedAt } = event.data
    console.error('[DLQ] Permanently failed job', { type, jobId, documentId, userId, error, failedAt })

    const webhookUrl = process.env.SLACK_ALERT_WEBHOOK
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 SafeCheck AI — Job permanentemente fallido\nTipo: ${type}\nDocumento: ${documentId}\nError: ${error}\nFecha: ${failedAt}`,
        }),
      }).catch(() => { /* alert failure must not cause DLQ loop */ })
    }
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
