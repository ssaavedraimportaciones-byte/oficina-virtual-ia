import { describe, it, expect } from 'vitest'
import {
  generateMfaSecret,
  generateOtpAuthUri,
  verifyTotpToken,
  generateBackupCodes,
  verifyBackupCode,
} from '@/lib/mfa'

describe('generateMfaSecret', () => {
  it('returns a non-empty string', () => {
    const s = generateMfaSecret()
    expect(typeof s).toBe('string')
    expect(s.length).toBeGreaterThan(10)
  })

  it('generates unique secrets each call', () => {
    expect(generateMfaSecret()).not.toBe(generateMfaSecret())
  })
})

describe('generateOtpAuthUri', () => {
  it('returns otpauth:// URI', () => {
    const uri = generateOtpAuthUri('SOMEBASE32SECRET', 'user@empresa.cl')
    expect(uri).toMatch(/^otpauth:\/\/totp\//)
    expect(uri).toContain('SafeCheck%20AI')
    expect(uri).toContain('user%40empresa.cl')
  })
})

describe('verifyTotpToken', () => {
  it('returns false for invalid token', async () => {
    const secret = generateMfaSecret()
    expect(await verifyTotpToken('000000', secret)).toBe(false)
  })

  it('returns false for malformed token', async () => {
    const secret = generateMfaSecret()
    expect(await verifyTotpToken('abc', secret)).toBe(false)
    expect(await verifyTotpToken('', secret)).toBe(false)
  })
})

describe('generateBackupCodes', () => {
  it('generates 8 codes by default', () => {
    const codes = generateBackupCodes()
    expect(codes).toHaveLength(8)
  })

  it('generates unique codes', () => {
    const codes = generateBackupCodes(10)
    const set = new Set(codes)
    expect(set.size).toBe(10)
  })

  it('codes have expected format (XXXXX-)', () => {
    const codes = generateBackupCodes()
    codes.forEach((c) => expect(c).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/))
  })
})

describe('verifyBackupCode', () => {
  it('accepts a valid backup code and removes it', () => {
    const codes = ['ABCDE-12345', 'FGHIJ-67890']
    const { valid, remaining } = verifyBackupCode('ABCDE-12345', codes)
    expect(valid).toBe(true)
    expect(remaining).toHaveLength(1)
    expect(remaining).not.toContain('ABCDE-12345')
  })

  it('rejects invalid code', () => {
    const codes = ['ABCDE-12345']
    const { valid, remaining } = verifyBackupCode('XXXXX-00000', codes)
    expect(valid).toBe(false)
    expect(remaining).toHaveLength(1)
  })

  it('is case-insensitive', () => {
    const codes = ['ABCDE-12345']
    const { valid } = verifyBackupCode('abcde-12345', codes)
    expect(valid).toBe(true)
  })

  it('returns empty remaining after last code used', () => {
    const codes = ['ABCDE-12345']
    const { valid, remaining } = verifyBackupCode('ABCDE-12345', codes)
    expect(valid).toBe(true)
    expect(remaining).toHaveLength(0)
  })
})
