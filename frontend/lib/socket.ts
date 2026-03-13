import { io, Socket } from 'socket.io-client'
import { getPublicSocketUrl } from '@/lib/site-url'

let socket: Socket | null = null

export function getSocket(token: string): Socket {
  const socketUrl = getPublicSocketUrl()

  // Return existing socket even if still connecting - do not create duplicates.
  if (socket) {
    socket.auth = { token }
    if (socket.disconnected) socket.connect()
    return socket
  }

  socket = io(socketUrl, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    timeout: 45000,
    transports: ['websocket', 'polling'],
  })

  socket.on('connect_error', (err) => {
    console.error(`[Socket] Connection error (${socketUrl}):`, err.message)
  })

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function getExistingSocket(): Socket | null {
  return socket
}
