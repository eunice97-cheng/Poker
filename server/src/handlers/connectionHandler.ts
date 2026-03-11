import { Server } from 'socket.io'
import { AuthenticatedSocket } from '../middleware/authMiddleware'
import { roomManager } from '../rooms/RoomManager'
import { supabaseService } from '../services/supabaseService'
import { registerTableHandlers } from './tableHandler'
import { registerGameHandlers } from './gameHandler'

const LOBBY_ROOM = 'lobby'
const MAX_LOBBY_MESSAGES = 60
const LOBBY_CHAT_COOLDOWN_MS = 1500

type LobbyMessage = {
  playerId: string
  username: string
  avatar: string
  text: string
  timestamp: string
}

const lobbyHistory: LobbyMessage[] = []
const lastLobbyMessageAt = new Map<string, number>()

function pushLobbyMessage(message: LobbyMessage) {
  lobbyHistory.push(message)
  if (lobbyHistory.length > MAX_LOBBY_MESSAGES) {
    lobbyHistory.shift()
  }
}

export function registerConnectionHandler(io: Server) {
  io.on('connection', (socket) => {
    const authed = socket as AuthenticatedSocket
    console.log(`[WS] Connected: ${authed.username} (${authed.userId}) socket=${socket.id}`)

    socket.join(LOBBY_ROOM)
    socket.emit('lobby_chat_history', lobbyHistory)

    socket.on('request_lobby_chat_history', () => {
      socket.emit('lobby_chat_history', lobbyHistory)
    })

    registerTableHandlers(io, authed)
    registerGameHandlers(io, authed)

    socket.on('lobby_chat_message', (data: { text: string }, callback) => {
      const text = data.text?.trim().slice(0, 240)
      if (!text) {
        callback?.({ error: 'Message cannot be empty' })
        return
      }

      const now = Date.now()
      const lastSent = lastLobbyMessageAt.get(socket.id) ?? 0
      if (now - lastSent < LOBBY_CHAT_COOLDOWN_MS) {
        callback?.({ error: 'Slow down a little' })
        return
      }

      lastLobbyMessageAt.set(socket.id, now)
      const message: LobbyMessage = {
        playerId: authed.userId,
        username: authed.username,
        avatar: authed.avatar,
        text,
        timestamp: new Date().toISOString(),
      }
      pushLobbyMessage(message)
      io.to(LOBBY_ROOM).emit('lobby_chat_message', message)
      callback?.({ ok: true })
    })

    socket.on('reconnect_to_table', (data: { tableId: string }, callback) => {
      const room = roomManager.getRoom(data.tableId)
      if (!room) return callback?.({ error: 'Table not found' })

      const player = room.getPlayerByPlayerId(authed.userId)
      if (!player) {
        const observer = room.state.observers.get(authed.userId)
        if (!observer) return callback?.({ error: 'Not at this table' })

        observer.socketId = socket.id
        socket.join(room.tableId)
        room.engine.broadcastGameState()
        callback?.({ ok: true, observer: true })
        return
      }

      const oldSocketId = player.socketId
      room.reconnectPlayer(oldSocketId, socket.id)

      room.engine.broadcastGameState()
      callback?.({ ok: true })
    })

    socket.on('disconnect', async () => {
      console.log(`[WS] Disconnected: ${authed.username} socket=${socket.id}`)
      lastLobbyMessageAt.delete(socket.id)

      const room = roomManager.getRoomBySocketId(socket.id)
      if (!room) return

      const observer = room.getObserverBySocketId(socket.id)
      if (observer) {
        room.removeObserver(observer.playerId)
        if (observer.stack > 0) {
          await supabaseService.addChips(observer.playerId, room.tableId, observer.stack, 'cashout').catch(console.error)
        }
        if (observer.hasTableEntry) {
          await supabaseService.removeTablePlayer(room.tableId, observer.playerId).catch(console.error)
        }
        if (!room.shouldKeepAlive()) {
          await supabaseService.deleteTable(room.tableId).catch(console.error)
          roomManager.deleteRoom(room.tableId)
        }
        return
      }

      const player = room.getPlayerBySocketId(socket.id)
      if (!player) return

      io.to(room.tableId).emit('player_disconnected', {
        playerId: player.playerId,
        username: player.username,
      })
      room.engine.broadcastGameState()

      room.handleDisconnect(socket.id, async (removedPlayer) => {
        if (removedPlayer.stack > 0) {
          await supabaseService.addChips(removedPlayer.playerId, room.tableId, removedPlayer.stack, 'cashout').catch(console.error)
        }
        await supabaseService.removeTablePlayer(room.tableId, removedPlayer.playerId).catch(console.error)

        if (!room.shouldKeepAlive()) {
          await supabaseService.deleteTable(room.tableId).catch(console.error)
          roomManager.deleteRoom(room.tableId)
        }
      })
    })
  })
}

