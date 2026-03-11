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
      if (!player) return callback?.({ error: 'Not at this table' })

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
        await supabaseService.removeTablePlayer(room.tableId, observer.playerId).catch(console.error)
        const realPlayers = Array.from(room.state.players.values()).filter(p => !p.isBot)
        const hasObservers = room.state.observers.size > 0
        if (realPlayers.length === 0 && !hasObservers) {
          await supabaseService.deleteTable(room.tableId).catch(console.error)
          roomManager.deleteRoom(room.tableId)
        }
        return
      }

      const player = room.getPlayerBySocketId(socket.id)
      if (!player) return

      if (room.state.phase === 'waiting') {
        const cashout = player.stack
        room.removePlayer(socket.id)
        io.to(room.tableId).emit('player_left', {
          playerId: player.playerId,
          username: player.username,
          reason: 'disconnected',
        })
        if (cashout > 0) {
          await supabaseService.addChips(player.playerId, room.tableId, cashout, 'cashout').catch(console.error)
        }
        await supabaseService.removeTablePlayer(room.tableId, player.playerId).catch(console.error)
        const realPlayers = Array.from(room.state.players.values()).filter(p => !p.isBot)
        if (realPlayers.length === 0) {
          await supabaseService.deleteTable(room.tableId).catch(console.error)
          roomManager.deleteRoom(room.tableId)
        }
      } else {
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

          const realPlayers = Array.from(room.state.players.values()).filter(p => !p.isBot)
          if (realPlayers.length === 0) {
            await supabaseService.deleteTable(room.tableId).catch(console.error)
            roomManager.deleteRoom(room.tableId)
          }
        })
      }
    })
  })
}

