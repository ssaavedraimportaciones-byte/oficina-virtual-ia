import { assertPublicUrl } from './ssrf'

const MAX_CHARS = 12000

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function htmlToText(html: string): string {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')

  const withBreaks = withoutNoise
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')

  const stripped = withBreaks.replace(/<[^>]+>/g, ' ')

  return decodeEntities(stripped)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

/** Cuántos saltos de redirección se siguen, revalidando el destino en cada uno. */
const MAX_REDIRECTS = 3

/** Corte de tamaño, para que una descarga enorme no agote la memoria. */
const MAX_BYTES = 2_000_000

export async function importPageText(url: string): Promise<{ title: string; text: string }> {
  let current = url

  let res: Response | null = null
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    // Se revalida en cada salto: una URL pública puede redirigir a una interna.
    const check = await assertPublicUrl(current)
    if (!check.ok) throw new Error(check.reason)

    const response = await fetch(check.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AgentsAppBot/1.0)' },
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new Error('La página redirige a un destino inválido.')
      current = new URL(location, check.url).toString()
      continue
    }

    res = response
    break
  }

  if (!res) throw new Error('La página tiene demasiadas redirecciones.')
  if (!res.ok) {
    throw new Error(`No se pudo descargar la página (HTTP ${res.status})`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (contentType && !/text\/html|text\/plain|application\/xhtml/i.test(contentType)) {
    throw new Error('La dirección no devuelve una página de texto.')
  }

  const buffer = await res.arrayBuffer()
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error('La página es demasiado grande para importar.')
  }
  const html = new TextDecoder().decode(buffer)
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const text = htmlToText(html).slice(0, MAX_CHARS)

  return {
    title: titleMatch ? decodeEntities(titleMatch[1]).trim() : url,
    text,
  }
}
