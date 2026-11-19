import { NextRequest } from 'next/server'
import { apiError, apiJson, apiRoute } from '@/lib/apiV1'
import { getBotStatus } from '@/lib/apiV1Data'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(async () => {
    const { id } = await params
    const status = await getBotStatus(id)
    return status ? apiJson({ data: status }) : apiError(404, 'not_found', 'Bot no encontrado.')
  })(request)
}
