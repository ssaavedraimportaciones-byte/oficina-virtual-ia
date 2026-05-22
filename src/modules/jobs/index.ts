import { randomUUID } from 'crypto'

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface JobEntry {
  id: string
  documentId: string
  userId: string
  status: JobStatus
  createdAt: number
  startedAt?: number
  completedAt?: number
  // Generic message only — never store internal error details
  error?: string
  // Stores job output once completed (e.g. { finalPdfUrl } for PDF jobs)
  result?: Record<string, unknown>
}

export interface JobQueue {
  enqueue(documentId: string, userId: string): JobEntry
  get(jobId: string): JobEntry | undefined
  update(jobId: string, patch: Partial<Omit<JobEntry, 'id' | 'documentId' | 'userId' | 'createdAt'>>): void
}

export class InMemoryJobQueue implements JobQueue {
  private jobs = new Map<string, JobEntry>()

  enqueue(documentId: string, userId: string): JobEntry {
    const entry: JobEntry = {
      id: randomUUID(),
      documentId,
      userId,
      status: 'pending',
      createdAt: Date.now(),
    }
    this.jobs.set(entry.id, entry)
    return entry
  }

  get(jobId: string): JobEntry | undefined {
    return this.jobs.get(jobId)
  }

  update(jobId: string, patch: Partial<Omit<JobEntry, 'id' | 'documentId' | 'userId' | 'createdAt'>>): void {
    const entry = this.jobs.get(jobId)
    if (entry) {
      this.jobs.set(jobId, { ...entry, ...patch })
    }
  }

  clear(): void {
    this.jobs.clear()
  }

  size(): number {
    return this.jobs.size
  }
}

// Singleton shared within a single Node.js process instance.
// DEBT: InMemoryJobQueue is NOT suitable for multi-instance or serverless deployments.
//       Replace with a Redis/BullMQ/Inngest adapter before scaling horizontally.
let _queue: JobQueue = new InMemoryJobQueue()

export function getJobQueue(): JobQueue {
  return _queue
}

export function setJobQueue(q: JobQueue): void {
  _queue = q
}
