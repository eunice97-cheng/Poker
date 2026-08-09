import { Server } from 'socket.io'
import { AuthenticatedSocket } from '../middleware/authMiddleware'
import { roomManager } from '../rooms/RoomManager'
import { supabaseService } from '../services/supabaseService'
import { registerTableHandlers } from './tableHandler'
import { registerGameHandlers } from './gameHandler'
import { registerBlackjackHandlers } from './blackjackHandler'
import { registerBaccaratHandlers } from './baccaratHandler'
import { blackjackRoomManager } from '../rooms/BlackjackRoomManager'
import { baccaratRoomManager } from '../rooms/BaccaratRoomManager'
import { sanitizeChatText } from '../utils/chatEmojis'
import { isHouseTable, isLocalOnlyTable, isMemoryOnlyTable } from '../utils/localAdmin'

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
    registerBlackjackHandlers(io, authed)
    registerBaccaratHandlers(io, authed)

    socket.on('lobby_chat_message', (data: { text: string }, callback) => {
      const text = sanitizeChatText(data.text?.trim().slice(0, 240) ?? '', authed.hasVipEmojis)
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

      const blackjackRoom = blackjackRoomManager.getRoomBySocketId(socket.id)
      if (blackjackRoom) {
        const blackjackObserver = blackjackRoom.getObserverBySocketId(socket.id)
        if (blackjackObserver) {
          blackjackRoom.removeObserver(blackjackObserver.playerId)

          if (!isLocalOnlyTable(blackjackRoom.tableId)) {
            if (blackjackObserver.stack > 0) {
              await supabaseService.addChips(
                blackjackObserver.playerId,
                isHouseTable(blackjackRoom.tableId) ? null : blackjackRoom.tableId,
                blackjackObserver.stack,
                'cashout'
              ).catch(console.error)
            }
            if (!isMemoryOnlyTable(blackjackRoom.tableId) && blackjackObserver.hasTableEntry) {
              await supabaseService.removeTablePlayer(blackjackRoom.tableId, blackjackObserver.playerId).catch(console.error)
            }
          }

          if (!blackjackRoom.shouldKeepAlive()) {
            if (!isMemoryOnlyTable(blackjackRoom.tableId)) {
              await supabaseService.deleteTable(blackjackRoom.tableId).catch(console.error)
            }
            blackjackRoomManager.deleteRoom(blackjackRoom.tableId)
            io.emit('blackjack_table_deleted', { tableId: blackjackRoom.tableId })
          }
          return
        }

        blackjackRoom.handleDisconnect(socket.id, async (removedPlayer, cashout) => {
          if (isLocalOnlyTable(blackjackRoom.tableId)) {
            if (!blackjackRoom.shouldKeepAlive()) {
              blackjackRoomManager.deleteRoom(blackjackRoom.tableId)
              io.emit('blackjack_table_deleted', { tableId: blackjackRoom.tableId })
            }
            return
          }

          if (cashout > 0) {
            await supabaseService.addChips(
              removedPlayer.playerId,
              isHouseTable(blackjackRoom.tableId) ? null : blackjackRoom.tableId,
              cashout,
              'cashout'
            ).catch(console.error)
          }
          if (!isMemoryOnlyTable(blackjackRoom.tableId)) {
            await supabaseService.removeTablePlayer(blackjackRoom.tableId, removedPlayer.playerId).catch(console.error)
          }
          if (!blackjackRoom.shouldKeepAlive()) {
            if (!isMemoryOnlyTable(blackjackRoom.tableId)) {
              await supabaseService.deleteTable(blackjackRoom.tableId).catch(console.error)
            }
            blackjackRoomManager.deleteRoom(blackjackRoom.tableId)
            io.emit('blackjack_table_deleted', { tableId: blackjackRoom.tableId })
          }
        })
      }

      const baccaratRoom = baccaratRoomManager.getRoomBySocketId(socket.id)
      if (baccaratRoom) {
        const result = baccaratRoom.handleDisconnect(socket.id, async (removedPlayer, cashout) => {
          if (isLocalOnlyTable(baccaratRoom.tableId)) {
            if (!baccaratRoom.shouldKeepAlive()) {
              baccaratRoomManager.deleteRoom(baccaratRoom.tableId)
              io.emit('baccarat_table_deleted', { tableId: baccaratRoom.tableId })
            }
            return
          }

          if (cashout > 0) {
            await supabaseService.addChips(
              removedPlayer.playerId,
              isHouseTable(baccaratRoom.tableId) ? null : baccaratRoom.tableId,
              cashout,
              'cashout'
            ).catch(console.error)
          }
          if (!isMemoryOnlyTable(baccaratRoom.tableId)) {
            await supabaseService.removeTablePlayer(baccaratRoom.tableId, removedPlayer.playerId).catch(console.error)
          }
          if (!baccaratRoom.shouldKeepAlive()) {
            if (!isMemoryOnlyTable(baccaratRoom.tableId)) {
              await supabaseService.deleteTable(baccaratRoom.tableId).catch(console.error)
            }
            baccaratRoomManager.deleteRoom(baccaratRoom.tableId)
            io.emit('baccarat_table_deleted', { tableId: baccaratRoom.tableId })
          }
        })

        if (result?.observer) {
          const observer = result.observer
          if (!isLocalOnlyTable(baccaratRoom.tableId) && observer.stack > 0) {
            await supabaseService.addChips(
              observer.playerId,
              isHouseTable(baccaratRoom.tableId) ? null : baccaratRoom.tableId,
              observer.stack,
              'cashout'
            ).catch(console.error)
          }
          if (!isMemoryOnlyTable(baccaratRoom.tableId) && observer.hasTableEntry) {
            await supabaseService.removeTablePlayer(baccaratRoom.tableId, observer.playerId).catch(console.error)
          }
          if (!baccaratRoom.shouldKeepAlive()) {
            if (!isMemoryOnlyTable(baccaratRoom.tableId)) {
              await supabaseService.deleteTable(baccaratRoom.tableId).catch(console.error)
            }
            baccaratRoomManager.deleteRoom(baccaratRoom.tableId)
            io.emit('baccarat_table_deleted', { tableId: baccaratRoom.tableId })
          }
        }
      }

      const room = roomManager.getRoomBySocketId(socket.id)
      if (!room) return

      const observer = room.getObserverBySocketId(socket.id)
      if (observer) {
        room.removeObserver(observer.playerId)
        const localOnly = isLocalOnlyTable(room.tableId)
        if (!localOnly) {
          if (observer.stack > 0) {
            await supabaseService.addChips(observer.playerId, room.tableId, observer.stack, 'cashout').catch(console.error)
          }
          if (observer.hasTableEntry) {
            await supabaseService.removeTablePlayer(room.tableId, observer.playerId).catch(console.error)
          }
        }
        if (!room.shouldKeepAlive()) {
          if (!localOnly) {
            await supabaseService.deleteTable(room.tableId).catch(console.error)
          }
          roomManager.deleteRoom(room.tableId)
          io.emit('table_deleted', { tableId: room.tableId })
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
        const localOnly = isLocalOnlyTable(room.tableId)
        if (!localOnly) {
          if (removedPlayer.stack > 0) {
            await supabaseService.addChips(removedPlayer.playerId, room.tableId, removedPlayer.stack, 'cashout').catch(console.error)
          }
          await supabaseService.removeTablePlayer(room.tableId, removedPlayer.playerId).catch(console.error)
        }

        if (!room.shouldKeepAlive()) {
          if (!localOnly) {
            await supabaseService.deleteTable(room.tableId).catch(console.error)
          }
          roomManager.deleteRoom(room.tableId)
          io.emit('table_deleted', { tableId: room.tableId })
        }
      })
    })
  })
}

