import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(token: string): Socket {
  // Return existing socket even if still connecting - do not create duplicates.
  if (socket) return socket

  socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    timeout: 20000,
    transports: ['websocket', 'polling'],
  })

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message)
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
