'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'

export interface JobState {
  status: JobStatus | null
  result: Record<string, unknown> | null
  error: string | null
  isPolling: boolean
  refetch: () => void
}

interface Options {
  statusUrl: string | null
  enabled?: boolean
  intervalMs?: number
}

const TERMINAL_STATUSES: JobStatus[] = ['COMPLETED', 'FAILED']
const DEFAULT_INTERVAL = 3000
const MAX_POLLS = 120 // 6 min safety ceiling at 3s interval

export function useJobStatus({ statusUrl, enabled = true, intervalMs = DEFAULT_INTERVAL }: Options): JobState {
  const [status, setStatus] = useState<JobStatus | null>(null)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const pollCount = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    abortRef.current?.abort()
  }

  const fetchStatus = useCallback(async () => {
    if (!statusUrl) return
    abortRef.current = new AbortController()
    try {
      const res = await fetch(statusUrl, { signal: abortRef.current.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const newStatus: JobStatus = data.job?.status ?? data.status ?? 'PENDING'
      setStatus(newStatus)
      if (newStatus === 'COMPLETED') setResult(data.job?.result ?? null)
      if (newStatus === 'FAILED') setError(data.job?.error ?? 'Error desconocido')
      return newStatus
    } catch (err) {
      if ((err as Error).name === 'AbortError') return null
      setError(err instanceof Error ? err.message : 'Error de red')
      return 'FAILED' as JobStatus
    }
  }, [statusUrl])

  const startPolling = useCallback(() => {
    if (!statusUrl || !enabled) return
    setIsPolling(true)
    pollCount.current = 0

    const poll = async () => {
      if (pollCount.current >= MAX_POLLS) {
        setIsPolling(false)
        setError('Tiempo de espera agotado — el proceso tardó demasiado')
        return
      }
      pollCount.current++
      const s = await fetchStatus()
      if (s && TERMINAL_STATUSES.includes(s as JobStatus)) {
        setIsPolling(false)
        return
      }
      timerRef.current = setTimeout(poll, intervalMs)
    }

    poll()
  }, [statusUrl, enabled, fetchStatus, intervalMs])

  const refetch = useCallback(() => {
    clearTimer()
    setStatus(null)
    setResult(null)
    setError(null)
    startPolling()
  }, [startPolling])

  useEffect(() => {
    if (statusUrl && enabled) {
      startPolling()
    }
    return clearTimer
  }, [statusUrl, enabled, startPolling])

  return { status, result, error, isPolling, refetch }
}
