import { generateSecret, generateURI, verify } from 'otplib'
import { randomBytes } from 'crypto'

export function generateMfaSecret(): string {
  return generateSecret({ length: 20 })
}

export function generateOtpAuthUri(secret: string, email: string): string {
  return generateURI({ issuer: 'SafeCheck AI', label: email, secret })
}

export async function verifyTotpToken(token: string, secret: string): Promise<boolean> {
  try {
    const result = await verify({ token, secret, epochTolerance: 30 })
    return result.valid
  } catch {
    return false
  }
}

export function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () =>
    randomBytes(5).toString('hex').toUpperCase().replace(/(.{5})/, '$1-')
  )
}

export function verifyBackupCode(code: string, codes: string[]): { valid: boolean; remaining: string[] } {
  const normalized = code.toUpperCase().trim()
  const idx = codes.indexOf(normalized)
  if (idx === -1) return { valid: false, remaining: codes }
  const remaining = [...codes]
  remaining.splice(idx, 1)
  return { valid: true, remaining }
}
