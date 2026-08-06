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
