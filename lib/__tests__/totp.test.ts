import { describe, expect, it } from 'vitest'
import { currentTotpCode, generateTotpSecret, totpAuthUrl, verifyTotpCode } from '../totp'

// Secreto de los vectores de prueba oficiales de la RFC 6238 (apéndice B):
// la clave ASCII "12345678901234567890", codificada a base32 porque nuestra
// implementación siempre guarda/recibe el secreto en base32.
function base32Of(ascii: string): string {
  // Reimplementación mínima solo para el test (no exportada por lib/totp):
  // evita depender de un símbolo interno del módulo.
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const byte of Buffer.from(ascii, 'ascii')) bits += byte.toString(2).padStart(8, '0')
  let output = ''
  for (let i = 0; i + 5 <= bits.length; i += 5) output += ALPHABET[parseInt(bits.slice(i, i + 5), 2)]
  const remainder = bits.length % 5
  if (remainder > 0) output += ALPHABET[parseInt(bits.slice(bits.length - remainder).padEnd(5, '0'), 2)]
  return output
}

const RFC_SECRET = base32Of('12345678901234567890')

describe('currentTotpCode contra los vectores oficiales de la RFC 6238', () => {
  // La RFC define códigos de 8 dígitos; acá se truncan a 6 (últimos 6 del
  // mismo valor binario), que es lo que usan las apps de autenticación reales.
  const cases: [number, string][] = [
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ]

  it.each(cases)('T=%i produce %s', (unixSeconds, expected) => {
    expect(currentTotpCode(RFC_SECRET, unixSeconds * 1000)).toBe(expected)
  })
})

describe('verifyTotpCode', () => {
  it('acepta el código del paso actual', () => {
    const code = currentTotpCode(RFC_SECRET, 59_000)
    expect(verifyTotpCode(RFC_SECRET, code, 59_000)).toBe(true)
  })

  it('tolera un paso de diferencia (reloj desincronizado)', () => {
    const code = currentTotpCode(RFC_SECRET, 59_000)
    expect(verifyTotpCode(RFC_SECRET, code, 59_000 + 30_000)).toBe(true)
    expect(verifyTotpCode(RFC_SECRET, code, 59_000 - 30_000)).toBe(true)
  })

  it('rechaza un código de dos pasos de diferencia', () => {
    const code = currentTotpCode(RFC_SECRET, 59_000)
    expect(verifyTotpCode(RFC_SECRET, code, 59_000 + 90_000)).toBe(false)
  })

  it('rechaza un código incorrecto o con formato inválido', () => {
    expect(verifyTotpCode(RFC_SECRET, '000000', 59_000)).toBe(false)
    expect(verifyTotpCode(RFC_SECRET, 'abcdef', 59_000)).toBe(false)
    expect(verifyTotpCode(RFC_SECRET, '12345', 59_000)).toBe(false)
  })
})

describe('generateTotpSecret', () => {
  it('genera secretos distintos y en formato base32 válido', () => {
    const a = generateTotpSecret()
    const b = generateTotpSecret()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Z2-7]+$/)
  })

  it('un secreto generado sirve para verificar su propio código', () => {
    const secret = generateTotpSecret()
    const code = currentTotpCode(secret)
    expect(verifyTotpCode(secret, code)).toBe(true)
  })
})

describe('totpAuthUrl', () => {
  it('arma una URI otpauth:// válida con el email y el secreto', () => {
    const url = totpAuthUrl('ABCDEFGHIJKLMNOP', 'dueño@negocio.com')
    expect(url).toMatch(/^otpauth:\/\/totp\//)
    expect(url).toContain('secret=ABCDEFGHIJKLMNOP')
    expect(url).toContain('issuer=AgentsApp')
  })
})
