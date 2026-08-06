const GRAPH_VERSION = 'v20.0'

export async function sendInstagramMessage(recipientId: string, text: string): Promise<void> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  const pageId = process.env.INSTAGRAM_PAGE_ID
  if (!token || !pageId) {
    throw new Error('Faltan INSTAGRAM_ACCESS_TOKEN o INSTAGRAM_PAGE_ID')
  }

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
      }),
    },
  )

  if (!res.ok) {
    throw new Error(`Instagram API respondió ${res.status}: ${await res.text()}`)
  }
}

interface BusinessDiscoveryMedia {
  caption?: string
}

interface BusinessDiscoveryResult {
  username: string
  biography?: string
  website?: string
  followers_count?: number
  media?: { data: BusinessDiscoveryMedia[] }
}

/**
 * Consulta el perfil público de una cuenta de Instagram Business/Creator
 * (bio, sitio, últimas publicaciones) usando la cuenta propia como puente,
 * tal como exige la API de Meta (Business Discovery). Sirve tanto para
 * importar la propia cuenta como la de un cliente/competidor público.
 */
export async function getBusinessDiscovery(username: string): Promise<{
  biography: string
  website: string | null
  followersCount: number | null
  recentCaptions: string[]
}> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  const pageId = process.env.INSTAGRAM_PAGE_ID
  if (!token || !pageId) {
    throw new Error('Faltan INSTAGRAM_ACCESS_TOKEN o INSTAGRAM_PAGE_ID')
  }

  const handle = username.replace(/^@/, '')
  const fields = `business_discovery.username(${handle}){biography,website,followers_count,media.limit(6){caption}}`
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}?fields=${encodeURIComponent(fields)}&access_token=${token}`,
  )

  if (!res.ok) {
    throw new Error(`Instagram API respondió ${res.status}: ${await res.text()}`)
  }

  const data = (await res.json()) as { business_discovery?: BusinessDiscoveryResult }
  const discovery = data.business_discovery
  if (!discovery) {
    throw new Error(`No se encontró la cuenta @${handle} o no es una cuenta Business/Creator`)
  }

  return {
    biography: discovery.biography ?? '',
    website: discovery.website ?? null,
    followersCount: discovery.followers_count ?? null,
    recentCaptions: (discovery.media?.data ?? []).map((m) => m.caption).filter(Boolean) as string[],
  }
}

/** Perfil público básico de quien nos escribe, para poder dirigirnos a esa persona por su nombre. */
export async function getInstagramContactProfile(
  igsid: string,
): Promise<{ name: string | null }> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!token) return { name: null }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${igsid}?fields=name&access_token=${token}`,
    )
    if (!res.ok) return { name: null }
    const data = (await res.json()) as { name?: string }
    return { name: data.name ?? null }
  } catch {
    return { name: null }
  }
}
