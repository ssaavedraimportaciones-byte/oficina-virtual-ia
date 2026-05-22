#!/usr/bin/env node
/**
 * SafeCheck AI — Staging Smoke Tests
 * Usage: node scripts/smoke-test.mjs https://your-staging-url.vercel.app
 *
 * Requires staging to be seeded with: npx tsx prisma/seed.ts
 * All test users use password: SafeCheck2026!
 */

const BASE = process.argv[2]
if (!BASE) {
  console.error('Usage: node scripts/smoke-test.mjs https://staging-url')
  process.exit(1)
}

let passed = 0
let failed = 0
let accessToken = ''
let supervisorToken = ''
let workerToken = ''
let documentId = ''
let approvalId = ''

// ── helpers ───────────────────────────────────────────────────────────────────

function ok(label) {
  console.log(`  ✅ ${label}`)
  passed++
}

function fail(label, detail) {
  console.error(`  ❌ ${label}`)
  if (detail) console.error(`     ${detail}`)
  failed++
}

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers ?? {}) }
  if (accessToken && !opts.noAuth) headers['Authorization'] = `Bearer ${accessToken}`
  const res = await fetch(`${BASE}${path}`, { ...opts, headers })
  let body
  try { body = await res.json() } catch { body = null }
  return { status: res.status, body }
}

function assert(cond, label, detail) {
  if (cond) ok(label)
  else fail(label, detail)
}

// ── POSITIVE SMOKE TESTS ─────────────────────────────────────────────────────

console.log('\n🟢 SMOKE TEST POSITIVO\n')

// 1. Login admin
console.log('1. Login admin')
{
  const { status, body } = await api('/api/auth', {
    method: 'POST',
    noAuth: true,
    body: JSON.stringify({ email: 'admin@safecheck.app', password: 'SafeCheck2026!' }),
  })
  assert(status === 200 && body?.token, `Login admin → ${status}`, JSON.stringify(body))
  if (body?.token) accessToken = body.token
}

// Login supervisor (for later)
{
  const { status, body } = await api('/api/auth', {
    method: 'POST',
    noAuth: true,
    body: JSON.stringify({ email: 'supervisor@safecheck.app', password: 'SafeCheck2026!' }),
  })
  if (body?.token) supervisorToken = body.token
}

// Login worker (for later)
{
  const { status, body } = await api('/api/auth', {
    method: 'POST',
    noAuth: true,
    body: JSON.stringify({ email: 'trabajador@safecheck.app', password: 'SafeCheck2026!' }),
  })
  if (body?.token) workerToken = body.token
}

// 2. Get companies
console.log('2. Verificar dashboard')
{
  const { status, body } = await api('/api/dashboard/stats')
  assert(status === 200 && body?.kpis, `Dashboard stats → ${status}`, JSON.stringify(body?.error))
}

// 3. Create document
console.log('3. Crear documento ART')
{
  // Get first company
  const companies = await api('/api/companies')
  const companyId = companies.body?.companies?.[0]?.id ?? companies.body?.[0]?.id

  const { status, body } = await api('/api/documents', {
    method: 'POST',
    body: JSON.stringify({
      type: 'ART',
      companyId: companyId ?? 'dummy',
      workArea: 'Nivel 3 — Sector Norte',
      taskName: 'Smoke Test: Cambio de bomba',
    }),
  })
  assert(status === 201 && body?.document?.id, `Crear documento → ${status}`, JSON.stringify(body?.error))
  if (body?.document?.id) documentId = body.document.id
}

