import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  addKnowledgeEntry,
  decryptCredentials,
  getBusiness,
  refreshKnowledgeEntry,
} from '@/lib/store'
import { getBusinessDiscovery } from '@/lib/instagram'

const importSchema = z.object({
  username: z.string().min(1),
  entryId: z.string().optional(),
})

function formatProfileText(profile: {
  biography: string
  website: string | null
  followersCount: number | null
  recentCaptions: string[]
}): string {
  const parts = [profile.biography]
  if (profile.website) parts.push(`Sitio web: ${profile.website}`)
  if (profile.followersCount !== null) parts.push(`Seguidores: ${profile.followersCount}`)
  if (profile.recentCaptions.length > 0) {
    parts.push('Últimas publicaciones:\n' + profile.recentCaptions.map((c) => `- ${c}`).join('\n'))
  }
  return parts.filter(Boolean).join('\n\n')
}

// Requiere que la cuenta de Instagram del negocio ya esté conectada como
// Business/Creator: Meta exige "pasar por" una cuenta propia para poder
// consultar el perfil público de cualquier otra (Business Discovery).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const parsed = importSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const business = await getBusiness(id)
  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  const handle = parsed.data.username.replace(/^@/, '')

  let profile: Awaited<ReturnType<typeof getBusinessDiscovery>>
  try {
    profile = await getBusinessDiscovery(handle, decryptCredentials(business.credentials))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo importar el perfil' },
      { status: 502 },
    )
  }

  const title = `Instagram @${handle}`
  const content = formatProfileText(profile)
  const sourceUrl = `https://instagram.com/${handle}`

  const entry = parsed.data.entryId
    ? await refreshKnowledgeEntry(parsed.data.entryId, { title, content })
    : await addKnowledgeEntry({
        businessId: id,
        title,
        content,
        sourceType: 'instagram',
        sourceUrl,
      })

  return NextResponse.json({ entry })
}
