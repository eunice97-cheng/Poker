import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { authenticateSocket } from './middleware/authMiddleware'
import { registerConnectionHandler } from './handlers/connectionHandler'
import { roomManager } from './rooms/RoomManager'
import { blackjackRoomManager } from './rooms/BlackjackRoomManager'
import { supabaseService } from './services/supabaseService'
import kofiWebhookRouter from './routes/kofiWebhook'
import redeemCodeRouter from './routes/redeemCode'
import adminBuzzerRouter from './routes/adminBuzzer'
import { isLocalOnlyTable } from './utils/localAdmin'

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
blackjackRoomManager.init(io)

// Auth middleware for all socket connections
io.use(authenticateSocket)

// Register all socket event handlers
registerConnectionHandler(io)

// Ko-fi webhook — receives payment notifications, issues chip codes
// Uses urlencoded body (Ko-fi sends form data)
app.use('/webhook/kofi', express.urlencoded({ extended: true }), kofiWebhookRouter)

// Chip code redemption
app.use('/api/redeem-code', redeemCodeRouter)
app.use('/api/admin/buzzer', adminBuzzerRouter)

// Health check endpoint
app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    rooms: roomManager.getAllRooms().length,
    blackjackRooms: blackjackRoomManager.getAllRooms().length,
    uptime: process.uptime(),
  })
})

// REST: get all active tables (for SSR lobby fallback)
app.get('/tables', (_, res) => {
  const tables = roomManager.getAllRooms().map((room) => ({
    id: room.tableId,
    name: room.state.tableName,
    game_type: 'poker',
    host_id: null,
    player_count: room.getPlayerCount(),
    playerCount: room.getPlayerCount(),
    max_players: room.state.maxPlayers,
    maxPlayers: room.state.maxPlayers,
    small_blind: room.state.smallBlind,
    smallBlind: room.state.smallBlind,
    big_blind: room.state.bigBlind,
    bigBlind: room.state.bigBlind,
    min_buyin: room.state.minBuyin,
    minBuyin: room.state.minBuyin,
    max_buyin: room.state.maxBuyin,
    maxBuyin: room.state.maxBuyin,
    status: room.state.phase === 'waiting' ? 'waiting' : 'playing',
    created_at: room.state.handStartedAt?.toISOString() ?? new Date().toISOString(),
  }))
  res.json(tables)
})

app.get('/blackjack/tables', (_, res) => {
  const tables = blackjackRoomManager.getAllRooms().map((room) => ({
    id: room.tableId,
    name: room.state.tableName,
    game_type: 'blackjack',
    host_id: null,
    max_players: room.state.maxPlayers,
    small_blind: room.state.minBet,
    big_blind: room.state.maxBet,
    min_buyin: room.state.minBuyin,
    max_buyin: room.state.maxBuyin,
    status: room.state.status,
    player_count: room.getPlayerCount(),
  }))
  res.json(tables)
})

async function reconcileLobbyTables() {
  const rooms = roomManager.getAllRooms()

  for (const room of rooms) {
    if (isLocalOnlyTable(room.tableId)) continue

    const status = room.state.phase === 'waiting' ? 'waiting' : 'playing'
    await supabaseService
      .updateTableStatus(room.tableId, status, room.getPlayerCount())
      .catch(console.error)
  }
}

async function initializeServerState() {
  try {
    const recovery = await supabaseService.recoverAbandonedTables()
    if (recovery.recoveredTables > 0 || recovery.refundedPlayers > 0) {
      console.log(
        `[Recovery] Cleared ${recovery.recoveredTables} abandoned tables and refunded ${recovery.refundedPlayers} players (${recovery.refundedChips} chips)`
      )
    }
  } catch (error) {
    console.error('[Recovery] Failed to recover abandoned tables:', error)
  }

  await supabaseService.cleanupDevTables().catch(console.error)
  await supabaseService.cleanupOrphanedTables().catch(console.error)
  await reconcileLobbyTables().catch(console.error)
  await supabaseService.awardDailyChips().catch(console.error)
}

async function startServer() {
  await initializeServerState()
  httpServer.listen(PORT, () => {
    console.log(`[Server] Poker game server running on port ${PORT}`)
  })
}

void startServer()

// Check for daily chip awards every 10 minutes
setInterval(() => {
  supabaseService.awardDailyChips().catch(console.error)
}, 10 * 60 * 1000)

// Keep Supabase lobby rows aligned with live in-memory rooms.
setInterval(() => {
  reconcileLobbyTables().catch(console.error)
}, 30 * 1000)

