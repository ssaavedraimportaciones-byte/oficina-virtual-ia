import { serve } from 'inngest/next'
import { inngestClient, ocrFunction, pdfFunction } from '@/lib/jobs/inngest'

export const { GET, POST, PUT } = serve({
  client: inngestClient,
  functions: [ocrFunction, pdfFunction],
})
