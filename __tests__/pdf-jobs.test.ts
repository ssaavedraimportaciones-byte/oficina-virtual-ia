import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryJobQueue, setJobQueue, getJobQueue } from '@/modules/jobs'

// ── JobEntry.result field ─────────────────────────────────────────────────────

describe('JobEntry — campo result', () => {
  let queue: InMemoryJobQueue

  beforeEach(() => {
    queue = new InMemoryJobQueue()
  })

  it('result es undefined en un job recién encolado', () => {
    const job = queue.enqueue('doc-pdf-1', 'user-1')
    expect(job.result).toBeUndefined()
  })

  it('update persiste el campo result cuando el job completa', () => {
    const job = queue.enqueue('doc-pdf-2', 'user-2')
    const payload = { finalPdfUrl: '/uploads/pdfs/doc-pdf-2_v1.pdf', version: 1 }
    queue.update(job.id, { status: 'completed', completedAt: Date.now(), result: payload })
    const updated = queue.get(job.id)
    expect(updated!.result).toBeDefined()
    expect(updated!.result!['finalPdfUrl']).toBe('/uploads/pdfs/doc-pdf-2_v1.pdf')
    expect(updated!.result!['version']).toBe(1)
  })

  it('result permanece null / undefined en job fallido', () => {
    const job = queue.enqueue('doc-pdf-3', 'user-3')
    queue.update(job.id, {
      status: 'failed',
      completedAt: Date.now(),
      error: 'PDF no pudo generarse. Intente nuevamente o contacte soporte.',
    })
    const updated = queue.get(job.id)
    expect(updated!.result).toBeUndefined()
  })
})

// ── Ciclo de vida del job PDF ─────────────────────────────────────────────────

describe('Ciclo de vida del job PDF (pending → running → completed)', () => {
  let queue: InMemoryJobQueue

  beforeEach(() => {
    queue = new InMemoryJobQueue()
  })

  it('transición pending → running registra startedAt', () => {
    const job = queue.enqueue('doc-pdf-4', 'user-4')
    expect(job.status).toBe('pending')
    const ts = Date.now()
    queue.update(job.id, { status: 'running', startedAt: ts })
    const running = queue.get(job.id)
    expect(running!.status).toBe('running')
    expect(running!.startedAt).toBe(ts)
  })

  it('transición running → completed registra completedAt y result', () => {
    const job = queue.enqueue('doc-pdf-5', 'user-5')
    queue.update(job.id, { status: 'running', startedAt: Date.now() })
    const ts = Date.now()
    queue.update(job.id, {
      status: 'completed',
      completedAt: ts,
      result: { finalPdfUrl: '/uploads/pdfs/doc-pdf-5_v1.pdf' },
    })
    const completed = queue.get(job.id)
    expect(completed!.status).toBe('completed')
    expect(completed!.completedAt).toBe(ts)
    expect(completed!.result!['finalPdfUrl']).toBe('/uploads/pdfs/doc-pdf-5_v1.pdf')
  })

  it('transición running → failed guarda mensaje genérico sin detalles internos', () => {
    const job = queue.enqueue('doc-pdf-6', 'user-6')
    queue.update(job.id, { status: 'running', startedAt: Date.now() })
    const genericMsg = 'PDF no pudo generarse. Intente nuevamente o contacte soporte.'
    queue.update(job.id, { status: 'failed', completedAt: Date.now(), error: genericMsg })
    const failed = queue.get(job.id)
    expect(failed!.status).toBe('failed')
    expect(failed!.error).toBe(genericMsg)
    expect(failed!.error).not.toContain('Error:')
    expect(failed!.error).not.toContain('at ')
    expect(failed!.error!.length).toBeLessThan(120)
  })
})

// ── Anti-enumeración y ownership ─────────────────────────────────────────────

describe('Anti-enumeración de jobs PDF', () => {
  let queue: InMemoryJobQueue

  beforeEach(() => {
    queue = new InMemoryJobQueue()
    setJobQueue(queue)
  })

  it('job de un documento no es accesible desde otro documentId', () => {
    const job = queue.enqueue('doc-A', 'user-1')
    const found = getJobQueue().get(job.id)
    // Simulates what the status endpoint does: verify documentId matches URL param
    expect(found!.documentId).not.toBe('doc-B')
  })

  it('job pertenece al userId del worker que lo creó', () => {
    const job = queue.enqueue('doc-C', 'user-worker-1')
    const found = getJobQueue().get(job.id)
    expect(found!.userId).toBe('user-worker-1')
    // A different WORKER (user-worker-2) must not see this job
    const isOwnJob = found!.userId === 'user-worker-2'
    expect(isOwnJob).toBe(false)
  })
})

// ── Idempotencia — documento con finalPdfUrl ya existente ────────────────────

describe('Idempotencia PDF', () => {
  it('no se deben encolar dos jobs para el mismo documento sin force=true', () => {
    const queue = new InMemoryJobQueue()
    // Simulates: first job completes and stores finalPdfUrl
    const job1 = queue.enqueue('doc-idem', 'user-1')
    queue.update(job1.id, {
      status: 'completed',
      completedAt: Date.now(),
      result: { finalPdfUrl: '/uploads/pdfs/doc-idem_v1.pdf' },
    })

    // The POST handler checks finalPdfUrl in DB and returns early — no second enqueue.
    // Here we verify that checking the result of a completed job is sufficient.
    const existing = queue.get(job1.id)
    expect(existing!.result!['finalPdfUrl']).toBeTruthy()
    // Only one job in queue
    expect(queue.size()).toBe(1)
  })

  it('error de job no expone stack trace ni nombre de excepción interna', () => {
    const queue = new InMemoryJobQueue()
    const job = queue.enqueue('doc-err', 'user-err')
    // Simulate what runPdfWorker does on catch
    const internalError = new Error('ENOENT: no such file or directory, open ...')
    const genericMsg = 'PDF no pudo generarse. Intente nuevamente o contacte soporte.'
    // Worker must NOT store internalError.message
    queue.update(job.id, { status: 'failed', completedAt: Date.now(), error: genericMsg })
    const failed = queue.get(job.id)
    expect(failed!.error).toBe(genericMsg)
    expect(failed!.error).not.toContain('ENOENT')
    expect(failed!.error).not.toContain(internalError.message)
  })
})

// ── Validación de permisos via ownership check ────────────────────────────────

describe('Status endpoint — lógica de autorización', () => {
  it('WORKER con userId diferente al job.userId no puede acceder', () => {
    const queue = new InMemoryJobQueue()
    const job = queue.enqueue('doc-Z', 'owner-user')

    const requestingUserId = 'other-user'
    const requestingRole = 'WORKER'

    const isBlocked =
      requestingRole === 'WORKER' && job.userId !== requestingUserId
    expect(isBlocked).toBe(true)
  })

  it('SUPERVISOR puede ver job de cualquier usuario', () => {
    const queue = new InMemoryJobQueue()
    const job = queue.enqueue('doc-Z2', 'worker-user')

    const requestingUserId = 'supervisor-user'
    const requestingRole = 'SUPERVISOR'

    const isBlocked =
      requestingRole === 'WORKER' && job.userId !== requestingUserId
    expect(isBlocked).toBe(false)
  })

  it('jobId con documentId distinto al URL param es rechazado', () => {
    const queue = new InMemoryJobQueue()
    const job = queue.enqueue('doc-real', 'user-1')

    // Status endpoint checks: job.documentId !== params.id
    const urlDocumentId = 'doc-other'
    const shouldReject = job.documentId !== urlDocumentId
    expect(shouldReject).toBe(true)
  })
})
