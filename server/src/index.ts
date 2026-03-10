import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { authenticateSocket } from './middleware/authMiddleware'
import { registerConnectionHandler } from './handlers/connectionHandler'
import { roomManager } from './rooms/RoomManager'

const PORT = parseInt(process.env.PORT ?? '4000')

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 30_000,
  pingInterval: 10_000,
})

// Initialize room manager with the io instance
roomManager.init(io)

// Auth middleware for all socket connections
io.use(authenticateSocket)

// Register all socket event handlers
registerConnectionHandler(io)

// Health check endpoint
app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    rooms: roomManager.getAllRooms().length,
    uptime: process.uptime(),
  })
})

// REST: get all active tables (for SSR lobby fallback)
app.get('/tables', (_, res) => {
  const tables = roomManager.getAllRooms().map((room) => ({
    id: room.tableId,
    name: room.state.tableName,
    playerCount: room.getPlayerCount(),
    maxPlayers: room.state.maxPlayers,
    smallBlind: room.state.smallBlind,
    bigBlind: room.state.bigBlind,
    status: room.state.phase,
  }))
  res.json(tables)
})

httpServer.listen(PORT, () => {
  console.log(`[Server] Poker game server running on port ${PORT}`)
})
