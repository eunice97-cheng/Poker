'use client'

import { useEffect, useRef, useState } from 'react'
import { getSocket, disconnectSocket } from '@/lib/socket'
import type { Socket } from 'socket.io-client'

export function useSocket(token: string | null) {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    const socket = getSocket(token)
    socketRef.current = socket

    const onConnect = () => {
      setConnected(true)
      setError(null)
    }
    const onDisconnect = () => setConnected(false)
    const onConnectError = (err: Error) => setError(err.message)

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)

    if (socket.connected) setConnected(true)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
    }
  }, [token])

  return { socket: socketRef.current, connected, error }
}