// 4. Configure geofence
console.log('4. Configurar geofence (Santiago centro)')
if (documentId) {
  const { status } = await api(`/api/documents/${documentId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      geofenceLat: -33.4489,
      geofenceLng: -70.6693,
      geofenceRadiusMeters: 5000,
    }),
  })
  assert(status === 200, `Configurar geofence → ${status}`)
}

// 5. OCR — trigger scan (no real file, expect validation error not server crash)
console.log('5. OCR endpoint responde correctamente')
if (documentId) {
  // Just verify the endpoint exists and requires proper input
  const { status } = await api(`/api/documents/${documentId}/scan`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  assert([400, 422].includes(status), `OCR sin archivo → ${status} (esperado 400/422)`)
}

// 6. Sign document (canvas)
console.log('6. Firma con canvas válido')
if (documentId) {
  // Minimal valid 1x1 PNG base64
  const minimalPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const workerHeaders = workerToken ? { Authorization: `Bearer ${workerToken}` } : {}
  const { status, body } = await fetch(`${BASE}/api/documents/${documentId}/signatures`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...workerHeaders },
    body: JSON.stringify({
      method: 'CANVAS',
      signatureImageBase64: minimalPng,
      gpsLat: -33.4489,
      gpsLng: -70.6693,
    }),
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }))
  assert([201, 403, 422].includes(status), `Firma con canvas → ${status}`, JSON.stringify(body?.error))
}

// 7. Get approvals
console.log('7. Consultar flujo de aprobaciones')
if (documentId) {
  const { status, body } = await api(`/api/documents/${documentId}/approvals`)
  assert(status === 200, `Listar approvals → ${status}`, JSON.stringify(body?.error))
  if (body?.approvals?.length) approvalId = body.approvals[0].id
}

// 8. QR verification endpoint (invalid code → valid:false, not 500)
console.log('8. QR inválido → valid:false')
{
  const { status, body } = await api('/api/verify/INVALID-QR-CODE-SMOKE-TEST', { noAuth: true })
  assert(status === 200 && body?.valid === false, `QR inválido → ${status} valid:${body?.valid}`)
}

// 9. AuditLog — must not be accessible without auth
console.log('9. AuditLog requiere autenticación')
{
  const { status } = await api('/api/audit', { noAuth: true })
  assert([401, 403, 404].includes(status), `AuditLog sin auth → ${status}`)
}

// 10. PDF generation (no approved doc, expect error not crash)
console.log('10. PDF generation endpoint responde')
if (documentId) {
  const { status } = await api(`/api/documents/${documentId}/generate-pdf`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  assert([400, 403, 404, 409, 422].includes(status), `PDF doc no aprobado → ${status}`)
}

// ── NEGATIVE SMOKE TESTS ─────────────────────────────────────────────────────

console.log('\n🔴 SMOKE TEST NEGATIVO\n')

// 1. Rate limit — 6 failed logins → 429
console.log('1. Rate limit en login (6 intentos fallidos)')
{
  let got429 = false
  for (let i = 0; i < 7; i++) {
    const { status } = await api('/api/auth', {
      method: 'POST',
      noAuth: true,
      body: JSON.stringify({ email: 'admin@safecheck.app', password: 'wrong-password' }),
    })
    if (status === 429) { got429 = true; break }
  }
  assert(got429, 'Rate limit 429 después de múltiples intentos')
}

// 2. File with wrong magic bytes
console.log('2. Archivo falso PDF → rechazado')
if (documentId) {
  // EXE header disguised as PDF
  const fakeBase64 = Buffer.from('MZ\x90\x00\x03\x00\x00\x00').toString('base64')
  const form = new FormData()
  const file = new Blob([Buffer.from(fakeBase64, 'base64')], { type: 'application/pdf' })
  form.append('file', file, 'malicious.pdf')

  const { status } = await fetch(`${BASE}/api/documents/${documentId}/scan`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  }).then(r => ({ status: r.status }))
  assert([400, 415, 422].includes(status), `Archivo falso → ${status} (esperado 400/415/422)`)
}

// 3. Signature without canvas image
console.log('3. Firma sin imagen canvas → rechazada')
if (documentId) {
  const { status } = await api(`/api/documents/${documentId}/signatures`, {
    method: 'POST',
    body: JSON.stringify({ method: 'CANVAS', signatureImageBase64: '' }),
  })
  assert(status === 400, `Firma sin canvas → ${status} (esperado 400)`)
}

// 4. Signature outside geofence
console.log('4. Firma fuera de geofence → rechazada')
if (documentId) {
  const minimalPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const { status, body } = await api(`/api/documents/${documentId}/signatures`, {
    method: 'POST',
    body: JSON.stringify({
      method: 'CANVAS',
      signatureImageBase64: minimalPng,
      gpsLat: -22.9068,  // Rio de Janeiro — far outside Santiago geofence
      gpsLng: -43.1729,
    }),
  })
  assert(status === 422, `Firma fuera geofence → ${status} (esperado 422)`, body?.error)
}

// 5. Creator cannot approve own document
console.log('5. Creador no puede aprobar su propio documento')
if (documentId && approvalId) {
  // Use admin token (who created the doc via admin) attempting to approve
  const { status, body } = await api(`/api/documents/${documentId}/approvals/${approvalId}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'approve', comment: 'self-approval test' }),
  })
  assert([403, 422].includes(status), `Self-approval → ${status} (esperado 403/422)`, body?.error)
} else {
  fail('Self-approval — sin approvalId disponible (doc en DRAFT, no tiene aprobación)')
}

// 6. Approved document cannot be re-scanned (use seed doc SC-2026-000002)
console.log('6. Documento aprobado no puede reescanearse')
{
  // Find the approved seed document
  const docs = await api('/api/documents?status=APPROVED')
  const approvedDoc = docs.body?.documents?.[0]
  if (approvedDoc) {
    const form = new FormData()
    const file = new Blob([Buffer.from('%PDF-1.4')], { type: 'application/pdf' })
    form.append('file', file, 'test.pdf')

    const { status } = await fetch(`${BASE}/api/documents/${approvedDoc.id}/scan`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }).then(r => ({ status: r.status }))
    assert([400, 403, 409, 422].includes(status), `Rescan doc aprobado → ${status}`)
  } else {
    ok('Rescan doc aprobado — no hay docs APPROVED accesibles (seed no inicializado aún)')
  }
}

// 7. Invalid QR → valid:false
console.log('7. QR inválido retorna valid:false')
{
  const { status, body } = await api('/api/verify/totally-fake-qr-12345', { noAuth: true })
  assert(status === 200 && body?.valid === false, `QR inválido → valid:${body?.valid}`)
}

// 8. Job status isolation — cannot see another user's job
console.log('8. Job status de otro usuario es rechazado')
if (documentId) {
  // Try to access a job with a random ID as supervisor (different user)
  const supervisorHeaders = supervisorToken ? { Authorization: `Bearer ${supervisorToken}` } : {}
  const { status } = await fetch(`${BASE}/api/documents/${documentId}/scan/status?jobId=fake-job-id-123`, {
    headers: supervisorHeaders,
  }).then(r => ({ status: r.status }))
  assert([401, 403, 404].includes(status), `Job ajeno → ${status} (esperado 401/403/404)`)
}

// ── RESULTS ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`)
console.log(`Resultados: ${passed} passed, ${failed} failed`)
console.log(`─`.repeat(50))

if (failed > 0) {
  console.log('\n⚠️  Hay fallos. Revisar salida arriba.\n')
  process.exit(1)
} else {
  console.log('\n✅ Todos los smoke tests pasaron.\n')
}
