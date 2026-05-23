/**
 * Centralized environment validation.
 * Validates at module load time so the process never starts with missing secrets.
 * During Next.js build phase (NEXT_PHASE=phase-production-build) validation is
 * deferred — route handlers are never called at build time, so secrets aren't needed.
 */

const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build'

function requireEnv(name: string): string {
  if (IS_BUILD) return ''
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(
      `[env] Variable de entorno requerida no configurada: ${name}\n` +
      `Copia .env.example a .env y completa todos los valores antes de iniciar.`
    )
  }
  return value.trim()
}

function requireEnvMinLength(name: string, minLength: number): string {
  if (IS_BUILD) return ''
  const value = requireEnv(name)
  if (value.length < minLength) {
    throw new Error(
      `[env] ${name} debe tener al menos ${minLength} caracteres. ` +
      `Genera uno con: openssl rand -base64 64`
    )
  }
  return value
}

// ── Secrets de seguridad críticos ────────────────────────────────────────────
// Lanzar error al iniciar si faltan — nunca usar fallbacks en producción.

export const JWT_SECRET = requireEnvMinLength('JWT_SECRET', 32)
export const JWT_REFRESH_SECRET = requireEnvMinLength('JWT_REFRESH_SECRET', 32)
// QR_SECRET debe ser independiente de JWT_SECRET para limitar el blast radius
// si uno de los secrets se ve comprometido.
export const QR_SECRET = requireEnvMinLength('QR_SECRET', 32)

// ── Base de datos ─────────────────────────────────────────────────────────────
export const DATABASE_URL = requireEnv('DATABASE_URL')

// ── Configuración de aplicación ───────────────────────────────────────────────
export const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
export const NODE_ENV = process.env.NODE_ENV ?? 'development'
export const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER ?? 'local'
export const JOB_PROVIDER = process.env.JOB_PROVIDER ?? 'memory'
export const RATE_LIMIT_PROVIDER = process.env.RATE_LIMIT_PROVIDER ?? 'memory'
export const CACHE_PROVIDER = process.env.CACHE_PROVIDER ?? 'memory'

// ── Opcionales (con advertencia si faltan en producción) ──────────────────────

function warnIfMissingInProd(name: string): string | undefined {
  if (IS_BUILD) return undefined
  const value = process.env[name]
  if (!value && NODE_ENV === 'production') {
    console.warn(`[env] ADVERTENCIA: ${name} no configurado en producción.`)
  }
  return value ?? undefined
}

export const ANTHROPIC_API_KEY = warnIfMissingInProd('ANTHROPIC_API_KEY')
export const AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
export const AZURE_DOCUMENT_INTELLIGENCE_KEY = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY
export const SMTP_HOST = process.env.SMTP_HOST
export const RESEND_API_KEY = process.env.RESEND_API_KEY
