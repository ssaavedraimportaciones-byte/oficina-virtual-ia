import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryJobQueue, getJobQueue, setJobQueue } from '@/modules/jobs'

// ── InMemoryJobQueue unit tests ───────────────────────────────────────────────

describe('InMemoryJobQueue', () => {
  let queue: InMemoryJobQueue

  beforeEach(() => {
    queue = new InMemoryJobQueue()
  })

  it('enqueue crea entry con status pending', () => {
    const job = queue.enqueue('doc-1', 'user-1')
    expect(job.status).toBe('pending')
    expect(job.documentId).toBe('doc-1')
    expect(job.userId).toBe('user-1')
    expect(typeof job.id).toBe('string')
    expect(job.id.length).toBeGreaterThan(0)
    expect(typeof job.createdAt).toBe('number')
  })

  it('enqueue asigna IDs únicos por llamada', () => {
    const a = queue.enqueue('doc-1', 'user-1')
    const b = queue.enqueue('doc-1', 'user-1')
    expect(a.id).not.toBe(b.id)
  })

  it('get retorna la entry encolada', () => {
    const job = queue.enqueue('doc-2', 'user-2')
    const found = queue.get(job.id)
    expect(found).toBeDefined()
    expect(found!.id).toBe(job.id)
  })

  it('get retorna undefined para jobId desconocido', () => {
    expect(queue.get('00000000-0000-0000-0000-000000000000')).toBeUndefined()
  })

  it('update cambia el status de pending a running', () => {
    const job = queue.enqueue('doc-3', 'user-3')
    queue.update(job.id, { status: 'running', startedAt: Date.now() })
    const updated = queue.get(job.id)
    expect(updated!.status).toBe('running')
    expect(updated!.startedAt).toBeDefined()
  })

  it('update cambia el status a completed', () => {
    const job = queue.enqueue('doc-4', 'user-4')
    const ts = Date.now()
    queue.update(job.id, { status: 'completed', completedAt: ts })
    const updated = queue.get(job.id)
    expect(updated!.status).toBe('completed')
    expect(updated!.completedAt).toBe(ts)
  })

  it('update cambia el status a failed con mensaje genérico', () => {
    const job = queue.enqueue('doc-5', 'user-5')
    queue.update(job.id, { status: 'failed', error: 'Error de procesamiento. Intente nuevamente.' })
    const updated = queue.get(job.id)
    expect(updated!.status).toBe('failed')
    expect(updated!.error).toBe('Error de procesamiento. Intente nuevamente.')
  })

  it('update no hace nada para jobId desconocido', () => {
    expect(() => {
      queue.update('no-existe', { status: 'running' })
    }).not.toThrow()
  })

  it('update no muta el id original de la entry', () => {
    const job = queue.enqueue('doc-6', 'user-6')
    queue.update(job.id, { status: 'completed', completedAt: Date.now() })
    const updated = queue.get(job.id)
    expect(updated!.id).toBe(job.id)
    expect(updated!.documentId).toBe('doc-6')
    expect(updated!.userId).toBe('user-6')
  })

  it('clear vacía la cola', () => {
    queue.enqueue('doc-7', 'user-7')
    queue.enqueue('doc-8', 'user-8')
    expect(queue.size()).toBe(2)
    queue.clear()
    expect(queue.size()).toBe(0)
  })
})

// ── setJobQueue / getJobQueue singleton ──────────────────────────────────────

describe('getJobQueue / setJobQueue', () => {
  it('setJobQueue reemplaza la implementación del singleton', () => {
    const custom = new InMemoryJobQueue()
    setJobQueue(custom)
    const job = getJobQueue().enqueue('doc-x', 'user-x')
    const found = custom.get(job.id)
    expect(found).toBeDefined()
    expect(found!.documentId).toBe('doc-x')
    // Restore default
    setJobQueue(new InMemoryJobQueue())
  })

  it('getJobQueue retorna la misma instancia en llamadas consecutivas', () => {
    const a = getJobQueue()
    const b = getJobQueue()
    expect(a).toBe(b)
  })
})

// ── mensaje de error genérico — no expone detalles internos ──────────────────

describe('mensajes de error del job', () => {
  it('el campo error del job no contiene stack traces ni detalles técnicos', () => {
    const queue = new InMemoryJobQueue()
    const job = queue.enqueue('doc-err', 'user-err')
    const genericMsg = 'Error de procesamiento. Intente nuevamente.'
    queue.update(job.id, { status: 'failed', error: genericMsg })
    const updated = queue.get(job.id)
    expect(updated!.error).not.toContain('Error:')
    expect(updated!.error).not.toContain('at ')
    expect(updated!.error!.length).toBeLessThan(100)
  })
})
