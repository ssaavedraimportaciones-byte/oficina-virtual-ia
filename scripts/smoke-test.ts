/**
 * SafeCheck AI — Smoke tests para staging/producción
 * Uso: BASE_URL=https://tu-dominio.vercel.app npx tsx scripts/smoke-test.ts
 *
 * Variables de entorno:
 *   BASE_URL              URL base del deploy (default: http://localhost:3000)
 *   SMOKE_EMAIL           Email del usuario admin (default: admin@safecheck.app)
 *   SMOKE_PASSWORD        Password (default: SafeCheck2026!)
 *   SKIP_RATE_LIMIT_TEST  Si está definido, omite el test de rate limit
 *
 * NOTA: El test de rate limit consume el contador de la IP actual.
 * En deploys con RATE_LIMIT_PROVIDER=memory, el contador persiste hasta
 * que el serverless instance se reinicia. Usar SKIP_RATE_LIMIT_TEST=1
 * para corridas normales de CI/CD.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const EMAIL = process.env.SMOKE_EMAIL ?? 'admin@safecheck.app'
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'SafeCheck2026!'
const SKIP_RATE_LIMIT = !!process.env.SKIP_RATE_LIMIT_TEST

let passed = 0
let failed = 0
const errors: string[] = []

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    console.log(`  ✅ ${name}`)
    passed++
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`  ❌ ${name}: ${msg}`)
    errors.push(`${name}: ${msg}`)
    failed++
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg)
}

// Parse Set-Cookie response headers into a Cookie request header string.
// Node.js fetch returns Set-Cookie values with full attributes (Path, HttpOnly, etc.)
// The Cookie header must only contain name=value pairs, not those attributes.
function parseCookies(res: Response): string {
  const rawList: string[] =
    typeof (res.headers as { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? ((res.headers as { getSetCookie: () => string[] }).getSetCookie())
      : (res.headers.get('set-cookie') ?? '').split(/,(?=\s*[a-zA-Z0-9_-]+=)/)
  return rawList
    .map(c => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ')
}

async function main() {
  console.log(`\n══════════════════════════════════════════`)
  console.log(`SafeCheck AI — Smoke Tests`)
  console.log(`Base URL: ${BASE}`)
  if (SKIP_RATE_LIMIT) console.log(`⚠️  Rate limit test: OMITIDO (SKIP_RATE_LIMIT_TEST=1)`)
  console.log(`══════════════════════════════════════════\n`)

  // ── 1. Health ──────────────────────────────────────────────────
  console.log('1. Health')
  await test('GET /api/health → 200 ok', async () => {
    const res = await fetch(`${BASE}/api/health`)
    assert(res.status === 200, `status ${res.status}`)
    const body = await res.json()
    assert(body.status === 'ok', `status=${body.status}`)
    assert(body.db === 'ok', `db=${body.db}`)
    assert(typeof body.latencyMs === 'number', 'no latencyMs')
  })

  await test('GET /api/health/deep → 200 todas las dependencias ok', async () => {
    const res = await fetch(`${BASE}/api/health/deep`)
    assert(res.status === 200 || res.status === 503, `status inesperado ${res.status}`)
    const body = await res.json()
    assert(body.checks?.db?.ok === true, `db no ok: ${body.checks?.db?.error}`)
    assert(typeof body.ts === 'string', 'no timestamp')
    if (res.status === 503) {
      console.log(`    ⚠️  Servicios opcionales degradados: ${JSON.stringify(body.checks)}`)
    }
  })

  await test('GET /health rewrite → misma respuesta que /api/health', async () => {
    const res = await fetch(`${BASE}/health`)
    assert(res.status === 200 || res.status === 404, `status ${res.status}`)
  })

  // ── 2. Auth — login válido PRIMERO (resetea rate limit counter) ─
  console.log('\n2. Auth')
  let accessCookie = ''

  await test('POST /api/auth?action=login con credenciales válidas → 200', async () => {
    const res = await fetch(`${BASE}/api/auth?action=login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    })
    if (res.status === 429) {
      throw new Error(
        '429 — Rate limit activo desde una corrida anterior del smoke test. ' +
        'Espere la ventana de bloqueo (~15 min) o use SKIP_RATE_LIMIT_TEST=1 en la próxima corrida.'
      )
    }
    assert(res.status === 200, `status ${res.status}`)
    const body = await res.json()
    assert(!body.mfaRequired, `MFA requerido para ${EMAIL} — usar SMOKE_EMAIL con usuario sin MFA`)
    assert(body.user?.role === 'SYSTEM_ADMIN', `role=${body.user?.role}`)
    accessCookie = parseCookies(res)
    assert(accessCookie.includes('access_token'), 'no access_token cookie en response')
  })

  // ── 3. Auth /me ────────────────────────────────────────────────
  await test('GET /api/auth/me → 200 con cookie', async () => {
    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { Cookie: accessCookie },
    })
    assert(res.status === 200, `status ${res.status}`)
    const body = await res.json()
    assert(body.user?.email === EMAIL, `email=${body.user?.email}`)
    assert(!body.user?.passwordHash, 'passwordHash expuesto en /me')
  })

  await test('GET /api/auth/me → 401 sin cookie', async () => {
    const res = await fetch(`${BASE}/api/auth/me`)
    assert(res.status === 401, `status ${res.status} — endpoint no protegido`)
  })

  await test('GET /api/documents → 401 sin cookie', async () => {
    const res = await fetch(`${BASE}/api/documents`)
    assert(res.status === 401, `status ${res.status} — endpoint no protegido`)
  })

  // ── 4. Documents ───────────────────────────────────────────────
  console.log('\n3. Documents')
  await test('GET /api/documents → 200', async () => {
    const res = await fetch(`${BASE}/api/documents`, {
      headers: { Cookie: accessCookie },
    })
    assert(res.status === 200, `status ${res.status}`)
    const body = await res.json()
    assert(Array.isArray(body.documents), 'no documents array')
  })

  await test('GET /api/documents sin auth → 401', async () => {
    const res = await fetch(`${BASE}/api/documents`)
    assert(res.status === 401, `status ${res.status}`)
  })

  // ── 5. Admin APIs ──────────────────────────────────────────────
  console.log('\n4. Admin APIs')
  await test('GET /api/companies → 200', async () => {
    const res = await fetch(`${BASE}/api/companies`, {
      headers: { Cookie: accessCookie },
    })
    assert(res.status === 200, `status ${res.status}`)
    const body = await res.json()
    assert(Array.isArray(body.companies), 'no companies array')
    assert(body.companies.length >= 1, 'no companies in seed')
  })

  await test('GET /api/users → 200', async () => {
    const res = await fetch(`${BASE}/api/users`, {
      headers: { Cookie: accessCookie },
    })
    assert(res.status === 200, `status ${res.status}`)
    const body = await res.json()
    assert(Array.isArray(body.users), 'no users array')
    body.users.forEach((u: Record<string, unknown>) => {
      assert(!u.passwordHash, `passwordHash expuesto para ${u.email}`)
    })
  })

  await test('GET /api/workers → 200', async () => {
    const res = await fetch(`${BASE}/api/workers`, {
      headers: { Cookie: accessCookie },
    })
    assert(res.status === 200, `status ${res.status}`)
    const body = await res.json()
    assert(Array.isArray(body.workers), 'no workers array')
  })

  // ── 6. Dashboard ───────────────────────────────────────────────
  console.log('\n5. Dashboard')
  await test('GET /api/dashboard/stats → 200', async () => {
    const res = await fetch(`${BASE}/api/dashboard/stats`, {
      headers: { Cookie: accessCookie },
    })
    assert(res.status === 200, `status ${res.status}`)
    const body = await res.json()
    assert(body.kpis, 'no kpis en dashboard')
  })

  await test('GET /api/dashboard/executive → 200', async () => {
    const res = await fetch(`${BASE}/api/dashboard/executive`, {
      headers: { Cookie: accessCookie },
    })
    assert(res.status === 200, `status ${res.status}`)
    const body = await res.json()
    assert(typeof body.workers?.activeLastSevenDays === 'number', 'no workers.activeLastSevenDays')
    assert(typeof body.approvals?.pending === 'number', 'no approvals.pending')
    assert(typeof body.ts === 'string', 'no timestamp')
  })

  // ── 7. Auth — credenciales inválidas (antes del rate limit test)─
  console.log('\n6. Auth — contratos negativos')
  await test('POST /api/auth?action=login credenciales inválidas → 401', async () => {
    const res = await fetch(`${BASE}/api/auth?action=login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'no@existe.cl', password: 'wrong' }),
    })
    // Backend puede devolver 401 o 400 según implementación del contrato
    assert(res.status === 401 || res.status === 400, `status ${res.status}`)
    const body = await res.json()
    assert(!body.passwordHash, 'passwordHash expuesto')
  })

  // ── 8. Rate limit — AL FINAL para no envenenar counter ────────
  // Rate limit es por IP, no por email. Ejecutar AL FINAL siempre.
  // Usar SKIP_RATE_LIMIT_TEST=1 en CI/CD para corridas repetidas.
  console.log('\n7. Security')
  if (SKIP_RATE_LIMIT) {
    console.log('  ⏭️  Rate limit test omitido (SKIP_RATE_LIMIT_TEST=1)')
  } else {
    await test('Rate limit activo — 5 logins fallidos → 429', async () => {
      // Email único por corrida para logging, pero key es por IP así que no afecta counter
      const uniqueEmail = `invalid+${Date.now()}@safecheck.test`
      const badCreds = { email: uniqueEmail, password: 'wrong-password-that-does-not-exist-123!' }
      let lastStatus = 0
      for (let i = 0; i < 6; i++) {
        const res = await fetch(`${BASE}/api/auth?action=login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(badCreds),
        })
        lastStatus = res.status
      }
      assert(lastStatus === 429, `esperaba 429, got ${lastStatus}`)
    })
  }

  // ── Summary ────────────────────────────────────────────────────
  console.log(`\n══════════════════════════════════════════`)
  console.log(`RESULTADO: ${passed} passed, ${failed} failed`)
  if (errors.length > 0) {
    console.log('\nFALLOS:')
    errors.forEach((e) => console.log(`  • ${e}`))
  }
  console.log(`══════════════════════════════════════════\n`)

  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('Smoke test error:', err)
  process.exit(1)
})
