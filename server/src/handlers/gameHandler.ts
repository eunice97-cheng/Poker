import { Server } from 'socket.io'
import { AuthenticatedSocket } from '../middleware/authMiddleware'
import { roomManager } from '../rooms/RoomManager'
import { PlayerAction } from '../types/game'

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

  socket.on('sit_out', (_: unknown, callback: (res: { ok?: boolean; error?: string }) => void) => {
    const room = roomManager.getRoomBySocketId(socket.id)
    if (!room) return callback?.({ error: 'Not at a table' })
    const player = room.getPlayerBySocketId(socket.id)
    if (!player) return callback?.({ error: 'Player not found' })
    player.sittingOut = true
    io.to(room.tableId).emit('action_log', { message: `${player.username} takes a break` })
    room.engine.broadcastGameState()
    callback?.({ ok: true })
  })

  socket.on('sit_in', (_: unknown, callback: (res: { ok?: boolean; error?: string }) => void) => {
    const room = roomManager.getRoomBySocketId(socket.id)
    if (!room) return callback?.({ error: 'Not at a table' })
    const player = room.getPlayerBySocketId(socket.id)
    if (!player) return callback?.({ error: 'Player not found' })
    player.sittingOut = false
    io.to(room.tableId).emit('action_log', { message: `${player.username} is back in the game` })
    room.engine.broadcastGameState()
    room.tryStart()
    callback?.({ ok: true })
  })
}
