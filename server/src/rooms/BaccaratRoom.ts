import { Server } from 'socket.io'
import { TableInfo } from '../types/game'
import {
  BaccaratBetKey,
  BaccaratBets,
  BaccaratCard,
  BaccaratRank,
  BaccaratRoadItem,
  BaccaratRoundResult,
  BaccaratServerObserver,
  BaccaratServerPlayer,
  BaccaratServerState,
  BaccaratSuit,
  BaccaratTableInfo,
  BaccaratWinner,
  ClientBaccaratState,
} from '../types/baccarat'
import { supabaseService } from '../services/supabaseService'
import { isLocalOnlyTable, isMemoryOnlyTable } from '../utils/localAdmin'

const SUITS: BaccaratSuit[] = ['S', 'H', 'D', 'C']
const RANKS: BaccaratRank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const EMPTY_BETS: BaccaratBets = { player: 0, tie: 0, banker: 0 }
const CHIP_VALUES = new Set([100, 500, 1000, 5000])
const BETTING_SECONDS = 10
const SETTLED_SECONDS = 7
const DEALING_DELAY_MS = 700
const DISCONNECT_CASHOUT_MS = 30_000

function cloneBets(bets: BaccaratBets = EMPTY_BETS): BaccaratBets {
  return { player: bets.player ?? 0, tie: bets.tie ?? 0, banker: bets.banker ?? 0 }
}

function totalBets(bets: BaccaratBets) {
  return bets.player + bets.tie + bets.banker
}

function addBets(total: BaccaratBets, next: BaccaratBets) {
  total.player += next.player
  total.tie += next.tie
  total.banker += next.banker
}

function createShoe() {
  const cards: BaccaratCard[] = []

  for (let deck = 0; deck < 8; deck++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) cards.push({ rank, suit })
    }
  }

  for (let index = cards.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = cards[index]
    cards[index] = cards[swapIndex]
    cards[swapIndex] = current
  }

  return cards
}

function baccaratValue(card: BaccaratCard) {
  if (card.rank === 'A') return 1
  if (card.rank === '10' || card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 0
  return Number(card.rank)
}

function handTotal(cards: BaccaratCard[]) {
  return cards.reduce((sum, card) => sum + baccaratValue(card), 0) % 10
}

function shouldBankerDraw(bankerTotal: number, playerThirdCard: BaccaratCard | null) {
  if (!playerThirdCard) return bankerTotal <= 5

  const playerThirdValue = baccaratValue(playerThirdCard)
  if (bankerTotal <= 2) return true
  if (bankerTotal === 3) return playerThirdValue !== 8
  if (bankerTotal === 4) return playerThirdValue >= 2 && playerThirdValue <= 7
  if (bankerTotal === 5) return playerThirdValue >= 4 && playerThirdValue <= 7
  if (bankerTotal === 6) return playerThirdValue === 6 || playerThirdValue === 7
  return false
}

function totalWord(value: number) {
  return ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][value] ?? String(value)
}

function formatDealerCall(result: BaccaratRoundResult) {
  const winnerCall = result.winner === 'player' ? 'Player wins.' : result.winner === 'banker' ? 'Banker wins.' : 'Tie.'

  if (result.natural) {
    const naturalCalls = [
      result.playerTotal >= 8 ? `Player natural ${totalWord(result.playerTotal)}.` : '',
      result.bankerTotal >= 8 ? `Banker natural ${totalWord(result.bankerTotal)}.` : '',
    ].filter(Boolean)

    return [...naturalCalls, winnerCall].join(' ')
  }

  return `Player, ${totalWord(result.playerTotal)}. Banker, ${totalWord(result.bankerTotal)}. ${winnerCall}`
}

