import { NextRequest } from 'next/server'
import { apiError, apiJson, apiRoute } from '@/lib/apiV1'
import { getClient } from '@/lib/apiV1Data'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(async () => {
    const { id } = await params
    const client = await getClient(id)
    return client ? apiJson({ data: client }) : apiError(404, 'not_found', 'Cliente no encontrado.')
  })(request)
}
