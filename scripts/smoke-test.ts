/**
 * SafeCheck AI — Smoke tests para staging/producción
 * Uso: BASE_URL=https://tu-dominio.vercel.app npx tsx scripts/smoke-test.ts
 * Requiere usuario: admin@safecheck.app / SafeCheck2026!
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const EMAIL = process.env.SMOKE_EMAIL ?? 'admin@safecheck.app'
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'SafeCheck2026!'

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

async function main() {
  console.log(`\n══════════════════════════════════════════`)
  console.log(`SafeCheck AI — Smoke Tests`)
  console.log(`Base URL: ${BASE}`)
  console.log(`══════════════════════════════════════════\n`)

  // ── 1. Health check ────────────────────────────────────────────
  console.log('1. Health')
  await test('GET /api/health → 200 ok', async () => {
    const res = await fetch(`${BASE}/api/health`)
    assert(res.status === 200, `status ${res.status}`)
    const body = await res.json()
    assert(body.status === 'ok', `status=${body.status}`)
    assert(body.db === 'ok', `db=${body.db}`)
    assert(typeof body.latencyMs === 'number', 'no latencyMs')
  })

  // ── 2. Auth ────────────────────────────────────────────────────
  console.log('\n2. Auth')
  let accessCookie = ''

  await test('POST /api/auth?action=login con credenciales válidas → 200', async () => {
    const res = await fetch(`${BASE}/api/auth?action=login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    })
    assert(res.status === 200, `status ${res.status}`)
    const body = await res.json()
    assert(body.user?.role === 'SYSTEM_ADMIN', `role=${body.user?.role}`)
    const setCookie = res.headers.get('set-cookie') ?? ''
    assert(setCookie.includes('access_token'), 'no access_token cookie')
    accessCookie = setCookie
  })

  await test('POST /api/auth?action=login credenciales inválidas → 401', async () => {
    const res = await fetch(`${BASE}/api/auth?action=login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'no@existe.cl', password: 'wrong' }),
    })
    assert(res.status === 401, `status ${res.status}`)
    const body = await res.json()
    assert(!body.passwordHash, 'passwordHash expuesto')
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

  // ── 7. Rate limit ──────────────────────────────────────────────
  console.log('\n6. Security')
  await test('Rate limit activo — 5 logins fallidos → 429', async () => {
    const badCreds = { email: 'test@safecheck.app', password: 'wrong-password-123' }
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
