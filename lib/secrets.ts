import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const PREFIX = 'enc:v1:'

/**
 * Los tokens de Meta se guardan cifrados con AES-256-GCM. GCM además autentica:
 * si alguien edita el archivo de datos a mano, el descifrado falla en vez de
 * devolver basura silenciosamente.
 */
function getKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) return null

  const key = /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64')

  if (key.length !== 32) {
    throw new Error(
      'ENCRYPTION_KEY debe ser de 32 bytes (64 caracteres hex, o base64). Generá una con: openssl rand -hex 32',
    )
  }
  return key
}

export function encryptionConfigured(): boolean {
  return Boolean(process.env.ENCRYPTION_KEY)
}

export function encryptSecret(plain: string): string {
  const key = getKey()
  if (!key) {
    throw new Error(
      'Falta ENCRYPTION_KEY: no se pueden guardar tokens sin cifrar. Generá una con: openssl rand -hex 32',
    )
  }

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return PREFIX + [iv, tag, encrypted].map((b) => b.toString('base64')).join('.')
}

/**
 * Devuelve el texto plano. Los valores guardados antes de activar el cifrado no
 * tienen prefijo y se devuelven tal cual, para no romper instalaciones que ya
 * tenían canales conectados.
 */
export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored

  const key = getKey()
  if (!key) {
    throw new Error('Hay tokens cifrados guardados pero falta ENCRYPTION_KEY para leerlos.')
  }

  const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split('.')
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('El token guardado está corrupto.')
  }

  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

export function encryptOptional(value: string | null): string | null {
  return value ? encryptSecret(value) : null
}

export function decryptOptional(value: string | null): string | null {
  if (!value) return null
  try {
    return decryptSecret(value)
  } catch {
    // Un token ilegible se trata como ausente: el canal queda desconectado en
    // vez de romper toda la app.
    return null
  }
}
