import * as memory from './memory'
export { getJob } from './db'
export type { JobRecord, OcrJobPayload, PdfJobPayload } from './types'

const useInngest = process.env.JOB_PROVIDER === 'inngest'

async function inngest() {
  return import('./inngest')
}

export async function enqueueOcr(
  documentId: string,
  userId: string,
  payload: import('./types').OcrJobPayload
) {
  if (useInngest) return (await inngest()).enqueueOcr(documentId, userId, payload)
  return memory.enqueueOcr(documentId, userId, payload)
}

export async function enqueuePdf(
  documentId: string,
  userId: string,
  payload: import('./types').PdfJobPayload
) {
  if (useInngest) return (await inngest()).enqueuePdf(documentId, userId, payload)
  return memory.enqueuePdf(documentId, userId, payload)
}
