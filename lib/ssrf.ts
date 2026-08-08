import { lookup } from 'dns/promises'
import { isIP } from 'net'

/**
 * El importador de conocimiento descarga una URL que elige el usuario, desde el
 * servidor. Sin control, eso permite SSRF: apuntar a la metadata del cloud
 * (169.254.169.254 en AWS/GCP, que devuelve credenciales) o a servicios
 * internos que no están expuestos a internet.
 */

function ipv4IsPrivate(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number)
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  // Link-local, incluye la metadata del cloud (169.254.169.254).
  if (a === 169 && b === 254) return true
  // Carrier-grade NAT.
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

function ipv6IsPrivate(ip: string): boolean {
  const value = ip.toLowerCase().replace(/^\[|\]$/g, '')
  if (value === '::1' || value === '::') return true
  // Unique local (fc00::/7) y link-local (fe80::/10).
  if (/^f[cd]/.test(value) || /^fe[89ab]/.test(value)) return true
  // IPv4 mapeada: ::ffff:169.254.169.254
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return ipv4IsPrivate(mapped[1])
  return false
}

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) return ipv4IsPrivate(ip)
  if (isIP(ip) === 6) return ipv6IsPrivate(ip)
  return false
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string }

/**
 * Valida una URL antes de descargarla. Resuelve el DNS y revisa la IP real,
 * porque un dominio público puede apuntar a una dirección interna.
 */
export async function assertPublicUrl(raw: string): Promise<UrlCheck> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, reason: 'La URL no es válida.' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'Solo se pueden importar direcciones http o https.' }
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '')

  if (/^localhost$/i.test(hostname) || hostname.endsWith('.localhost')) {
    return { ok: false, reason: 'No se pueden importar direcciones internas.' }
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      return { ok: false, reason: 'No se pueden importar direcciones internas.' }
    }
    return { ok: true, url }
  }

  try {
    const resolved = await lookup(hostname, { all: true })
    if (resolved.length === 0) {
      return { ok: false, reason: 'No se pudo resolver el dominio.' }
    }
    if (resolved.some((entry) => isPrivateAddress(entry.address))) {
      return { ok: false, reason: 'No se pueden importar direcciones internas.' }
    }
  } catch {
    return { ok: false, reason: 'No se pudo resolver el dominio.' }
  }

  return { ok: true, url }
}
