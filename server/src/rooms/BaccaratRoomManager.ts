import { Server } from 'socket.io'
import { BaccaratRoom } from './BaccaratRoom'
import { TableInfo } from '../types/game'

const HOUSE_BACCARAT_PREFIX = 'house_bac_'
const HOUSE_BACCARAT_MIN_BET = 100
const HOUSE_BACCARAT_MAX_BET = 10000
const HOUSE_BACCARAT_MIN_BUYIN = 100
const HOUSE_BACCARAT_MAX_BUYIN = 100000
const HOUSE_BACCARAT_MAX_PLAYERS = 6

class BaccaratRoomManager {
  private rooms: Map<string, BaccaratRoom> = new Map()
  private io: Server | null = null

  init(io: Server) {
    this.io = io
  }

  createRoom(tableInfo: TableInfo) {
    if (!this.io) throw new Error('BaccaratRoomManager not initialized')
    const room = new BaccaratRoom(this.io, tableInfo)
    this.rooms.set(tableInfo.id, room)
    return room
  }

  ensureOpenHouseTable() {
    const openHouseRoom = this.getHouseRooms().find((room) => !room.isFull())
    if (openHouseRoom) return openHouseRoom

    const houseSeat = this.getHouseRooms().length + 1
    const tableInfo: TableInfo = {
      id: `${HOUSE_BACCARAT_PREFIX}${houseSeat}`,
      name: houseSeat === 1 ? 'ASL Baccarat House Table' : `ASL Baccarat House Table ${houseSeat}`,
      hostId: null,
      gameType: 'baccarat',
      tableKind: 'house',
      houseSeat,
      maxPlayers: HOUSE_BACCARAT_MAX_PLAYERS,
      smallBlind: HOUSE_BACCARAT_MIN_BET,
      bigBlind: HOUSE_BACCARAT_MAX_BET,
      minBuyin: HOUSE_BACCARAT_MIN_BUYIN,
      maxBuyin: HOUSE_BACCARAT_MAX_BUYIN,
      status: 'waiting',
      playerCount: 0,
    }
    return this.createRoom(tableInfo)
  }

  getHouseRooms() {
    return Array.from(this.rooms.values())
      .filter((room) => room.state.tableKind === 'house')
      .sort((a, b) => (a.state.houseSeat ?? 0) - (b.state.houseSeat ?? 0))
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

export const baccaratRoomManager = new BaccaratRoomManager()
