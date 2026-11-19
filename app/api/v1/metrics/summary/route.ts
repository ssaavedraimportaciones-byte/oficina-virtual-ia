import { apiJson, apiRoute } from '@/lib/apiV1'
import { metricsSummary } from '@/lib/apiV1Data'

export const dynamic = 'force-dynamic'

export const GET = apiRoute(async () => apiJson({ data: await metricsSummary() }))
