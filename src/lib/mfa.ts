import { TOTP, generateSecret, generateURI } from 'otplib'
import { randomBytes } from 'crypto'

const totp = new TOTP({ window: 1 })

export function generateMfaSecret(): string {
  return generateSecret(32)
}

export function generateOtpAuthUri(secret: string, email: string): string {
  return generateURI({ type: 'totp', secret, label: email, issuer: 'SafeCheck AI' })
}

export async function verifyTotpToken(token: string, secret: string): Promise<boolean> {
  try {
    return await totp.verify({ token, secret })
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
