import { Server } from 'socket.io'
import { AuthenticatedSocket } from '../middleware/authMiddleware'
import { roomManager } from '../rooms/RoomManager'
import { GameRoom } from '../rooms/GameRoom'
import { PlayerAction, ServerObserver, ServerPlayer } from '../types/game'
import { supabaseService } from '../services/supabaseService'

export function registerGameHandlers(io: Server, socket: AuthenticatedSocket) {
  const movePlayerToObserver = (room: GameRoom, player: ServerPlayer) => {
    room.removePlayer(player.socketId)

    const observer: ServerObserver = {
      socketId: player.socketId,
      playerId: player.playerId,
      username: player.username,
      avatar: player.avatar,
      stack: player.stack,
      hasTableEntry: true,
    }
    room.addObserver(observer)
  }

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
  socket.on('sit_out', (_: unknown, callback: (res: { ok?: boolean; error?: string }) => void) => {
    const room = roomManager.getRoomBySocketId(socket.id)
    if (!room) return callback?.({ error: 'Not at a table' })

    const player = room.getPlayerBySocketId(socket.id)
    if (!player) return callback?.({ error: 'Player not found' })

    if (room.state.phase === 'waiting' || room.state.phase === 'showdown') {
      movePlayerToObserver(room, player)
      io.to(room.tableId).emit('action_log', { message: `${player.username} stands up` })
      room.engine.broadcastGameState()
      callback?.({ ok: true })
      return
    }

    if (player.standUpAfterHand) {
      callback?.({ error: 'You are already set to stand up after this hand' })
      return
    }

    player.standUpAfterHand = true
    io.to(room.tableId).emit('action_log', { message: `${player.username} will stand up after this hand` })
    room.engine.broadcastGameState()
    callback?.({ ok: true })
  })

  // Sit back in: observer takes an empty seat
  socket.on('sit_in', (_: unknown, callback: (res: { ok?: boolean; error?: string }) => void) => {
    const room = roomManager.getRoomBySocketId(socket.id)
    if (!room) return callback?.({ error: 'Not at a table' })
    if (room.state.phase !== 'waiting' && room.state.phase !== 'showdown') {
      return callback?.({ error: 'Please wait for the current hand to finish' })
    }

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
      standUpAfterHand: false,
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
