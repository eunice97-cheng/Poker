import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null
const DEFAULT_SOCKET_PORT = '4000'

function resolveSocketUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SOCKET_URL?.trim()
  if (configuredUrl) return configuredUrl

  if (typeof window !== 'undefined') {
    const fallbackUrl = new URL(window.location.origin)
    fallbackUrl.port = DEFAULT_SOCKET_PORT
    return fallbackUrl.toString()
  }

  return `http://localhost:${DEFAULT_SOCKET_PORT}`
}

export function getSocket(token: string): Socket {
  const socketUrl = resolveSocketUrl()

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
