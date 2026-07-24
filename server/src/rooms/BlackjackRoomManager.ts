import { Server } from 'socket.io'
import { BlackjackRoom } from './BlackjackRoom'
import { TableInfo } from '../types/game'

class BlackjackRoomManager {
  private rooms: Map<string, BlackjackRoom> = new Map()
  private io: Server | null = null

  init(io: Server) {
    this.io = io
  }

  createRoom(tableInfo: TableInfo) {
    if (!this.io) throw new Error('BlackjackRoomManager not initialized')
    const room = new BlackjackRoom(this.io, tableInfo)
    this.rooms.set(tableInfo.id, room)
    return room
  }

  getRoom(tableId: string) {
    return this.rooms.get(tableId) ?? null
  }

  deleteRoom(tableId: string) {
    const room = this.rooms.get(tableId)
    if (room) {
      room.destroy()
      this.rooms.delete(tableId)
    }
  }

  getRoomBySocketId(socketId: string) {
    for (const room of this.rooms.values()) {
      if (room.getPlayerBySocketId(socketId)) return room
      if (room.getObserverBySocketId(socketId)) return room
    }
    return null
  }

  getRoomByPlayerId(playerId: string) {
    for (const room of this.rooms.values()) {
      if (room.getPlayerByPlayerId(playerId)) return room
      if (room.getObserverByPlayerId(playerId)) return room
    }
    return null
  }

  getAllRooms() {
    return Array.from(this.rooms.values())
  }
}

export const blackjackRoomManager = new BlackjackRoomManager()
