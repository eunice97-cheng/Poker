import { Server } from 'socket.io'
import { ServerGameState, ServerPlayer, TableInfo } from '../types/game'
import { GameEngine } from '../game/GameEngine'

const MIN_PLAYERS_TO_START = 2
const START_COUNTDOWN_MS = 10_000

export class GameRoom {
  public readonly tableId: string
  public readonly engine: GameEngine
  public state: ServerGameState
  private io: Server
  private startTimer: NodeJS.Timeout | null = null

  constructor(io: Server, tableInfo: TableInfo) {
    this.io = io
    this.tableId = tableInfo.id

    this.state = {
      tableId: tableInfo.id,
      tableName: tableInfo.name,
      smallBlind: tableInfo.smallBlind,
      bigBlind: tableInfo.bigBlind,
      minBuyin: tableInfo.minBuyin,
      maxBuyin: tableInfo.maxBuyin,
      maxPlayers: tableInfo.maxPlayers,
      phase: 'waiting',
      status: 'waiting',
      deck: [],
      community: [],
      pot: 0,
      sidePots: [],
      players: new Map(),
      socketToSeat: new Map(),
      dealerSeat: -1,
      currentSeat: -1,
      currentBetLevel: 0,
      lastRaiseAmount: tableInfo.bigBlind,
      handNumber: 0,
      handStartedAt: null,
      actionTimer: null,
    }

    this.engine = new GameEngine(io, this.state)
  }

  getPlayerCount(): number {
    return this.state.players.size
  }

  isFull(): boolean {
    return this.state.players.size >= this.state.maxPlayers
  }

  findEmptySeat(): number | null {
    for (let i = 0; i < this.state.maxPlayers; i++) {
      if (!this.state.players.has(i)) return i
    }
    return null
  }

  hasPlayer(playerId: string): boolean {
    for (const p of this.state.players.values()) {
      if (p.playerId === playerId) return true
    }
    return false
  }

  addPlayer(player: ServerPlayer) {
    this.state.players.set(player.seat, player)
    this.state.socketToSeat.set(player.socketId, player.seat)
    this.io.sockets.sockets.get(player.socketId)?.join(this.tableId)
    this.maybeScheduleStart()
  }

  removePlayer(socketId: string): ServerPlayer | null {
    const seat = this.state.socketToSeat.get(socketId)
    if (seat === undefined) return null

    const player = this.state.players.get(seat)
    if (!player) return null

    this.state.players.delete(seat)
    this.state.socketToSeat.delete(socketId)
    this.io.sockets.sockets.get(socketId)?.leave(this.tableId)

    if (this.state.players.size < MIN_PLAYERS_TO_START) {
      this.clearStartTimer()
    }

    return player
  }

  getPlayerBySocketId(socketId: string): ServerPlayer | null {
    const seat = this.state.socketToSeat.get(socketId)
    if (seat === undefined) return null
    return this.state.players.get(seat) ?? null
  }

  getPlayerByPlayerId(playerId: string): ServerPlayer | null {
    for (const p of this.state.players.values()) {
      if (p.playerId === playerId) return p
    }
    return null
  }

  reconnectPlayer(oldSocketId: string, newSocketId: string) {
    const player = this.getPlayerBySocketId(oldSocketId)
    if (!player) return

    const seat = this.state.socketToSeat.get(oldSocketId)!
    this.state.socketToSeat.delete(oldSocketId)
    this.state.socketToSeat.set(newSocketId, seat)
    player.socketId = newSocketId
    player.isConnected = true

    if (player.reconnectTimer) {
      clearTimeout(player.reconnectTimer)
      player.reconnectTimer = undefined
    }

    this.io.sockets.sockets.get(newSocketId)?.join(this.tableId)
    this.engine.broadcastGameState()
  }

  handleDisconnect(socketId: string) {
    const player = this.getPlayerBySocketId(socketId)
    if (!player) return

    player.isConnected = false

    // Give 60 seconds to reconnect before auto-folding and cashing out
    player.reconnectTimer = setTimeout(() => {
      this.io.to(this.tableId).emit('player_left', {
        playerId: player.playerId,
        username: player.username,
        reason: 'disconnected',
      })
      this.removePlayer(socketId)
    }, 60_000)
  }

  private maybeScheduleStart() {
    if (this.state.phase !== 'waiting') return
    if (this.state.players.size < MIN_PLAYERS_TO_START) return
    if (this.startTimer) return

    this.io.to(this.tableId).emit('game_starting', { countdown: START_COUNTDOWN_MS / 1000 })

    this.startTimer = setTimeout(() => {
      this.startTimer = null
      this.state.status = 'playing'
      this.engine.startHand().catch(console.error)
    }, START_COUNTDOWN_MS)
  }

  private clearStartTimer() {
    if (this.startTimer) {
      clearTimeout(this.startTimer)
      this.startTimer = null
    }
  }

  destroy() {
    this.clearStartTimer()
    this.engine.clearActionTimer()
  }
}
