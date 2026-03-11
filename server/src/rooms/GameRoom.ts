import { Server } from 'socket.io'
import { ServerGameState, ServerPlayer, ServerObserver, TableInfo } from '../types/game'
import { GameEngine } from '../game/GameEngine'
import { assignHousePlayer, getHouseIntroLine, releaseHousePlayersForTable } from '../ai/housePlayers'

const MIN_PLAYERS_TO_START = 2
const HOUSE_AI_JOIN_DELAY_MS = 30_000
const PRE_START_GRACE_MS = 5_000
const START_COUNTDOWN_MS = 10_000

export class GameRoom {
  public readonly tableId: string
  public readonly engine: GameEngine
  public state: ServerGameState
  private io: Server
  private houseJoinTimer: NodeJS.Timeout | null = null
  private preStartTimer: NodeJS.Timeout | null = null
  private startTimer: NodeJS.Timeout | null = null
  private pendingJoinPlayerIds: Set<string> = new Set()

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
      observers: new Map(),
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

  getRealPlayerCount(): number {
    return Array.from(this.state.players.values()).filter((player) => !player.isBot).length
  }

  getBotPlayerCount(): number {
    return Array.from(this.state.players.values()).filter((player) => player.isBot).length
  }

  getRealObserverCount(): number {
    return Array.from(this.state.observers.values()).filter((observer) => !observer.playerId.startsWith('ai_')).length
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
    return this.state.observers.has(playerId)
  }

  hasPendingJoin(playerId: string): boolean {
    return this.pendingJoinPlayerIds.has(playerId)
  }

  beginPendingJoin(playerId: string) {
    this.pendingJoinPlayerIds.add(playerId)
  }

  endPendingJoin(playerId: string) {
    this.pendingJoinPlayerIds.delete(playerId)
  }

  addPlayer(player: ServerPlayer) {
    this.state.players.set(player.seat, player)
    this.state.socketToSeat.set(player.socketId, player.seat)
    this.io.sockets.sockets.get(player.socketId)?.join(this.tableId)
    this.maybeScheduleStart()
  }

  addBotPlayer(player: ServerPlayer) {
    this.state.players.set(player.seat, player)
    this.state.socketToSeat.set(player.socketId, player.seat)
    // Bots have no real socket — no join, no countdown trigger
  }

  removePlayer(socketId: string): ServerPlayer | null {
    const seat = this.state.socketToSeat.get(socketId)
    if (seat === undefined) return null

    const player = this.state.players.get(seat)
    if (!player) return null

    this.state.players.delete(seat)
    this.state.socketToSeat.delete(socketId)
    this.io.sockets.sockets.get(socketId)?.leave(this.tableId)

    this.maybeScheduleStart()

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

  hasObserver(playerId: string): boolean {
    return this.state.observers.has(playerId)
  }

  getObserverBySocketId(socketId: string): ServerObserver | null {
    for (const obs of this.state.observers.values()) {
      if (obs.socketId === socketId) return obs
    }
    return null
  }

  addObserver(observer: ServerObserver) {
    this.state.observers.set(observer.playerId, observer)
    this.io.sockets.sockets.get(observer.socketId)?.join(this.tableId)
  }

  removeObserver(playerId: string): ServerObserver | null {
    const obs = this.state.observers.get(playerId)
    if (!obs) return null
    this.state.observers.delete(playerId)
    return obs
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

  hasPendingReconnects(): boolean {
    return Array.from(this.state.players.values()).some((player) => !!player.reconnectTimer)
  }

  shouldKeepAlive(): boolean {
    return this.getRealPlayerCount() > 0 || this.getRealObserverCount() > 0 || this.hasPendingReconnects()
  }

  handleDisconnect(socketId: string, onTimeout?: (player: ServerPlayer) => Promise<void>) {
    const player = this.getPlayerBySocketId(socketId)
    if (!player) return

    player.isConnected = false

    // Give 60 seconds to reconnect before cashing out and removing
    player.reconnectTimer = setTimeout(async () => {
      this.io.to(this.tableId).emit('player_left', {
        playerId: player.playerId,
        username: player.username,
        reason: 'disconnected',
      })
      this.removePlayer(socketId)
      await onTimeout?.(player)
    }, 60_000)
  }

  tryStart() {
    this.maybeScheduleStart()
  }

  private maybeScheduleStart() {
    if (this.state.phase !== 'waiting') return
    this.ensureHouseOpponent()

    if (this.state.players.size < MIN_PLAYERS_TO_START) {
      this.clearStartSequence()
      return
    }

    this.clearHouseJoinTimer()
    if (this.preStartTimer || this.startTimer) return

    this.preStartTimer = setTimeout(() => {
      this.preStartTimer = null
      if (this.state.phase !== 'waiting' || this.state.players.size < MIN_PLAYERS_TO_START) return

      this.io.to(this.tableId).emit('game_starting', { countdown: START_COUNTDOWN_MS / 1000 })

      this.startTimer = setTimeout(() => {
        this.startTimer = null
        if (this.state.phase !== 'waiting' || this.state.players.size < MIN_PLAYERS_TO_START) return
        this.state.status = 'playing'
        this.engine.startHand().catch(console.error)
      }, START_COUNTDOWN_MS)
    }, PRE_START_GRACE_MS)
  }

  private clearStartSequence() {
    if (this.preStartTimer) {
      clearTimeout(this.preStartTimer)
      this.preStartTimer = null
    }
    if (this.startTimer) {
      clearTimeout(this.startTimer)
      this.startTimer = null
    }
  }

  private clearHouseJoinTimer() {
    if (this.houseJoinTimer) {
      clearTimeout(this.houseJoinTimer)
      this.houseJoinTimer = null
    }
  }

  destroy() {
    releaseHousePlayersForTable(this.state.players.values())
    this.clearHouseJoinTimer()
    this.clearStartSequence()
    this.engine.clearActionTimer()
  }

  private ensureHouseOpponent() {
    if (this.state.phase !== 'waiting') {
      this.clearHouseJoinTimer()
      return
    }

    if (this.getRealPlayerCount() !== 1 || this.getBotPlayerCount() > 0) {
      this.clearHouseJoinTimer()
      return
    }

    if (this.houseJoinTimer) return

    this.houseJoinTimer = setTimeout(() => {
      this.houseJoinTimer = null
      if (this.state.phase !== 'waiting') return
      if (this.getRealPlayerCount() !== 1 || this.getBotPlayerCount() > 0) return

      const seat = this.findEmptySeat()
      if (seat === null) return

      const bot = assignHousePlayer(this.tableId, seat, this.state.minBuyin, this.state.maxBuyin)
      if (!bot) return

      this.addBotPlayer(bot)
      this.io.to(this.tableId).emit('action_log', { message: getHouseIntroLine(bot.playerId) ?? `${bot.username} takes a seat` })
      this.engine.broadcastGameState()
      this.maybeScheduleStart()
    }, HOUSE_AI_JOIN_DELAY_MS)
  }
}
