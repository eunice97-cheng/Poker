import { Server } from 'socket.io'
import { AuthenticatedSocket } from '../middleware/authMiddleware'
import { roomManager } from '../rooms/RoomManager'
import { supabaseService } from '../services/supabaseService'
import { registerTableHandlers } from './tableHandler'
import { registerGameHandlers } from './gameHandler'

export function registerConnectionHandler(io: Server) {
  io.on('connection', (socket) => {
    const authed = socket as AuthenticatedSocket
    console.log(`[WS] Connected: ${authed.username} (${authed.userId}) socket=${socket.id}`)

    registerTableHandlers(io, authed)
    registerGameHandlers(io, authed)

    // Reconnect to an existing game after disconnect
    socket.on('reconnect_to_table', (data: { tableId: string }, callback) => {
      const room = roomManager.getRoom(data.tableId)
      if (!room) return callback?.({ error: 'Table not found' })

      const player = room.getPlayerByPlayerId(authed.userId)
      if (!player) return callback?.({ error: 'Not at this table' })

      // Swap old socket with new one
      const oldSocketId = player.socketId
      room.reconnectPlayer(oldSocketId, socket.id)

      room.engine.broadcastGameState()
      callback?.({ ok: true })
    })

    socket.on('disconnect', async () => {
      console.log(`[WS] Disconnected: ${authed.username} socket=${socket.id}`)

      const room = roomManager.getRoomBySocketId(socket.id)
      if (!room) return

      // Handle observer disconnect — just remove them (no reconnect timer needed)
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
        // Not mid-hand — just cash out immediately
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
        // Mid-hand: mark as disconnected, give 60s to reconnect
        io.to(room.tableId).emit('player_disconnected', {
          playerId: player.playerId,
          username: player.username,
        })
        room.engine.broadcastGameState()

        room.handleDisconnect(socket.id, async (removedPlayer) => {
          // Cashout remaining chips to their profile
          if (removedPlayer.stack > 0) {
            await supabaseService.addChips(removedPlayer.playerId, room.tableId, removedPlayer.stack, 'cashout').catch(console.error)
          }
          await supabaseService.removeTablePlayer(room.tableId, removedPlayer.playerId).catch(console.error)

          // Clean up room if no real players remain
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
