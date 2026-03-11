import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { authenticateSocket } from './middleware/authMiddleware'
import { registerConnectionHandler } from './handlers/connectionHandler'
import { roomManager } from './rooms/RoomManager'
import { supabaseService } from './services/supabaseService'
import kofiWebhookRouter from './routes/kofiWebhook'
import redeemCodeRouter from './routes/redeemCode'

const PORT = parseInt(process.env.PORT ?? '4000')

function getAllowedOrigins() {
  return Array.from(
    new Set(
      [
        process.env.NEXT_PUBLIC_SITE_URL,
        process.env.CLIENT_URL,
        process.env.CORS_ALLOWED_ORIGINS,
        process.env.SOCKET_ALLOWED_ORIGINS,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ]
        .flatMap((value) => (value ?? '').split(','))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  )
}

const allowedOrigins = getAllowedOrigins()

function isAllowedOrigin(origin?: string) {
  if (!origin) return true
  return allowedOrigins.includes(origin)
}

const app = express()
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true)
        return
      }

      callback(new Error('Origin not allowed by CORS'))
    },
    credentials: true,
  })
)
app.use(express.json())

const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true)
        return
      }

      callback(new Error('Origin not allowed by CORS'))
    },
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

// Ko-fi webhook — receives payment notifications, issues chip codes
// Uses urlencoded body (Ko-fi sends form data)
app.use('/webhook/kofi', express.urlencoded({ extended: true }), kofiWebhookRouter)

// Chip code redemption
app.use('/api/redeem-code', redeemCodeRouter)

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

async function reconcileLobbyTables() {
  const rooms = roomManager.getAllRooms()
  const activeRoomIds = new Set(rooms.map((room) => room.tableId))

  const dbTables = await supabaseService.listTables()

  for (const table of dbTables) {
    if (!activeRoomIds.has(table.id)) {
      await supabaseService.deleteTable(table.id).catch(console.error)
    }
  }

  for (const room of rooms) {
    const status = room.state.phase === 'waiting' ? 'waiting' : 'playing'
    await supabaseService
      .updateTableStatus(room.tableId, status, room.getPlayerCount())
      .catch(console.error)
  }
}

httpServer.listen(PORT, () => {
  console.log(`[Server] Poker game server running on port ${PORT}`)
  // Clean up any dev tables left over from a previous server session
  supabaseService.cleanupDevTables().catch(console.error)
  supabaseService.cleanupOrphanedTables().catch(console.error)
  reconcileLobbyTables().catch(console.error)
  // Award daily chips on startup (catch any players who qualified while server was down)
  supabaseService.awardDailyChips().catch(console.error)
})

// Check for daily chip awards every 10 minutes
setInterval(() => {
  supabaseService.awardDailyChips().catch(console.error)
}, 10 * 60 * 1000)

// Keep Supabase lobby rows aligned with live in-memory rooms.
setInterval(() => {
  reconcileLobbyTables().catch(console.error)
}, 30 * 1000)

