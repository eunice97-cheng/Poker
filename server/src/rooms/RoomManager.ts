import { Server } from 'socket.io'
import { GameRoom } from './GameRoom'
import { TableInfo } from '../types/game'

class RoomManager {
  private rooms: Map<string, GameRoom> = new Map()
  private io: Server | null = null

  init(io: Server) {
    this.io = io
  }

  createRoom(tableInfo: TableInfo): GameRoom {
    if (!this.io) throw new Error('RoomManager not initialized')
    const room = new GameRoom(this.io, tableInfo)
    this.rooms.set(tableInfo.id, room)
    return room
  }

  getRoom(tableId: string): GameRoom | null {
    return this.rooms.get(tableId) ?? null
  }

  deleteRoom(tableId: string) {
    const room = this.rooms.get(tableId)
    if (room) {
      room.destroy()
      this.rooms.delete(tableId)
    }
  }

  getRoomByPlayerId(playerId: string): GameRoom | null {
    for (const room of this.rooms.values()) {
      if (room.hasPlayer(playerId)) return room
    }
    return null
  }

  getRoomBySocketId(socketId: string): GameRoom | null {
    for (const room of this.rooms.values()) {
      if (room.getPlayerBySocketId(socketId)) return room
    }
    return null
  }

  getAllRooms(): GameRoom[] {
    return Array.from(this.rooms.values())
  }
}

export const roomManager = new RoomManager()
