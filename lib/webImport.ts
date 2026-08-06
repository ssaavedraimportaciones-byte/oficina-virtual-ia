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

export async function importPageText(url: string): Promise<{ title: string; text: string }> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AgentsAppBot/1.0)' },
  })
  if (!res.ok) {
    throw new Error(`No se pudo descargar la página (HTTP ${res.status})`)
  }

  const html = await res.text()
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const text = htmlToText(html).slice(0, MAX_CHARS)

  return {
    title: titleMatch ? decodeEntities(titleMatch[1]).trim() : url,
    text,
  }
}