function payoutForBets(bets: BaccaratBets, winner: BaccaratWinner) {
  let returns = 0

  if (winner === 'player') returns += bets.player * 2
  if (winner === 'banker') returns += bets.banker + Math.floor(bets.banker * 0.95)
  if (winner === 'tie') {
    returns += bets.tie * 9
    returns += bets.player + bets.banker
  }

  return returns
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export class BaccaratRoom {
  public readonly tableId: string
  public state: BaccaratServerState
  private io: Server
  private bettingTimer: NodeJS.Timeout | null = null
  private dealTimer: NodeJS.Timeout | null = null
  private nextRoundTimer: NodeJS.Timeout | null = null
  private disconnectTimers = new Map<string, NodeJS.Timeout>()

  constructor(io: Server, tableInfo: TableInfo) {
    this.io = io
    this.tableId = tableInfo.id
    this.state = {
      tableId: tableInfo.id,
      tableName: tableInfo.name,
      tableKind: tableInfo.tableKind ?? 'custom',
      houseSeat: tableInfo.houseSeat,
      minBet: tableInfo.smallBlind,
      maxBet: tableInfo.bigBlind,
      minBuyin: tableInfo.minBuyin,
      maxBuyin: tableInfo.maxBuyin,
      maxPlayers: tableInfo.maxPlayers,
      status: 'waiting',
      phase: 'betting',
      deck: createShoe(),
      players: new Map(),
      socketToSeat: new Map(),
      observers: new Map(),
      bets: new Map(),
      lastBets: new Map(),
      road: [],
      roundNumber: 0,
      result: null,
      message: 'Place your bets. 100 minimum.',
      messageUpdatedAt: Date.now(),
      dealerTips: {},
      bettingEndsAt: null,
      nextRoundStartsAt: null,
    }
  }

  getPlayerCount() {
    return this.state.players.size
  }

  getObserverCount() {
    return this.state.observers.size
  }

  shouldKeepAlive() {
    if (this.state.tableKind === 'house') return true
    return this.getPlayerCount() > 0 || this.getObserverCount() > 0
  }

  isFull() {
    return this.getPlayerCount() >= this.state.maxPlayers
  }

  isRoundLocked() {
    return this.state.phase !== 'betting'
  }

  hasPlayer(playerId: string) {
    return Array.from(this.state.players.values()).some((player) => player.playerId === playerId)
  }

  hasObserver(playerId: string) {
    return this.state.observers.has(playerId)
  }

  getPlayerBySocketId(socketId: string) {
    const seat = this.state.socketToSeat.get(socketId)
    if (seat === undefined) return null
    return this.state.players.get(seat) ?? null
  }

  getPlayerByPlayerId(playerId: string) {
    return Array.from(this.state.players.values()).find((player) => player.playerId === playerId) ?? null
  }

  getObserverBySocketId(socketId: string) {
    return Array.from(this.state.observers.values()).find((observer) => observer.socketId === socketId) ?? null
  }

  getObserverByPlayerId(playerId: string) {
    return this.state.observers.get(playerId) ?? null
  }

  firstOpenSeat() {
    for (let seat = 0; seat < this.state.maxPlayers; seat++) {
      if (!this.state.players.has(seat)) return seat
    }
    return null
  }

  addPlayer(player: Omit<BaccaratServerPlayer, 'seat' | 'isConnected'>, preferredSeat?: number) {
    if (this.isFull()) return { error: 'No seats available' }
    const seat = Number.isInteger(preferredSeat) && preferredSeat! >= 0 && preferredSeat! < this.state.maxPlayers && !this.state.players.has(preferredSeat!)
      ? preferredSeat!
      : this.firstOpenSeat()

    if (seat === null) return { error: 'No seats available' }

    const seated: BaccaratServerPlayer = {
      ...player,
      seat,
      isConnected: true,
    }
    this.state.players.set(seat, seated)
    this.state.socketToSeat.set(seated.socketId, seat)
    this.state.observers.delete(seated.playerId)
    this.io.sockets.sockets.get(seated.socketId)?.join(this.tableId)
    this.setMessage(`Welcome, ${seated.username}.`)
    this.syncTableStatus()
    this.broadcastState()
    this.emitTableUpdated()
    return { ok: true, player: seated, seat }
  }

  addObserver(observer: BaccaratServerObserver) {
    this.state.observers.set(observer.playerId, observer)
    this.io.sockets.sockets.get(observer.socketId)?.join(this.tableId)
    this.broadcastState()
  }

  removeObserver(playerId: string) {
    const observer = this.state.observers.get(playerId)
    if (!observer) return null
    this.io.sockets.sockets.get(observer.socketId)?.leave(this.tableId)
    this.state.observers.delete(playerId)
    this.broadcastState()
    return observer
  }

  seatObserver(socketId: string, requestedSeat?: number) {
    if (this.isRoundLocked()) return { error: 'Please wait for the next betting round' }
    const observer = this.getObserverBySocketId(socketId)
    if (!observer) return { error: 'Not waiting at this Baccarat table' }
    const res = this.addPlayer(
      {
        socketId: observer.socketId,
        playerId: observer.playerId,
        username: observer.username,
        avatar: observer.avatar,
        stack: observer.stack,
        hasTableEntry: observer.hasTableEntry,
      },
      Number(requestedSeat)
    )
    if (res.error || !res.player) return res
    return { ok: true, player: res.player, observer, seat: res.seat }
  }

  standPlayerUp(socketId: string) {
    if (this.isRoundLocked()) return { error: 'Please wait for the current round to finish' }
    const player = this.getPlayerBySocketId(socketId)
    if (!player) return { error: 'Not seated at this Baccarat table' }
    const bets = this.state.bets.get(player.playerId)
    const stake = bets ? totalBets(bets) : 0
    if (stake > 0) {
      player.stack += stake
      this.state.bets.delete(player.playerId)
    }

    this.state.players.delete(player.seat)
    this.state.socketToSeat.delete(player.socketId)
    const observer: BaccaratServerObserver = {
      socketId: player.socketId,
      playerId: player.playerId,
      username: player.username,
      avatar: player.avatar,
      stack: player.stack,
      hasTableEntry: player.hasTableEntry,
    }
    this.state.observers.set(observer.playerId, observer)
    this.maybeResetBettingCountdown()
    this.syncTableStatus()
    this.broadcastState()
    this.emitTableUpdated()
    return { ok: true, observer, stack: observer.stack }
  }

  async removePlayer(player: BaccaratServerPlayer) {
    const bets = this.state.bets.get(player.playerId)
    const betRefund = this.state.phase === 'betting' && bets ? totalBets(bets) : 0
    const cashout = player.stack + betRefund
    this.clearDisconnectTimer(player.playerId)
    this.state.players.delete(player.seat)
    this.state.socketToSeat.delete(player.socketId)
    this.state.bets.delete(player.playerId)
    this.io.sockets.sockets.get(player.socketId)?.leave(this.tableId)
    this.maybeResetBettingCountdown()
    this.syncTableStatus()
    this.broadcastState()
    this.emitTableUpdated()
    return { player, cashout }
  }

  reconnectPlayer(playerId: string, socketId: string) {
    const player = this.getPlayerByPlayerId(playerId)
    if (player) {
      this.clearDisconnectTimer(playerId)
      this.state.socketToSeat.delete(player.socketId)
      player.socketId = socketId
      player.isConnected = true
      this.state.socketToSeat.set(socketId, player.seat)
      this.io.sockets.sockets.get(socketId)?.join(this.tableId)
      this.broadcastState()
      return true
    }

    const observer = this.getObserverByPlayerId(playerId)
    if (!observer) return false
    observer.socketId = socketId
    this.io.sockets.sockets.get(socketId)?.join(this.tableId)
    this.broadcastState()
    return true
  }

  handleDisconnect(socketId: string, onTimeout?: (player: BaccaratServerPlayer, cashout: number) => Promise<void>) {
    const observer = this.getObserverBySocketId(socketId)
    if (observer) {
      this.removeObserver(observer.playerId)
      return { observer }
    }

    const player = this.getPlayerBySocketId(socketId)
    if (!player) return null

    player.isConnected = false
    this.broadcastState()
    this.scheduleDisconnectCashout(player.playerId, onTimeout)
    return { player }
  }

  placeBet(socketId: string, spot: BaccaratBetKey, amount: number) {
    const player = this.getPlayerBySocketId(socketId)
    if (!player) return { error: 'Take a seat to bet' }
    if (this.state.phase !== 'betting') return { error: 'Bets are closed for this round' }
    if (!['player', 'tie', 'banker'].includes(spot)) return { error: 'Invalid Baccarat bet' }
    if (!Number.isInteger(amount) || !CHIP_VALUES.has(amount)) return { error: 'Invalid Baccarat chip' }
    if (player.stack < amount) return { error: 'Not enough table chips' }

    const current = cloneBets(this.state.bets.get(player.playerId))
    if (totalBets(current) + amount > this.state.maxBet) {
      return { error: `Table maximum is ${this.state.maxBet.toLocaleString()} chips` }
    }

    player.stack -= amount
    current[spot] += amount
    this.state.bets.set(player.playerId, current)
    this.state.result = null
    this.ensureBettingCountdown()
    this.broadcastState()
    return { ok: true, stack: player.stack, bets: current }
  }

  clearBets(socketId: string) {
    const player = this.getPlayerBySocketId(socketId)
    if (!player) return { error: 'Not seated at this Baccarat table' }
    if (this.state.phase !== 'betting') return { error: 'Bets are closed for this round' }

    const current = this.state.bets.get(player.playerId)
    const stake = current ? totalBets(current) : 0
    if (stake <= 0) return { error: 'No bet to clear' }

    player.stack += stake
    this.state.bets.delete(player.playerId)
    this.maybeResetBettingCountdown()
    this.broadcastState()
    return { ok: true, stack: player.stack, bets: cloneBets() }
  }

  rebet(socketId: string) {
    const player = this.getPlayerBySocketId(socketId)
    if (!player) return { error: 'Not seated at this Baccarat table' }
    if (this.state.phase !== 'betting') return { error: 'Bets are closed for this round' }

    const last = cloneBets(this.state.lastBets.get(player.playerId))
    const lastStake = totalBets(last)
    if (lastStake <= 0) return { error: 'No previous Baccarat bet' }
    if (lastStake > this.state.maxBet) return { error: `Table maximum is ${this.state.maxBet.toLocaleString()} chips` }

    const current = this.state.bets.get(player.playerId)
    const currentStake = current ? totalBets(current) : 0
    const available = player.stack + currentStake
    if (available < lastStake) return { error: 'Not enough table chips' }

    player.stack = available - lastStake
    this.state.bets.set(player.playerId, last)
    this.ensureBettingCountdown()
    this.broadcastState()
    return { ok: true, stack: player.stack, bets: last }
  }

  doubleBets(socketId: string) {
    const player = this.getPlayerBySocketId(socketId)
    if (!player) return { error: 'Not seated at this Baccarat table' }
    if (this.state.phase !== 'betting') return { error: 'Bets are closed for this round' }

    const current = cloneBets(this.state.bets.get(player.playerId))
    const stake = totalBets(current)
    if (stake <= 0) return { error: 'Place a bet first' }
    if (stake * 2 > this.state.maxBet) return { error: `Table maximum is ${this.state.maxBet.toLocaleString()} chips` }
    if (player.stack < stake) return { error: 'Not enough table chips' }

    player.stack -= stake
    const doubled = {
      player: current.player * 2,
      tie: current.tie * 2,
      banker: current.banker * 2,
    }
    this.state.bets.set(player.playerId, doubled)
    this.ensureBettingCountdown()
    this.broadcastState()
    return { ok: true, stack: player.stack, bets: doubled }
  }

  tipDealer(socketId: string, dealerId: string, amount: number) {
    const player = this.getPlayerBySocketId(socketId)
    if (!player) return { error: 'Only seated players can tip the dealer' }
    if (!Number.isInteger(amount) || amount !== 100) return { error: 'Invalid tip amount' }
    if (player.stack < amount) return { error: 'Not enough table chips' }

    player.stack -= amount
    this.state.dealerTips = {
      ...this.state.dealerTips,
      [dealerId]: (this.state.dealerTips[dealerId] ?? 0) + amount,
    }
    this.broadcastState()
    return { ok: true, stack: player.stack }
  }

  addToStack(playerId: string, amount: number) {
    const player = this.getPlayerByPlayerId(playerId)
    if (player) {
      player.stack += amount
      this.broadcastState()
      return { ok: true, stack: player.stack }
    }

    const observer = this.getObserverByPlayerId(playerId)
    if (!observer) return { error: 'Not at this Baccarat table' }
    observer.stack += amount
    this.broadcastState()
    return { ok: true, stack: observer.stack }
  }

  getSnapshot(): BaccaratTableInfo {
    return {
      id: this.tableId,
      name: this.state.tableName,
      hostId: null,
      tableKind: this.state.tableKind,
      houseSeat: this.state.houseSeat,
      maxPlayers: this.state.maxPlayers,
      minBet: this.state.minBet,
      maxBet: this.state.maxBet,
      minBuyin: this.state.minBuyin,
      maxBuyin: this.state.maxBuyin,
      status: this.state.status,
      playerCount: this.getPlayerCount(),
      gameType: 'baccarat',
    }
  }

  broadcastState() {
    for (const player of this.state.players.values()) {
      this.io.to(player.socketId).emit('baccarat_state', this.clientStateFor(player.playerId))
    }
    for (const observer of this.state.observers.values()) {
      this.io.to(observer.socketId).emit('baccarat_state', this.clientStateFor(observer.playerId))
    }
  }

  destroy() {
    this.clearBettingCountdown()
    if (this.dealTimer) clearTimeout(this.dealTimer)
    if (this.nextRoundTimer) clearTimeout(this.nextRoundTimer)
    for (const timer of this.disconnectTimers.values()) clearTimeout(timer)
    this.disconnectTimers.clear()
  }

  private setMessage(message: string) {
    this.state.message = message
    this.state.messageUpdatedAt = Date.now()
  }

  private tableBetTotals() {
    const totals = cloneBets()
    for (const bets of this.state.bets.values()) addBets(totals, bets)
    return totals
  }

  private tableStake() {
    return totalBets(this.tableBetTotals())
  }

  private ensureBettingCountdown() {
    if (this.state.bettingEndsAt || this.state.phase !== 'betting') return
    if (this.tableStake() < this.state.minBet) return

    this.state.bettingEndsAt = Date.now() + BETTING_SECONDS * 1000
    this.setMessage('Place your bets, please.')
    this.bettingTimer = setTimeout(() => {
      this.settleRound().catch(console.error)
    }, BETTING_SECONDS * 1000)
  }

  private maybeResetBettingCountdown() {
    if (this.state.phase !== 'betting') return
    if (this.tableStake() >= this.state.minBet) return
    this.clearBettingCountdown()
    this.state.bettingEndsAt = null
    this.setMessage('Place your bets. 100 minimum.')
  }

  private clearBettingCountdown() {
    if (this.bettingTimer) clearTimeout(this.bettingTimer)
    this.bettingTimer = null
  }

  private async settleRound() {
    if (this.state.phase !== 'betting') return
    if (this.tableStake() < this.state.minBet) {
      this.maybeResetBettingCountdown()
      this.broadcastState()
      return
    }

    this.clearBettingCountdown()
    this.state.phase = 'dealing'
    this.state.status = 'playing'
    this.state.bettingEndsAt = null
    this.setMessage('No more bets.')
    this.syncTableStatus()
    this.broadcastState()
    this.emitTableUpdated()

    this.dealTimer = setTimeout(() => {
      this.resolveRound().catch(console.error)
    }, DEALING_DELAY_MS)
  }

  private async resolveRound() {
    if (this.state.deck.length < 60) this.state.deck = createShoe()
    const draw = () => {
      const card = this.state.deck.pop()
      if (!card) throw new Error('Baccarat shoe is empty')
      return card
    }

    const playerCards = [draw(), draw()]
    const bankerCards = [draw(), draw()]
    let playerTotal = handTotal(playerCards)
    let bankerTotal = handTotal(bankerCards)
    const natural = playerTotal >= 8 || bankerTotal >= 8
    let playerThirdCard: BaccaratCard | null = null

    if (!natural) {
      if (playerTotal <= 5) {
        playerThirdCard = draw()
        playerCards.push(playerThirdCard)
        playerTotal = handTotal(playerCards)
      }

      if (shouldBankerDraw(bankerTotal, playerThirdCard)) {
        bankerCards.push(draw())
        bankerTotal = handTotal(bankerCards)
      }
    }

    const winner: BaccaratWinner = playerTotal > bankerTotal ? 'player' : bankerTotal > playerTotal ? 'banker' : 'tie'
    const netByPlayerId: Record<string, number> = {}
    const playedPlayerIds: string[] = []
    const winnerIds: string[] = []

    for (const player of this.state.players.values()) {
      const bets = cloneBets(this.state.bets.get(player.playerId))
      const stake = totalBets(bets)
      if (stake <= 0) continue

      const returns = payoutForBets(bets, winner)
      const net = returns - stake
      player.stack += returns
      netByPlayerId[player.playerId] = net
      this.state.lastBets.set(player.playerId, bets)
      if (isUuid(player.playerId)) {
        playedPlayerIds.push(player.playerId)
        if (net > 0) winnerIds.push(player.playerId)
      }
    }

    this.state.bets.clear()
    this.state.roundNumber += 1
    const label = winner === 'player' ? 'Player wins' : winner === 'banker' ? 'Banker wins' : 'Tie hand'
    const result: BaccaratRoundResult = {
      id: this.state.roundNumber,
      winner,
      playerCards,
      bankerCards,
      playerTotal,
      bankerTotal,
      natural,
      label,
      netByPlayerId,
    }

    this.state.result = result
    const roadItem: BaccaratRoadItem = {
      id: result.id,
      winner: result.winner,
      playerTotal: result.playerTotal,
      bankerTotal: result.bankerTotal,
      natural: result.natural,
    }
    this.state.road = [...this.state.road.slice(-41), roadItem]
    this.state.phase = 'settled'
    this.setMessage(formatDealerCall(result))
    this.state.nextRoundStartsAt = Date.now() + SETTLED_SECONDS * 1000
    this.broadcastState()

    await this.persistRound(playedPlayerIds, winnerIds)

    this.nextRoundTimer = setTimeout(() => {
      this.beginBettingRound()
    }, SETTLED_SECONDS * 1000)
  }

  private beginBettingRound() {
    this.state.phase = 'betting'
    this.state.status = 'waiting'
    this.state.result = null
    this.state.nextRoundStartsAt = null
    this.setMessage('Place your bets. 100 minimum.')
    this.syncTableStatus()
    this.broadcastState()
    this.emitTableUpdated()
  }

  private async persistRound(playedPlayerIds: string[], winnerIds: string[]) {
    if (isLocalOnlyTable(this.tableId)) return

    try {
      if (!isMemoryOnlyTable(this.tableId)) {
        await Promise.all(
          Array.from(this.state.players.values())
            .filter((player) => isUuid(player.playerId))
            .map((player) => supabaseService.updateTablePlayerStack(this.tableId, player.playerId, player.stack))
        )
      }
      await supabaseService.incrementGamesPlayed(playedPlayerIds)
      await supabaseService.incrementGamesWon(winnerIds)
    } catch (error) {
      console.error('baccarat persist round failed:', error)
    }
  }

  private scheduleDisconnectCashout(playerId: string, onTimeout?: (player: BaccaratServerPlayer, cashout: number) => Promise<void>) {
    this.clearDisconnectTimer(playerId)
    const timer = setTimeout(() => {
      const player = this.getPlayerByPlayerId(playerId)
      if (!player || player.isConnected) return

      if (this.isRoundLocked() && totalBets(cloneBets(this.state.bets.get(playerId))) > 0) {
        this.scheduleDisconnectCashout(playerId, onTimeout)
        return
      }

      this.removePlayer(player)
        .then((removed) => onTimeout?.(removed.player, removed.cashout))
        .catch(console.error)
    }, DISCONNECT_CASHOUT_MS)
    this.disconnectTimers.set(playerId, timer)
  }

  private clearDisconnectTimer(playerId: string) {
    const timer = this.disconnectTimers.get(playerId)
    if (timer) clearTimeout(timer)
    this.disconnectTimers.delete(playerId)
  }

  private clientStateFor(playerId: string): ClientBaccaratState {
    const result = this.state.result

    return {
      tableId: this.tableId,
      tableName: this.state.tableName,
      tableKind: this.state.tableKind,
      houseSeat: this.state.houseSeat,
      phase: this.state.phase,
      status: this.state.status,
      minBet: this.state.minBet,
      maxBet: this.state.maxBet,
      minBuyin: this.state.minBuyin,
      maxBuyin: this.state.maxBuyin,
      maxPlayers: this.state.maxPlayers,
      roundNumber: this.state.roundNumber,
      players: Array.from(this.state.players.values())
        .sort((a, b) => a.seat - b.seat)
        .map((player) => ({
          playerId: player.playerId,
          username: player.username,
          avatar: player.avatar,
          seat: player.seat,
          stack: player.stack,
          betTotal: totalBets(cloneBets(this.state.bets.get(player.playerId))),
          isConnected: player.isConnected,
        })),
      observers: Array.from(this.state.observers.values()).map((observer) => ({
        playerId: observer.playerId,
        username: observer.username,
        avatar: observer.avatar,
        stack: observer.stack,
      })),
      bets: cloneBets(this.state.bets.get(playerId)),
      lastBets: cloneBets(this.state.lastBets.get(playerId)),
      tableBets: this.tableBetTotals(),
      road: this.state.road,
      result: result ? {
        id: result.id,
        winner: result.winner,
        playerCards: result.playerCards,
        bankerCards: result.bankerCards,
        playerTotal: result.playerTotal,
        bankerTotal: result.bankerTotal,
        natural: result.natural,
        label: result.label,
        net: result.netByPlayerId[playerId] ?? 0,
      } : null,
      myPlayerId: playerId,
      message: this.state.message,
      messageUpdatedAt: this.state.messageUpdatedAt,
      dealerTips: { ...this.state.dealerTips },
      shoeCardsLeft: this.state.deck.length,
      bettingEndsAt: this.state.bettingEndsAt,
      nextRoundStartsAt: this.state.nextRoundStartsAt,
    }
  }

  private syncTableStatus() {
    const status = this.state.phase === 'betting' ? 'waiting' : 'playing'
    this.state.status = status
    if (isMemoryOnlyTable(this.tableId)) return
    supabaseService.updateTableStatus(this.tableId, status, this.getPlayerCount()).catch(console.error)
  }

  private emitTableUpdated() {
    this.io.emit('baccarat_table_updated', this.getSnapshot())
  }
}
