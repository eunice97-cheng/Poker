import { io, Socket } from 'socket.io-client'
import { getPublicSocketUrl } from '@/lib/site-url'

let socket: Socket | null = null
let socketUrl = ''

export function getSocket(token: string, preferredUrl?: string): Socket {
  const nextSocketUrl = preferredUrl || getPublicSocketUrl()

  if (socket && socketUrl !== nextSocketUrl) {
    socket.disconnect()
    socket = null
  }

  // Return existing socket even if still connecting - do not create duplicates.
  if (socket) {
    socket.auth = { token }
    if (socket.disconnected) socket.connect()
    return socket
  }

  socketUrl = nextSocketUrl

  socket = io(nextSocketUrl, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
    reconnectionDelayMax: 5000,
    timeout: 45000,
    transports: ['websocket', 'polling'],
  })

  socket.on('connect_error', (err) => {
    console.error(`[Socket] Connection error (${nextSocketUrl}):`, err.message)
  })

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
  socketUrl = ''
}

export function getExistingSocket(): Socket | null {
  return socket
}

export function getExistingSocketUrl(): string {
  return socketUrl
}
