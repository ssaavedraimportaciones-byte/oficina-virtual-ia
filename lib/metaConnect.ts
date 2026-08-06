const GRAPH_VERSION = 'v20.0'

export interface DiscoveredWhatsAppNumber {
  id: string
  displayPhoneNumber: string
  verifiedName: string
}

export interface DiscoveredInstagramAccount {
  id: string
  username: string
  pageName: string
}

async function graph<T>(path: string, token: string): Promise<T> {
  const separator = path.includes('?') ? '&' : '?'
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${path}${separator}access_token=${encodeURIComponent(token)}`

  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new Error('No se pudo contactar a Meta. Revisá la conexión del servidor.')
  }

  const raw = await res.text()
  let data: (T & { error?: { message?: string } }) | null = null
  try {
    data = JSON.parse(raw)
  } catch {
    // Un proxy o una página de error pueden devolver algo que no es JSON.
    throw new Error(`Meta devolvió una respuesta inesperada (HTTP ${res.status}).`)
  }

  if (!res.ok || data?.error) {
    throw new Error(data?.error?.message || `Meta respondió ${res.status}`)
  }
  return data as T
}

interface MeBusinessesResponse {
  data?: Array<{
    owned_whatsapp_business_accounts?: {
      data?: Array<{
        phone_numbers?: {
          data?: Array<{ id: string; display_phone_number?: string; verified_name?: string }>
        }
      }>
    }
  }>
}

/**
 * Lista los números de WhatsApp a los que da acceso el token, para que el
 * usuario elija de una lista en vez de tener que buscar el phone number ID a
 * mano en el panel de Meta.
 */
export async function discoverWhatsAppNumbers(
  token: string,
): Promise<DiscoveredWhatsAppNumber[]> {
  const fields =
    'owned_whatsapp_business_accounts{phone_numbers{id,display_phone_number,verified_name}}'
  const data = await graph<MeBusinessesResponse>(
    `me/businesses?fields=${encodeURIComponent(fields)}`,
    token,
  )

  const numbers: DiscoveredWhatsAppNumber[] = []
  for (const business of data.data ?? []) {
    for (const waba of business.owned_whatsapp_business_accounts?.data ?? []) {
      for (const phone of waba.phone_numbers?.data ?? []) {
        numbers.push({
          id: phone.id,
          displayPhoneNumber: phone.display_phone_number ?? phone.id,
          verifiedName: phone.verified_name ?? '',
        })
      }
    }
  }
  return numbers
}

interface MeAccountsResponse {
  data?: Array<{
    name?: string
    instagram_business_account?: { id: string; username?: string }
  }>
}

/**
 * Lista las cuentas de Instagram Business/Creator vinculadas a las páginas a
 * las que da acceso el token.
 */
export async function discoverInstagramAccounts(
  token: string,
): Promise<DiscoveredInstagramAccount[]> {
  const fields = 'name,instagram_business_account{id,username}'
  const data = await graph<MeAccountsResponse>(
    `me/accounts?fields=${encodeURIComponent(fields)}`,
    token,
  )

  const accounts: DiscoveredInstagramAccount[] = []
  for (const page of data.data ?? []) {
    const ig = page.instagram_business_account
    if (!ig) continue
    accounts.push({
      id: ig.id,
      username: ig.username ?? ig.id,
      pageName: page.name ?? '',
    })
  }
  return accounts
}

/** Confirma que el par (número, token) funciona antes de guardarlo. */
export async function verifyWhatsAppNumber(
  phoneNumberId: string,
  token: string,
): Promise<{ displayPhoneNumber: string; verifiedName: string }> {
  const data = await graph<{ display_phone_number?: string; verified_name?: string }>(
    `${phoneNumberId}?fields=display_phone_number,verified_name`,
    token,
  )
  return {
    displayPhoneNumber: data.display_phone_number ?? phoneNumberId,
    verifiedName: data.verified_name ?? '',
  }
}

/** Confirma que el par (cuenta de Instagram, token) funciona antes de guardarlo. */
export async function verifyInstagramAccount(
  accountId: string,
  token: string,
): Promise<{ username: string }> {
  const data = await graph<{ username?: string }>(`${accountId}?fields=username`, token)
  return { username: data.username ?? accountId }
}
