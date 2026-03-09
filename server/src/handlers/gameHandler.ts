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
}
