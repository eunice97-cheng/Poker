'use client'

import { useEffect, useRef, useState } from 'react'
import { getSocket, getExistingSocketUrl } from '@/lib/socket'
import { getPublicServerCandidates } from '@/lib/site-url'
import type { Socket } from 'socket.io-client'

const HEALTH_CHECK_TIMEOUT_MS = 8000

async function fetchHealth(candidate: string, signal: AbortSignal) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS)

  signal.addEventListener('abort', abort, { once: true })

  try {
    return await fetch(`${candidate}/health`, {
      method: 'GET',
      cache: 'no-store',
      mode: 'cors',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', abort)
  }
}

async function resolveReachableServerUrl(signal: AbortSignal) {
  const candidates = getPublicServerCandidates()
  let lastError = ''

  for (const candidate of candidates) {
    if (signal.aborted) break

    try {
      const res = await fetchHealth(candidate, signal)

      if (res.ok) return candidate

      lastError = `health ${res.status}`
    } catch (error) {
      lastError =
        !signal.aborted && error instanceof DOMException && error.name === 'AbortError'
          ? `health timed out after ${HEALTH_CHECK_TIMEOUT_MS / 1000}s`
          : error instanceof Error
            ? error.message
            : 'health check failed'
    }
  }

  return { fallback: candidates[0] ?? '', reason: lastError }
}

export function useSocket(token: string | null) {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [socketUrl, setSocketUrl] = useState('')

  useEffect(() => {
    if (!token) return

    const controller = new AbortController()

    const setupSocket = async () => {
      const resolved = await resolveReachableServerUrl(controller.signal)
      if (controller.signal.aborted) return

      const resolvedUrl = typeof resolved === 'string' ? resolved : resolved.fallback
      const socket = getSocket(token, resolvedUrl)
      socketRef.current = socket
      setSocketUrl(resolvedUrl || getExistingSocketUrl())

      if (typeof resolved !== 'string' && resolved.reason) {
        setError(`Could not reach ${resolvedUrl || 'server'} (${resolved.reason})`)
      }

      const onConnect = () => {
        setConnected(true)
        setError(null)
        setSocketUrl(resolvedUrl || getExistingSocketUrl())
      }
      const onDisconnect = () => setConnected(false)
      const onConnectError = (err: Error) => {
        const urlSuffix = resolvedUrl ? ` (${resolvedUrl})` : ''
        setError(`${err.message}${urlSuffix}`)
      }

      socket.on('connect', onConnect)
      socket.on('disconnect', onDisconnect)
      socket.on('connect_error', onConnectError)

      if (socket.connected) setConnected(true)

      return () => {
        socket.off('connect', onConnect)
        socket.off('disconnect', onDisconnect)
        socket.off('connect_error', onConnectError)
      }
    }

    let cleanup: (() => void) | undefined

    void setupSocket().then((nextCleanup) => {
      cleanup = nextCleanup
    })

    return () => {
      controller.abort()
      cleanup?.()
    }
  }, [token])

  return { socket: socketRef.current, connected, error, socketUrl }
}
