import { Server } from 'socket.io'
import { AuthenticatedSocket } from '../middleware/authMiddleware'
import { roomManager } from '../rooms/RoomManager'
import { PlayerAction, ServerObserver, ServerPlayer } from '../types/game'
import { supabaseService } from '../services/supabaseService'

export function registerGameHandlers(io: Server, socket: AuthenticatedSocket) {
  socket.on('player_action', async (data: { action: PlayerAction; amount?: number }, callback) => {
    try {
      const room = roomManager.getRoomBySocketId(socket.id)
      if (!room) return callback?.({ error: 'Not at a table' })

      if (room.state.phase === 'waiting' || room.state.phase === 'showdown') {
        return callback?.({ error: 'No hand in progress' })
      }

      await room.engine.handleAction(socket.id, data.action, data.amount)
      callback?.({ ok: true })
    } catch (err) {
      console.error('player_action error:', err)
      callback?.({ error: 'Action failed' })
    }
  })

  // Stand up: player leaves their seat and becomes an observer
  // Only allowed during waiting phase (no active hand)
  socket.on('sit_out', (_: unknown, callback: (res: { ok?: boolean; error?: string }) => void) => {
    const room = roomManager.getRoomBySocketId(socket.id)
    if (!room) return callback?.({ error: 'Not at a table' })
    if (room.state.phase !== 'waiting') return callback?.({ error: 'Cannot stand up during a hand' })

    const player = room.getPlayerBySocketId(socket.id)
    if (!player) return callback?.({ error: 'Player not found' })

    // Remove from seated players
    room.removePlayer(socket.id)

    // Add as observer (keeps their stack)
    const observer: ServerObserver = {
      socketId: socket.id,
      playerId: player.playerId,
      username: player.username,
      avatar: player.avatar,
      stack: player.stack,
      hasTableEntry: true,
    }
    room.addObserver(observer)

    io.to(room.tableId).emit('action_log', { message: `${player.username} stands up` })
    room.engine.broadcastGameState()
    callback?.({ ok: true })
  })

  // Sit back in: observer takes an empty seat
  socket.on('sit_in', (_: unknown, callback: (res: { ok?: boolean; error?: string }) => void) => {
    const room = roomManager.getRoomBySocketId(socket.id)
    if (!room) return callback?.({ error: 'Not at a table' })

    const observer = room.getObserverBySocketId(socket.id)
    if (!observer) return callback?.({ error: 'Not an observer' })

    if (room.isFull()) return callback?.({ error: 'No seats available' })

    const seat = room.findEmptySeat()
    if (seat === null) return callback?.({ error: 'No seats available' })

    // Remove from observers
    room.removeObserver(observer.playerId)

    // Create player from observer data
    const player: ServerPlayer = {
      socketId: socket.id,
      playerId: observer.playerId,
      username: observer.username,
      avatar: observer.avatar,
      seat,
      stack: observer.stack,
      holeCards: [],
      currentBet: 0,
      totalBetThisHand: 0,
      folded: false,
      allIn: false,
      sittingOut: false,
      hasActed: false,
      isConnected: true,
      isBot: false,
    }

    room.addPlayer(player)

    // Create or update the seat row in DB depending on how the observer entered the table.
    if (observer.hasTableEntry) {
      supabaseService.updateTablePlayerSeat(room.tableId, observer.playerId, seat).catch(console.error)
    } else {
      supabaseService.addTablePlayer(room.tableId, observer.playerId, seat, observer.stack).catch(console.error)
    }

    io.to(room.tableId).emit('action_log', { message: `${observer.username} takes a seat` })
    room.engine.broadcastGameState()
    room.tryStart()
    callback?.({ ok: true })
  })
}
