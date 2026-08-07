import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

/**
 * TOTP (RFC 6238) sobre HOTP (RFC 4226), implementado a mano con el crypto
 * de Node — mismo criterio que scrypt en vez de bcrypt en lib/auth.ts: no
 * sumar una dependencia para algo que son ~40 líneas de HMAC y aritmética.
 * Códigos de 6 dígitos, paso de 30s, algoritmo SHA-1 (el que entienden todas
 * las apps de autenticación: Google Authenticator, Authy, 1Password, etc.).
 */

const STEP_SECONDS = 30
const DIGITS = 6
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buffer: Buffer): string {
  let bits = ''
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0')

  let output = ''
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)]
  }
  const remainder = bits.length % 5
  if (remainder > 0) {
    const lastChunk = bits.slice(bits.length - remainder).padEnd(5, '0')
    output += BASE32_ALPHABET[parseInt(lastChunk, 2)]
  }
  return output
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = ''
  for (const char of clean) {
    const value = BASE32_ALPHABET.indexOf(char)
    if (value === -1) continue
    bits += value.toString(2).padStart(5, '0')
  }

  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2))
  }
  return Buffer.from(bytes)
}

function hotp(secret: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(BigInt(counter))

  const hmac = createHmac('sha1', secret).update(counterBuffer).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  return String(code % 10 ** DIGITS).padStart(DIGITS, '0')
}

/** Secreto nuevo en base32, listo para guardar (cifrado) y para mostrar/escanear. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20))
}

export function currentTotpCode(secretBase32: string, at: number = Date.now()): string {
  const counter = Math.floor(at / 1000 / STEP_SECONDS)
  return hotp(base32Decode(secretBase32), counter)
}

/**
 * Acepta el paso actual y uno antes/después (±30s) para tolerar que el reloj
 * del celular de la persona no esté perfectamente sincronizado.
 */
export function verifyTotpCode(secretBase32: string, token: string, at: number = Date.now()): boolean {
  const clean = token.trim()
  if (!/^\d{6}$/.test(clean)) return false

  const counter = Math.floor(at / 1000 / STEP_SECONDS)
  const secret = base32Decode(secretBase32)

  for (const drift of [0, -1, 1]) {
    const step = counter + drift
    if (step < 0) continue
    const expected = hotp(secret, step)
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) return true
  }
  return false
}

/** URI estándar que entienden las apps de autenticación al escanear un QR o pegarlo a mano. */
export function totpAuthUrl(secretBase32: string, email: string, issuer = 'AgentsApp'): string {
  const label = encodeURIComponent(`${issuer}:${email}`)
  const params = new URLSearchParams({ secret: secretBase32, issuer, algorithm: 'SHA1', digits: '6', period: '30' })
  return `otpauth://totp/${label}?${params.toString()}`
}
