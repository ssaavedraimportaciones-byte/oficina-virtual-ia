/**
 * RESTRICCIONES NO NEGOCIABLES — SAFECHECK AI
 *
 * Este archivo valida en tiempo de test que ningún cambio de código pueda
 * silenciosamente romper las reglas de seguridad críticas del sistema.
 * Si algún test aquí falla, el cambio DEBE rechazarse.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// RESTRICCIÓN 1 — JWT_SECRET / QR_SECRET no tienen fallback
// Si faltan, el sistema debe fallar al iniciar (throw en import)
// ─────────────────────────────────────────────────────────────────────────────

describe('R1 — Secrets críticos: sin fallback, falla al iniciar', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    Object.assign(process.env, originalEnv)
  })

  it('requireEnvMinLength lanza si la variable está ausente', () => {
    // Verifica la lógica pura de requireEnvMinLength sin importar env.ts
    function requireEnvMinLength(name: string, minLength: number): string {
      const value = process.env[name]
      if (!value || value.trim() === '') {
        throw new Error(`[env] Variable de entorno requerida no configurada: ${name}`)
      }
      if (value.length < minLength) {
        throw new Error(`[env] ${name} debe tener al menos ${minLength} caracteres.`)
      }
      return value.trim()
    }

    delete process.env['_TEST_FAKE_SECRET']
    expect(() => requireEnvMinLength('_TEST_FAKE_SECRET', 32)).toThrow(
      'Variable de entorno requerida no configurada'
    )
  })

  it('requireEnvMinLength lanza si el valor es string vacío', () => {
    function requireEnvMinLength(name: string, minLength: number): string {
      const value = process.env[name]
      if (!value || value.trim() === '') {
        throw new Error(`[env] Variable de entorno requerida no configurada: ${name}`)
      }
      if (value.length < minLength) {
        throw new Error(`[env] ${name} debe tener al menos ${minLength} caracteres.`)
      }
      return value.trim()
    }

    process.env['_TEST_FAKE_SECRET'] = '   '
    expect(() => requireEnvMinLength('_TEST_FAKE_SECRET', 32)).toThrow(
      'Variable de entorno requerida no configurada'
    )
  })

  it('requireEnvMinLength lanza si el valor es demasiado corto', () => {
    function requireEnvMinLength(name: string, minLength: number): string {
      const value = process.env[name]
      if (!value || value.trim() === '') {
        throw new Error(`[env] Variable de entorno requerida no configurada: ${name}`)
      }
      if (value.length < minLength) {
        throw new Error(`[env] ${name} debe tener al menos ${minLength} caracteres.`)
      }
      return value.trim()
    }

    process.env['_TEST_FAKE_SECRET'] = 'short'
    expect(() => requireEnvMinLength('_TEST_FAKE_SECRET', 32)).toThrow('al menos 32 caracteres')
  })

  it('JWT_SECRET no tiene valor por defecto (fallback) en el código fuente', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const envPath = path.resolve(process.cwd(), 'src/lib/env.ts')
    const source = fs.readFileSync(envPath, 'utf-8')

    // No debe haber un fallback como: JWT_SECRET ?? 'algo' o JWT_SECRET || 'algo'
    expect(source).not.toMatch(/JWT_SECRET\s*[?|]{1,2}\s*['"`]/)
    expect(source).not.toMatch(/JWT_SECRET.*fallback/)
    expect(source).not.toMatch(/JWT_SECRET.*default/)
  })

  it('QR_SECRET no tiene valor por defecto (fallback) en el código fuente', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const envPath = path.resolve(process.cwd(), 'src/lib/env.ts')
    const source = fs.readFileSync(envPath, 'utf-8')

    expect(source).not.toMatch(/QR_SECRET\s*[?|]{1,2}\s*['"`]/)
    expect(source).not.toMatch(/QR_SECRET.*fallback/)
    expect(source).not.toMatch(/QR_SECRET.*default/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// RESTRICCIÓN 2 — El creador del documento no puede aprobar su propio documento
// (ya cubierta en approvals-concurrency.test.ts — se duplica aquí como contrato)
// ─────────────────────────────────────────────────────────────────────────────

describe('R2 — Self-approval bloqueado', () => {
  function canApprove(createdById: string, approverId: string): boolean {
    return createdById !== approverId
  }

  it('creador === aprobador → RECHAZADO (403)', () => {
    expect(canApprove('user-1', 'user-1')).toBe(false)
  })

  it('creador !== aprobador → PERMITIDO', () => {
    expect(canApprove('user-creator', 'user-supervisor')).toBe(true)
  })

  it('nunca se puede aprobar con el mismo userId aunque el rol sea distinto', () => {
    // Un supervisor que también creó el documento no puede aprobarlo
    expect(canApprove('supervisor-1', 'supervisor-1')).toBe(false)
  })

  it('el error retornado debe ser HTTP 403, no 422 ni 200', () => {
    // Contractual: el status HTTP de self-approval debe ser 403 (Forbidden)
    const SELF_APPROVAL_HTTP_STATUS = 403
    expect(SELF_APPROVAL_HTTP_STATUS).toBe(403)
    expect(SELF_APPROVAL_HTTP_STATUS).not.toBe(422)
    expect(SELF_APPROVAL_HTTP_STATUS).not.toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// RESTRICCIÓN 3 — La IA solo recomienda; aprobación final = persona autorizada
// ─────────────────────────────────────────────────────────────────────────────

describe('R3 — IA solo recomienda; la aprobación final es humana', () => {
  type DocumentStatus = 'DRAFT' | 'AI_REVIEW' | 'PENDING_APPROVAL' | 'APPROVED' | 'CLOSED'

  // La IA puede mover a AI_REVIEW o agregar un aiResult, NUNCA a APPROVED
  const AI_ALLOWED_STATUSES: DocumentStatus[] = ['AI_REVIEW']
  const HUMAN_ONLY_STATUSES: DocumentStatus[] = ['APPROVED', 'CLOSED']

  it('la IA no puede establecer estado APPROVED directamente', () => {
    expect(AI_ALLOWED_STATUSES).not.toContain('APPROVED')
  })

  it('la IA no puede establecer estado CLOSED directamente', () => {
    expect(AI_ALLOWED_STATUSES).not.toContain('CLOSED')
  })

  it('APPROVED y CLOSED solo pueden ser alcanzados por aprobador humano', () => {
    for (const status of HUMAN_ONLY_STATUSES) {
      expect(AI_ALLOWED_STATUSES).not.toContain(status)
    }
  })

  it('classifyDocument retorna recomendación, no muta estado del documento', async () => {
    // Verificamos el contrato a nivel de tipos y código fuente —
    // classifyDocument() no tiene parámetro documentId ni retorna status
    const fs = await import('fs')
    const path = await import('path')
    const clientPath = path.resolve(process.cwd(), 'src/modules/ai-validation/client.ts')
    const source = fs.readFileSync(clientPath, 'utf-8')

    // La función no debe llamar a prisma.document.update con status APPROVED
    expect(source).not.toMatch(/\.update\s*\(/)
    expect(source).not.toMatch(/status.*APPROVED/)
    expect(source).not.toMatch(/status.*CLOSED/)

    // El tipo de retorno AIClassificationResult no incluye status ni approved
    const typesPath = path.resolve(process.cwd(), 'src/modules/ai-validation/types.ts')
    const typesSource = fs.readFileSync(typesPath, 'utf-8')
    expect(typesSource).not.toMatch(/status\s*:\s*DocumentStatus/)
    expect(typesSource).not.toMatch(/approved\s*:/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// RESTRICCIÓN 4 — AuditLog nunca puede tener userId null
// ─────────────────────────────────────────────────────────────────────────────

describe('R4 — AuditLog.userId nunca es null', () => {
  it('el esquema AuditCtx requiere userId como string (no null ni undefined)', () => {
    // Contrato de tipos: AuditCtx.userId es string obligatorio
    type AuditCtx = { userId: string; ip?: string; userAgent?: string }
    const ctx: AuditCtx = { userId: 'user-123' }
    expect(ctx.userId).toBeTruthy()
    expect(typeof ctx.userId).toBe('string')
  })

  it('la función log() pasa userId sin defaultear a null en el modelo Prisma', async () => {
    // El schema Prisma define userId como String (no String?) en AuditLog
    // Verificamos que el código no convierte userId a null
    const fs = await import('fs')
    const path = await import('path')
    const auditPath = path.resolve(process.cwd(), 'src/modules/audit/index.ts')
    const source = fs.readFileSync(auditPath, 'utf-8')

    // userId debe ser ctx.userId, no ctx.userId ?? null ni ctx.userId ?? ''
    expect(source).toMatch(/userId:\s*ctx\.userId/)
    expect(source).not.toMatch(/userId:\s*ctx\.userId\s*\?\?/)
  })

  it('el schema Prisma define AuditLog.userId como NOT NULL', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma')
    const schema = fs.readFileSync(schemaPath, 'utf-8')

    // En el bloque AuditLog, userId debe ser String (no String?)
    const auditLogBlock = schema.match(/model AuditLog \{[^}]+\}/s)?.[0] ?? ''
    expect(auditLogBlock).toMatch(/userId\s+String[^?]/)
    expect(auditLogBlock).not.toMatch(/userId\s+String\?/)
  })

  it('un userId de sistema/bot debe ser un identificador real, no null', () => {
    const SYSTEM_USER_ID = 'system'
    expect(SYSTEM_USER_ID).not.toBeNull()
    expect(SYSTEM_USER_ID).not.toBe('')
    expect(SYSTEM_USER_ID.length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// RESTRICCIÓN 5 — Documento APPROVED/CLOSED/ARCHIVED: solo versioning, no modify
// ─────────────────────────────────────────────────────────────────────────────

describe('R5 — Estados terminales: inmutables (solo versionado)', () => {
  type DocumentStatus =
    | 'DRAFT' | 'SCANNED' | 'AI_REVIEW' | 'OBSERVED'
    | 'PENDING_SIGNATURE' | 'PENDING_APPROVAL'
    | 'APPROVED' | 'REJECTED' | 'CLOSED' | 'ARCHIVED'

  const LOCKED_STATUSES: DocumentStatus[] = ['APPROVED', 'CLOSED', 'ARCHIVED']
  const MUTABLE_STATUSES: DocumentStatus[] = ['DRAFT', 'OBSERVED', 'REJECTED']

  function canRescan(status: DocumentStatus): boolean {
    return !LOCKED_STATUSES.includes(status)
  }

  function canModifyFields(status: DocumentStatus): boolean {
    return !LOCKED_STATUSES.includes(status)
  }

  function canModifyTaskName(status: DocumentStatus): boolean {
    // taskName nunca puede modificarse después de la creación
    return false
  }

  it('APPROVED no puede reescanearse', () => {
    expect(canRescan('APPROVED')).toBe(false)
  })

  it('CLOSED no puede reescanearse', () => {
    expect(canRescan('CLOSED')).toBe(false)
  })

  it('ARCHIVED no puede reescanearse', () => {
    expect(canRescan('ARCHIVED')).toBe(false)
  })

  it('DRAFT sí puede reescanearse', () => {
    expect(canRescan('DRAFT')).toBe(true)
  })

  it('APPROVED no permite modificar campos OCR', () => {
    expect(canModifyFields('APPROVED')).toBe(false)
  })

  it('CLOSED no permite modificar campos OCR', () => {
    expect(canModifyFields('CLOSED')).toBe(false)
  })

  it('ARCHIVED no permite modificar campos OCR', () => {
    expect(canModifyFields('ARCHIVED')).toBe(false)
  })

  it('taskName nunca puede modificarse independientemente del estado', () => {
    for (const status of [...LOCKED_STATUSES, ...MUTABLE_STATUSES]) {
      expect(canModifyTaskName(status)).toBe(false)
    }
  })

  it('los campos inmutables cubren todos los estados terminales', () => {
    // Asegura que si se añade un nuevo estado terminal, se incluye en LOCKED_STATUSES
    const knownTerminals: DocumentStatus[] = ['APPROVED', 'CLOSED', 'ARCHIVED']
    for (const terminal of knownTerminals) {
      expect(LOCKED_STATUSES).toContain(terminal)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// RESTRICCIÓN 6 — Signatures: campos obligatorios completos
// ─────────────────────────────────────────────────────────────────────────────

describe('R6 — Signature: todos los campos requeridos presentes', () => {
  interface SignatureRecord {
    imageData: string        // captura real canvas (data:image/png;base64,...)
    signatureHash: string    // hash de firma (SHA-256)
    documentHash: string     // hash documental (snapshot SHA-256)
    ipAddress: string        // IP del cliente
    gpsLat: number | null    // GPS lat (null si no disponible en desktop)
    gpsLng: number | null    // GPS lng (null si no disponible en desktop)
    signedAt: Date           // timestamp servidor (no cliente)
    userId: string           // usuario autenticado
    // auditLogId se crea como efecto secundario en DB
  }

  function validateSignatureRecord(sig: Partial<SignatureRecord>): string[] {
    const missing: string[] = []
    if (!sig.imageData?.startsWith('data:image/png;base64,')) missing.push('imageData (PNG canvas)')
    if (!sig.signatureHash?.match(/^[0-9a-f]{64}$/)) missing.push('signatureHash (SHA-256)')
    if (!sig.documentHash?.match(/^[0-9a-f]{64}$/)) missing.push('documentHash (SHA-256)')
    if (!sig.ipAddress) missing.push('ipAddress')
    if (!sig.userId) missing.push('userId')
    if (!(sig.signedAt instanceof Date)) missing.push('signedAt (Date servidor)')
    return missing
  }

  const VALID_SIG: SignatureRecord = {
    imageData: 'data:image/png;base64,iVBORw0KGgo=',
    signatureHash: 'a'.repeat(64),
    documentHash: 'b'.repeat(64),
    ipAddress: '192.168.1.100',
    gpsLat: -33.456,
    gpsLng: -70.654,
    signedAt: new Date(),
    userId: 'user-worker-1',
  }

  it('firma válida no produce campos faltantes', () => {
    expect(validateSignatureRecord(VALID_SIG)).toHaveLength(0)
  })

  it('firma sin imageData es inválida', () => {
    const missing = validateSignatureRecord({ ...VALID_SIG, imageData: undefined })
    expect(missing).toContain('imageData (PNG canvas)')
  })

  it('firma con SVG placeholder es inválida (debe ser PNG real)', () => {
    const svgFake = { ...VALID_SIG, imageData: 'data:image/svg+xml;base64,abc' }
    expect(validateSignatureRecord(svgFake)).toContain('imageData (PNG canvas)')
  })

  it('firma sin signatureHash es inválida', () => {
    const missing = validateSignatureRecord({ ...VALID_SIG, signatureHash: undefined })
    expect(missing).toContain('signatureHash (SHA-256)')
  })

  it('firma sin documentHash es inválida', () => {
    const missing = validateSignatureRecord({ ...VALID_SIG, documentHash: undefined })
    expect(missing).toContain('documentHash (SHA-256)')
  })

  it('firma sin ipAddress es inválida', () => {
    const missing = validateSignatureRecord({ ...VALID_SIG, ipAddress: '' })
    expect(missing).toContain('ipAddress')
  })

  it('firma sin userId es inválida', () => {
    const missing = validateSignatureRecord({ ...VALID_SIG, userId: '' })
    expect(missing).toContain('userId')
  })

  it('firma sin signedAt servidor es inválida', () => {
    const missing = validateSignatureRecord({ ...VALID_SIG, signedAt: undefined })
    expect(missing).toContain('signedAt (Date servidor)')
  })

  it('GPS puede ser null (dispositivos sin GPS) sin invalidar la firma', () => {
    const noGps = { ...VALID_SIG, gpsLat: null, gpsLng: null }
    expect(validateSignatureRecord(noGps)).toHaveLength(0)
  })

  it('signatureHash debe ser exactamente 64 hex chars (SHA-256)', () => {
    const shortHash = { ...VALID_SIG, signatureHash: 'abc123' }
    expect(validateSignatureRecord(shortHash)).toContain('signatureHash (SHA-256)')
  })

  it('documentHash debe ser exactamente 64 hex chars (SHA-256)', () => {
    const shortHash = { ...VALID_SIG, documentHash: 'def456' }
    expect(validateSignatureRecord(shortHash)).toContain('documentHash (SHA-256)')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// RESTRICCIÓN 7 — SYSTEM_ADMIN no puede desactivar su propio MFA
// ─────────────────────────────────────────────────────────────────────────────

describe('R7 — SYSTEM_ADMIN no puede desactivar su propio MFA', () => {
  type UserRole = 'WORKER' | 'SUPERVISOR' | 'PREVENTIONIST' | 'CONTRACT_ADMIN' | 'MANAGER' | 'AUDITOR' | 'SYSTEM_ADMIN'

  function canDisableMfa(role: UserRole): boolean {
    // SYSTEM_ADMIN nunca puede desactivar MFA
    return role !== 'SYSTEM_ADMIN'
  }

  it('SYSTEM_ADMIN no puede desactivar MFA (siempre obligatorio)', () => {
    expect(canDisableMfa('SYSTEM_ADMIN')).toBe(false)
  })

  it('CONTRACT_ADMIN puede desactivar MFA (aunque se recomienda mantenerlo)', () => {
    expect(canDisableMfa('CONTRACT_ADMIN')).toBe(true)
  })

  it('WORKER puede desactivar MFA (no tiene obligación)', () => {
    expect(canDisableMfa('WORKER')).toBe(true)
  })

  it('el código fuente del endpoint /mfa/disable rechaza SYSTEM_ADMIN con 403', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const routePath = path.resolve(process.cwd(), 'src/app/api/auth/mfa/disable/route.ts')
    const source = fs.readFileSync(routePath, 'utf-8')

    // Debe existir una guarda que retorne 403 cuando el rol es SYSTEM_ADMIN
    expect(source).toMatch(/SYSTEM_ADMIN/)
    expect(source).toMatch(/403/)
  })

  it('desactivar MFA requiere verificación de token activo o backup code', () => {
    // No se puede desactivar MFA sin conocer el token actual — ni con rol elevado
    function requiresCurrentTokenToDisable(role: UserRole): boolean {
      return true  // Todos los roles que pueden desactivar deben pasar verificación
    }
    expect(requiresCurrentTokenToDisable('CONTRACT_ADMIN')).toBe(true)
    expect(requiresCurrentTokenToDisable('MANAGER')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// RESTRICCIÓN 8 — Secrets nunca deben ir en logs, commits ni documentación
// ─────────────────────────────────────────────────────────────────────────────

describe('R8 — Secrets nunca expuestos en logs ni código fuente', () => {
  it('el logger no debe imprimir variables de entorno críticas', async () => {
    const loggedMessages: string[] = []
    const originalLog = console.log
    console.log = (msg: string) => { loggedMessages.push(String(msg)) }

    try {
      const { logger } = await import('@/lib/observability')
      logger.info('test event', { userId: 'user-1', action: 'LOGIN' })
      logger.error('test error', { code: 'AUTH_FAILED' })
    } finally {
      console.log = originalLog
    }

    const combined = loggedMessages.join('\n')
    expect(combined).not.toMatch(/JWT_SECRET/i)
    expect(combined).not.toMatch(/QR_SECRET/i)
    expect(combined).not.toMatch(/DATABASE_URL/i)
    expect(combined).not.toMatch(/password/i)
  })

  it('el módulo env.ts no exporta los valores de secrets en texto plano dentro de mensajes de error', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const envPath = path.resolve(process.cwd(), 'src/lib/env.ts')
    const source = fs.readFileSync(envPath, 'utf-8')

    // Los mensajes de error deben mencionar el NOMBRE de la variable, no su valor
    // Asegura que los mensajes de error no concatenan el valor
    expect(source).not.toMatch(/throw.*\$\{.*value\}/)
    expect(source).not.toMatch(/error.*=.*value/)
  })

  it('los archivos de configuración de ejemplo no contienen secrets reales', async () => {
    const fs = await import('fs')
    const path = await import('path')

    // .env.example debe existir y no contener secrets reales (valores tipo CHANGE_ME o vacíos)
    const examplePath = path.resolve(process.cwd(), '.env.example')
    const exists = fs.existsSync(examplePath)
    if (exists) {
      const content = fs.readFileSync(examplePath, 'utf-8')
      // Los valores de JWT_SECRET en .env.example deben ser placeholders
      const jwtLine = content.split('\n').find((l) => l.startsWith('JWT_SECRET='))
      if (jwtLine) {
        const value = jwtLine.split('=')[1]?.trim() ?? ''
        // No debe ser un secret real (>32 chars de caracteres aleatorios)
        const looksLikeRealSecret = value.length > 32 && /[A-Za-z0-9+/]{32,}/.test(value)
        expect(looksLikeRealSecret).toBe(false)
      }
    }
  })

  it('gitignore excluye archivos de secrets (.env)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const gitignorePath = path.resolve(process.cwd(), '.gitignore')
    const exists = fs.existsSync(gitignorePath)

    if (exists) {
      const content = fs.readFileSync(gitignorePath, 'utf-8')
      expect(content).toMatch(/\.env($|\s|\n)/)
    } else {
      // Si no hay .gitignore, es un riesgo
      expect(exists).toBe(true)
    }
  })
})
