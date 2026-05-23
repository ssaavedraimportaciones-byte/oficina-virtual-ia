import { prisma } from '@/lib/db/client'
import type { JobType, JobRecord } from './types'

export async function createJob(
  type: JobType,
  documentId: string,
  userId: string,
  payload: Record<string, unknown>
): Promise<JobRecord> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = await prisma.job.create({ data: { type, documentId, userId, payload: payload as any } })
  return job as unknown as JobRecord
}

export async function getJob(jobId: string): Promise<JobRecord | null> {
  const job = await prisma.job.findUnique({ where: { id: jobId } })
  return job as unknown as JobRecord | null
}

export async function markRunning(jobId: string): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } },
  })
}

export async function markCompleted(jobId: string, result: Record<string, unknown>): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.job.update({ where: { id: jobId }, data: { status: 'COMPLETED', completedAt: new Date(), result: result as any } })
}

export async function markFailed(jobId: string, error: string): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'FAILED', completedAt: new Date(), error },
  })
}
