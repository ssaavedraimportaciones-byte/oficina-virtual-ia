import { apiJson, apiRoute, parsePage } from '@/lib/apiV1'
import { listSubscriptions } from '@/lib/apiV1Data'

export const dynamic = 'force-dynamic'

export const GET = apiRoute(async ({ url }) => apiJson(await listSubscriptions(parsePage(url))))
