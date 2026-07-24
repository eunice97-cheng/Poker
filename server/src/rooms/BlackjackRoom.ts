import { randomInt } from 'crypto'
import { Server } from 'socket.io'
import { TableInfo } from '../types/game'
import {
  BlackjackAction,
  BlackjackCard,
  BlackjackHand,
  BlackjackServerObserver,
  BlackjackRank,
  BlackjackServerPlayer,
  BlackjackServerState,
  BlackjackSuit,
  BlackjackTableInfo,
  ClientBlackjackState,
} from '../types/blackjack'
import { supabaseService } from '../services/supabaseService'
import { isLocalOnlyTable } from '../utils/localAdmin'

const SUITS: BlackjackSuit[] = ['S', 'H', 'D', 'C']
const RANKS: { rank: BlackjackRank; value: number }[] = [
  { rank: 'A', value: 11 },
  { rank: '2', value: 2 },
  { rank: '3', value: 3 },
  { rank: '4', value: 4 },
  { rank: '5', value: 5 },
  { rank: '6', value: 6 },
  { rank: '7', value: 7 },
  { rank: '8', value: 8 },
  { rank: '9', value: 9 },
  { rank: '10', value: 10 },
  { rank: 'J', value: 10 },
  { rank: 'Q', value: 10 },
  { rank: 'K', value: 10 },
]

const DECK_COUNT = 8
const CUT_CARD_THRESHOLD = 80
const MAX_SPLIT_HANDS = 4
const RECONNECT_GRACE_MS = 60_000
const BETTING_WINDOW_MS = 10_000
const INSURANCE_WINDOW_MS = 10_000
const TURN_WINDOW_MS = 10_000
const NEXT_ROUND_DELAY_MS = 5_000
const BET_CLOSED_PAUSE_MS = 1_300
const PLAYER_BLACKJACK_PAUSE_MS = 1_850
const DEALER_TURN_PAUSE_MS = 1_600
const DEALER_CARD_PAUSE_MS = 700
const DEALER_RESULT_HOLD_MS = 3_500
const MAX_MISSED_BET_ROUNDS = 3

function createShoe() {
  const cards: BlackjackCard[] = []

  for (let deck = 0; deck < DECK_COUNT; deck++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ ...rank, suit })
      }
    }
  }

  for (let i = cards.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    const current = cards[i]
    cards[i] = cards[j]
    cards[j] = current
  }

  return cards
}

function scoreHand(cards: BlackjackCard[]) {
  let total = cards.reduce((sum, card) => sum + card.value, 0)
  let aces = cards.filter((card) => card.rank === 'A').length

  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }

  return total
}

function isNaturalBlackjack(hand: BlackjackHand) {
  return !hand.fromSplit && hand.cards.length === 2 && scoreHand(hand.cards) === 21
}

function isSameRankPair(hand: BlackjackHand) {
  return hand.cards.length === 2 && hand.cards[0].rank === hand.cards[1].rank
}

function hasPlayableHand(player: BlackjackServerPlayer) {
  return player.hands.some((hand) => hand.status === 'playing')
}

function handLabel(index: number) {
  return index === 0 ? 'hand' : `hand ${index + 1}`
}

function randomChoice<T>(values: T[]) {
  return values[randomInt(values.length)]
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export class BlackjackRoom {
  public readonly tableId: string
  public state: BlackjackServerState
  private io: Server
  private bettingTimer: NodeJS.Timeout | null = null
  private insuranceTimer: NodeJS.Timeout | null = null
  private turnTimer: NodeJS.Timeout | null = null
  private nextRoundTimer: NodeJS.Timeout | null = null
  private settlingRound = false
  private personalDealerMessages = new Map<string, { message: string; updatedAt: number }>()

  constructor(io: Server, tableInfo: TableInfo) {
    this.io = io
    this.tableId = tableInfo.id
    this.state = {
      tableId: tableInfo.id,
      tableName: tableInfo.name,
      minBet: tableInfo.smallBlind,
      maxBet: tableInfo.bigBlind,
      minBuyin: tableInfo.minBuyin,
      maxBuyin: tableInfo.maxBuyin,
      maxPlayers: tableInfo.maxPlayers,
      status: 'waiting',
      phase: 'betting',
      deck: createShoe(),
      shuffleDue: false,
      dealerCards: [],
      hideHoleCard: true,
      players: new Map(),
      socketToSeat: new Map(),
      observers: new Map(),
      currentSeat: -1,
      roundNumber: 0,
      message: 'Place your bets, please.',
      messageUpdatedAt: Date.now(),
      dealerTips: {},
      bettingEndsAt: null,
      insuranceEndsAt: null,
      turnEndsAt: null,
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
    return this.getPlayerCount() > 0 || this.getObserverCount() > 0
  }

  isFull() {
    return this.state.players.size >= this.state.maxPlayers
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

  findEmptySeat() {
    for (let i = 0; i < this.state.maxPlayers; i++) {
      if (!this.state.players.has(i)) return i
    }

    return null
  }

  addPlayer(player: BlackjackServerPlayer) {
    this.state.observers.delete(player.playerId)
    this.state.players.set(player.seat, player)
    this.state.socketToSeat.set(player.socketId, player.seat)
    this.io.sockets.sockets.get(player.socketId)?.join(this.tableId)
    this.log(`${player.username} joins the blackjack table`)
    this.setDealerMessage(this.welcomeLine(player.username))
    this.syncTableStatus()
    this.broadcastState()
    this.emitTableUpdated()
  }

  addObserver(observer: BlackjackServerObserver) {
    this.state.observers.set(observer.playerId, observer)
    this.io.sockets.sockets.get(observer.socketId)?.join(this.tableId)
    this.setDealerMessage(this.isRoundLocked() ? 'Feel free to join the next round.' : this.welcomeLine(observer.username))
    this.syncTableStatus()
    this.broadcastState()
    this.emitTableUpdated()
  }

  removeObserver(playerId: string) {
    const observer = this.state.observers.get(playerId)
    if (!observer) return null

    this.state.observers.delete(playerId)
    this.io.sockets.sockets.get(observer.socketId)?.leave(this.tableId)
    this.syncTableStatus()
    this.broadcastState()
    this.emitTableUpdated()
    return observer
  }

  reconnectPlayer(playerId: string, socketId: string) {
    const player = this.getPlayerByPlayerId(playerId)
    if (!player) return false

    this.state.socketToSeat.delete(player.socketId)
    this.state.socketToSeat.set(socketId, player.seat)
    player.socketId = socketId
    player.isConnected = true

    if (player.reconnectTimer) {
      clearTimeout(player.reconnectTimer)
      player.reconnectTimer = undefined
    }

    this.io.sockets.sockets.get(socketId)?.join(this.tableId)
    this.broadcastState()
    return true
  }

  reconnectObserver(playerId: string, socketId: string) {
    const observer = this.getObserverByPlayerId(playerId)
    if (!observer) return false

    observer.socketId = socketId
    this.io.sockets.sockets.get(socketId)?.join(this.tableId)
    this.broadcastState()
    return true
  }

  standPlayerUp(socketId: string) {
    const player = this.getPlayerBySocketId(socketId)
    if (!player) return { error: 'Not seated at this blackjack table' }
    if (this.isRoundLocked() && this.hasRoundHand(player)) return { error: 'Please wait for the current round to finish' }

    const observer = this.movePlayerToObserver(player)
    if (!this.hasAnyBetOnTable()) this.clearBettingCountdown()
    this.setDealerMessage(`Thanks for playing, ${player.username}.`)
    this.syncTableStatus()
    this.broadcastState()
    this.emitTableUpdated()
    return { ok: true, observer }
  }

  seatObserver(socketId: string, requestedSeat?: number) {
    const observer = this.getObserverBySocketId(socketId)
    if (!observer) return { error: 'Not waiting at this blackjack table' }
    if (this.isFull()) return { error: 'No seats available' }

    const requested = Number.isInteger(requestedSeat) ? Number(requestedSeat) : null
    const seat = requested !== null && requested >= 0 && requested < this.state.maxPlayers && !this.state.players.has(requested)
      ? requested
      : this.findEmptySeat()

    if (seat === null) return { error: 'No seats available' }

    this.state.observers.delete(observer.playerId)

    const player: BlackjackServerPlayer = {
      socketId: observer.socketId,
      playerId: observer.playerId,
      username: observer.username,
      avatar: observer.avatar,
      seat,
      stack: observer.stack,
      bet: 0,
      insuranceBet: 0,
      hands: [],
      activeHandIndex: 0,
      isConnected: true,
      lastNet: 0,
      lastResult: '',
      missedBetRounds: 0,
    }

    this.state.players.set(seat, player)
    this.state.socketToSeat.set(player.socketId, seat)
    this.io.sockets.sockets.get(player.socketId)?.join(this.tableId)
    this.setDealerMessage(this.isRoundLocked() ? 'Feel free to join the next round.' : this.hasAnyBetOnTable() ? 'Betting is now open.' : 'Place your bets, please.')
    this.syncTableStatus()
    this.broadcastState()
    this.emitTableUpdated()
    return { ok: true, seat, player, observer }
  }

  async removePlayerBySocketId(socketId: string) {
    const player = this.getPlayerBySocketId(socketId)
    if (!player) return null
    return this.removePlayer(player)
  }

  async removePlayer(player: BlackjackServerPlayer) {
    const wasCurrentTurn = player.seat === this.state.currentSeat
    const cashout = this.state.phase === 'betting' ? player.stack + player.bet : player.stack

    this.state.players.delete(player.seat)
    this.state.socketToSeat.delete(player.socketId)
    this.io.sockets.sockets.get(player.socketId)?.leave(this.tableId)
    this.log(`${player.username} leaves the blackjack table`)
    this.setDealerMessage(`See you next time, ${player.username}.`)

    if (wasCurrentTurn && this.state.phase === 'playing') {
      await this.advanceTurn()
    } else if (this.state.phase === 'playing' && !this.anyHandsInPlay()) {
      await this.settleRound()
    }

    if (this.state.phase === 'betting' && !this.hasAnyBetOnTable()) {
      this.clearBettingCountdown()
      this.setDealerMessage('Place your bets, please.')
    }

    this.syncTableStatus()
    this.broadcastState()
    this.emitTableUpdated()
    return { player, cashout }
  }

  handleDisconnect(socketId: string, onTimeout?: (player: BlackjackServerPlayer, cashout: number) => Promise<void>) {
    const player = this.getPlayerBySocketId(socketId)
    if (!player) return

    if (isLocalOnlyTable(this.tableId)) {
      this.removePlayer(player)
        .then((removed) => {
          if (!removed) return
          return onTimeout?.(removed.player, removed.cashout)
        })
        .catch(console.error)
      return
    }

    player.isConnected = false
    this.broadcastState()

    player.reconnectTimer = setTimeout(() => {
      this.removePlayer(player)
        .then((removed) => {
          if (!removed) return
          return onTimeout?.(removed.player, removed.cashout)
        })
        .catch(console.error)
    }, RECONNECT_GRACE_MS)
  }

  placeBet(socketId: string, amount: number) {
    const player = this.getPlayerBySocketId(socketId)
    if (!player) return { error: 'Not at this blackjack table' }
    if (this.state.phase !== 'betting') return { error: 'Bets are closed for this round' }
    if (!Number.isInteger(amount) || amount <= 0) return { error: 'Invalid bet amount' }
    if (player.stack < amount) return { error: 'Not enough table chips' }
    if (player.bet + amount > this.state.maxBet) {
      return { error: `Table maximum is ${this.state.maxBet.toLocaleString()} chips` }
    }

    player.stack -= amount
    player.bet += amount
    player.lastNet = 0
    player.lastResult = ''
    this.beginBettingCountdown()
    this.broadcastState()
    return { ok: true, stack: player.stack, bet: player.bet }
  }

  clearBet(socketId: string) {
    const player = this.getPlayerBySocketId(socketId)
    if (!player) return { error: 'Not at this blackjack table' }
    if (this.state.phase !== 'betting') return { error: 'Bets are closed for this round' }
    if (player.bet <= 0) return { error: 'No bet to clear' }

    player.stack += player.bet
    player.bet = 0
    if (!this.hasAnyBetOnTable()) {
      this.clearBettingCountdown()
      this.setDealerMessage('Place your bets, please.')
    }
    this.broadcastState()
    return { ok: true, stack: player.stack, bet: 0 }
  }

  buyInsurance(socketId: string) {
    const player = this.getPlayerBySocketId(socketId)
    if (!player) return { error: 'Not at this blackjack table' }
    if (this.state.phase !== 'insurance') return { error: 'Insurance is not available' }

    const dealerUpcard = this.state.dealerCards[0]
    if (dealerUpcard?.rank !== 'A') return { error: 'Insurance is only available against a dealer Ace' }
    if (player.insuranceBet > 0) return { error: 'Insurance already placed' }

    const hand = player.hands[0]
    if (!hand || hand.bet <= 0) return { error: 'No live hand to insure' }

    const amount = Math.floor(hand.bet / 2)
    if (amount <= 0) return { error: 'Insurance amount is too small' }
    if (player.stack < amount) return { error: 'Not enough table chips for insurance' }

    player.stack -= amount
    player.insuranceBet = amount
    this.broadcastState()
    return { ok: true, stack: player.stack, insuranceBet: amount }
  }

  async startRound(socketId?: string) {
    const caller = socketId ? this.getPlayerBySocketId(socketId) : null
    if (socketId && !caller) return { error: 'Not at this blackjack table' }
    if (this.state.phase !== 'betting') return { error: 'A round is already in progress' }

    const shortBet = Array.from(this.state.players.values()).find((player) => player.bet > 0 && player.bet < this.state.minBet)
    if (shortBet) {
      return { error: `${shortBet.username} needs at least ${this.state.minBet.toLocaleString()} chips on the table` }
    }

    const activePlayers = Array.from(this.state.players.values())
      .filter((player) => player.bet >= this.state.minBet)
      .sort((a, b) => a.seat - b.seat)

    if (activePlayers.length === 0) {
      return { error: 'At least one player needs a live bet' }
    }

    this.clearBettingCountdown()
    this.clearInsuranceCountdown()
    this.clearTurnCountdown()
    this.clearNextRoundCountdown()
    this.applyMissedBetStandUps(activePlayers.map((player) => player.playerId))
    this.setDealerMessage(randomChoice(['No more bets.', 'Bets are closed.']))
    this.broadcastState()
    await delay(BET_CLOSED_PAUSE_MS)

    this.prepareShoe()
    this.state.roundNumber++
    this.state.phase = 'playing'
    this.state.status = 'playing'
    this.state.dealerCards = []
    this.state.hideHoleCard = true
    this.state.currentSeat = -1

    for (const player of this.state.players.values()) {
      player.hands = []
      player.activeHandIndex = 0
      player.insuranceBet = 0
      player.lastNet = 0
      player.lastResult = ''
      if (player.bet >= this.state.minBet) {
        player.hands = [
          {
            cards: [],
            bet: player.bet,
            status: 'playing',
            fromSplit: false,
            doubled: false,
          },
        ]
      }
      player.bet = 0
    }

    for (let pass = 0; pass < 2; pass++) {
      for (const player of activePlayers) {
        player.hands[0].cards.push(this.drawCard())
      }
      this.state.dealerCards.push(this.drawCard())
    }

    const naturalBlackjackPlayers: BlackjackServerPlayer[] = []
    for (const player of activePlayers) {
      const hand = player.hands[0]
      if (isNaturalBlackjack(hand)) {
        hand.status = 'blackjack'
        naturalBlackjackPlayers.push(player)
      }
    }

    const dealerNatural = scoreHand(this.state.dealerCards) === 21
    const dealerShowsAce = this.state.dealerCards[0]?.rank === 'A'

    if (naturalBlackjackPlayers.length > 0) {
      this.setDealerMessage(randomChoice(['Natural twenty-one.', 'Blackjack! Congratulations.']))
      this.broadcastState()
      await delay(PLAYER_BLACKJACK_PAUSE_MS)
    }

    if (dealerShowsAce) {
      this.beginInsuranceCountdown(dealerNatural)
      return { ok: true }
    }

    if (dealerNatural) {
      await this.settleRound()
      return { ok: true }
    }

    await this.continueInitialDeal()
    return { ok: true }
  }

  private async continueInitialDeal() {
    const firstSeat = this.nextActingSeat(-1)
    if (firstSeat === null) {
      await this.settleRound()
      return
    }

    this.state.currentSeat = firstSeat
    const firstPlayer = this.state.players.get(firstSeat)!
    this.setDealerMessage(`${firstPlayer.username}'s turn.`)
    this.beginTurnCountdown()
    this.syncTableStatus()
    this.broadcastState()
    this.emitTableUpdated()
  }

  async handleAction(socketId: string, action: BlackjackAction) {
    const player = this.getPlayerBySocketId(socketId)
    if (!player) return { error: 'Not at this blackjack table' }
    if (this.state.phase === 'insurance') return { error: 'Insurance is still open' }
    if (this.state.phase !== 'playing') return { error: 'No blackjack round in progress' }
    if (player.seat !== this.state.currentSeat) return { error: 'It is not your turn' }

    const validActions = this.getValidActionsForPlayer(player)
    if (!validActions.includes(action)) return { error: 'That action is not available' }

    const hand = player.hands[player.activeHandIndex]
    if (!hand) return { error: 'No active hand' }

    this.clearTurnCountdown()

    switch (action) {
      case 'hit':
        hand.cards.push(this.drawCard())
        if (scoreHand(hand.cards) > 21) {
          hand.status = 'busted'
          this.setDealerMessage('Better luck next hand.')
          await this.advanceTurn()
        } else if (scoreHand(hand.cards) === 21) {
          hand.status = 'stood'
          this.setDealerMessage(randomChoice(['Natural twenty-one.', 'Blackjack! Congratulations.']))
          await this.advanceTurn()
        } else {
          this.beginTurnCountdown()
          this.broadcastState()
        }
        break

      case 'stand':
        hand.status = 'stood'
        await this.advanceTurn()
        break

      case 'double':
        player.stack -= hand.bet
        hand.bet *= 2
        hand.doubled = true
        hand.cards.push(this.drawCard())
        hand.status = scoreHand(hand.cards) > 21 ? 'busted' : 'stood'
        if (hand.status === 'busted') this.setDealerMessage('Better luck next hand.')
        await this.advanceTurn()
        break

      case 'split':
        await this.splitHand(player)
        break

      case 'surrender': {
        const refund = Math.floor(hand.bet / 2)
        player.stack += refund
        hand.status = 'surrendered'
        hand.net = refund - hand.bet
        hand.result = 'Surrender'
        await this.advanceTurn()
        break
      }
    }

    return { ok: true }
  }

  async newRound(socketId: string) {
    const player = this.getPlayerBySocketId(socketId)
    if (!player) return { error: 'Not at this blackjack table' }
    if (this.isRoundLocked()) return { error: 'Finish the current round first' }

    this.openBettingRound()
    return { ok: true }
  }

  async addToStack(playerId: string, amount: number) {
    const player = this.getPlayerByPlayerId(playerId)
    if (!player) return { error: 'Not at this blackjack table' }

    player.stack += amount
    if (!isLocalOnlyTable(this.tableId)) {
      await supabaseService.updateTablePlayerStack(this.tableId, player.playerId, player.stack)
    }
    this.broadcastState()
    return { ok: true, stack: player.stack }
  }

  setDealerTips(dealerTips: Record<string, number>) {
    this.state.dealerTips = { ...dealerTips }
  }

  addDealerTip(dealerId: string, amount: number) {
    this.state.dealerTips = {
      ...this.state.dealerTips,
      [dealerId]: (this.state.dealerTips[dealerId] ?? 0) + amount,
    }
  }

  getSnapshot(): BlackjackTableInfo {
    return {
      id: this.tableId,
      name: this.state.tableName,
      hostId: null,
      maxPlayers: this.state.maxPlayers,
      minBet: this.state.minBet,
      maxBet: this.state.maxBet,
      minBuyin: this.state.minBuyin,
      maxBuyin: this.state.maxBuyin,
      status: this.state.status,
      playerCount: this.getPlayerCount(),
      gameType: 'blackjack',
    }
  }

  broadcastState() {
    for (const player of this.state.players.values()) {
      this.io.to(player.socketId).emit('blackjack_state', this.clientStateFor(player.playerId))
    }
    for (const observer of this.state.observers.values()) {
      this.io.to(observer.socketId).emit('blackjack_state', this.clientStateFor(observer.playerId))
    }
  }

  destroy() {
    this.clearBettingCountdown()
    this.clearInsuranceCountdown()
    this.clearTurnCountdown()
    this.clearNextRoundCountdown()
    for (const player of this.state.players.values()) {
      if (player.reconnectTimer) clearTimeout(player.reconnectTimer)
    }
  }

  private async splitHand(player: BlackjackServerPlayer) {
    const hand = player.hands[player.activeHandIndex]
    const [firstCard, secondCard] = hand.cards

    player.stack -= hand.bet

    const firstHand: BlackjackHand = {
      cards: [firstCard, this.drawCard()],
      bet: hand.bet,
      status: 'playing',
      fromSplit: true,
      doubled: false,
    }
    const secondHand: BlackjackHand = {
      cards: [secondCard, this.drawCard()],
      bet: hand.bet,
      status: 'playing',
      fromSplit: true,
      doubled: false,
    }

    if (firstCard.rank === 'A') {
      firstHand.status = 'stood'
      secondHand.status = 'stood'
    }

    player.hands.splice(player.activeHandIndex, 1, firstHand, secondHand)

    if (firstHand.status === 'stood') {
      await this.advanceTurn()
    } else {
      this.beginTurnCountdown()
      this.broadcastState()
    }
  }

  private prepareShoe() {
    if (this.state.deck.length <= CUT_CARD_THRESHOLD || this.state.shuffleDue) {
      this.state.deck = createShoe()
      this.state.shuffleDue = false
    }
  }

  private drawCard() {
    if (this.state.deck.length === 0) {
      this.state.deck = createShoe()
      this.state.shuffleDue = false
    }

    const card = this.state.deck.pop()
    if (!card) throw new Error('Shoe is empty')
    if (this.state.deck.length <= CUT_CARD_THRESHOLD) {
      this.state.shuffleDue = true
    }
    return card
  }

  private anyHandsInPlay() {
    return Array.from(this.state.players.values()).some(hasPlayableHand)
  }

  private hasRoundHand(player: BlackjackServerPlayer) {
    return player.hands.some((hand) => hand.bet > 0)
  }

  private nextActingSeat(fromSeat: number) {
    for (let offset = 1; offset <= this.state.maxPlayers; offset++) {
      const seat = (fromSeat + offset + this.state.maxPlayers) % this.state.maxPlayers
      const player = this.state.players.get(seat)
      if (player && hasPlayableHand(player)) return seat
    }

    return null
  }

  private async advanceTurn() {
    const player = this.state.players.get(this.state.currentSeat)
    if (player) {
      const nextHandIndex = player.hands.findIndex((hand, index) => index > player.activeHandIndex && hand.status === 'playing')
      if (nextHandIndex !== -1) {
        player.activeHandIndex = nextHandIndex
        this.setDealerMessage(`${player.username}'s turn.`)
        this.beginTurnCountdown()
        this.broadcastState()
        return
      }
    }

    const nextSeat = this.nextActingSeat(this.state.currentSeat)
    if (nextSeat === null) {
      await this.settleRound()
      return
    }

    const nextPlayer = this.state.players.get(nextSeat)!
    nextPlayer.activeHandIndex = Math.max(0, nextPlayer.hands.findIndex((hand) => hand.status === 'playing'))
    this.state.currentSeat = nextSeat
    this.setDealerMessage(`${nextPlayer.username}'s turn.`)
    this.beginTurnCountdown()
    this.broadcastState()
  }

  private async settleRound() {
    if (this.state.phase === 'settled' || this.settlingRound) return
    this.settlingRound = true

    try {
      this.clearTurnCountdown()
      this.clearBettingCountdown()
      this.clearInsuranceCountdown()
      this.state.hideHoleCard = false
      this.state.currentSeat = -1

      const dealerNatural = this.state.dealerCards.length === 2 && scoreHand(this.state.dealerCards) === 21
      const needsDealerDraw = Array.from(this.state.players.values()).some((player) =>
        player.hands.some((hand) => hand.status !== 'busted' && hand.status !== 'surrendered' && hand.status !== 'blackjack')
      )

      if (!dealerNatural && needsDealerDraw) {
        this.setDealerMessage(`Dealer's turn.`)
        this.broadcastState()
        await delay(DEALER_TURN_PAUSE_MS)

        while (scoreHand(this.state.dealerCards) < 17) {
          this.state.dealerCards.push(this.drawCard())
          this.broadcastState()
          await delay(DEALER_CARD_PAUSE_MS)
        }
      }

      const dealerScore = scoreHand(this.state.dealerCards)
      const dealerBust = dealerScore > 21
      const playedPlayerIds: string[] = []
      const winnerIds: string[] = []
      const personalResultMessages = new Map<string, string>()

      for (const player of this.state.players.values()) {
        let net = 0
        const resultLabels: string[] = []
        const played = player.hands.some((hand) => hand.bet > 0)

        if (played) playedPlayerIds.push(player.playerId)

        for (const hand of player.hands) {
          if (hand.bet <= 0) continue

          if (hand.status === 'surrendered') {
            net += hand.net ?? -Math.ceil(hand.bet / 2)
            resultLabels.push(hand.result ?? 'Surrender')
            continue
          }

          const playerScore = scoreHand(hand.cards)

          if (hand.status === 'busted' || playerScore > 21) {
            hand.status = 'busted'
            hand.net = -hand.bet
            hand.result = 'Bust'
          } else if (dealerNatural) {
            if (isNaturalBlackjack(hand)) {
              player.stack += hand.bet
              hand.net = 0
              hand.result = 'Push'
            } else {
              hand.net = -hand.bet
              hand.result = 'Dealer blackjack'
            }
          } else if (isNaturalBlackjack(hand)) {
            const profit = Math.floor(hand.bet * 1.5)
            player.stack += hand.bet + profit
            hand.net = profit
            hand.result = 'Blackjack'
          } else if (dealerBust || playerScore > dealerScore) {
            player.stack += hand.bet * 2
            hand.net = hand.bet
            hand.result = 'Win'
          } else if (playerScore === dealerScore) {
            player.stack += hand.bet
            hand.net = 0
            hand.result = 'Push'
          } else {
            hand.net = -hand.bet
            hand.result = 'Lose'
          }

          net += hand.net
          resultLabels.push(hand.result)
        }

        if (player.insuranceBet > 0) {
          if (dealerNatural) {
            player.stack += player.insuranceBet * 3
            net += player.insuranceBet * 2
          } else {
            net -= player.insuranceBet
          }
        }

        player.lastNet = net
        player.lastResult = resultLabels.length > 0 ? resultLabels.join(', ') : ''
        player.activeHandIndex = 0

        if (net > 0) winnerIds.push(player.playerId)

        const hasOnlyNormalCompareResults = !dealerNatural
          && !dealerBust
          && resultLabels.length > 0
          && resultLabels.every((label) => label === 'Win' || label === 'Lose' || label === 'Push')

        if (!dealerNatural && resultLabels.includes('Blackjack')) {
          personalResultMessages.set(player.playerId, randomChoice(['Natural twenty-one.', 'Blackjack! Congratulations.']))
        } else if (hasOnlyNormalCompareResults) {
          personalResultMessages.set(
            player.playerId,
            net > 0
              ? `Well played, ${player.username}.`
              : net < 0
                ? `Close one, ${player.username}.`
                : 'A tie this round.'
          )
        }
      }

      this.state.phase = 'settled'
      this.state.status = 'waiting'
      if (dealerNatural) {
        this.setDealerMessage(randomChoice(['Natural blackjack for the dealer.', "That's a dealer blackjack."]))
      } else if (dealerBust) {
        this.setDealerMessage('All remaining hands win.')
      } else if (personalResultMessages.size > 0) {
        this.setPersonalDealerMessages(personalResultMessages)
      }

      this.syncTableStatus()
      this.broadcastState()
      this.emitTableUpdated()

      await this.persistRound(playedPlayerIds, winnerIds)
      await delay(DEALER_RESULT_HOLD_MS)
      this.beginNextRoundCountdown()
      this.broadcastState()
    } finally {
      this.settlingRound = false
    }
  }

  private async persistRound(playedPlayerIds: string[], winnerIds: string[]) {
    if (isLocalOnlyTable(this.tableId)) return

    try {
      await Promise.all(
        Array.from(this.state.players.values()).map((player) =>
          supabaseService.updateTablePlayerStack(this.tableId, player.playerId, player.stack)
        )
      )
      await supabaseService.incrementGamesPlayed(playedPlayerIds)
      await supabaseService.incrementGamesWon(winnerIds)

      for (const player of this.state.players.values()) {
        if (player.stack <= 0) {
          await supabaseService.markPlayerBroke(player.playerId).catch(console.error)
          this.io.to(player.socketId).emit('blackjack_busted', {
            message: 'You ran out of table chips.',
            minBuyin: this.state.minBuyin,
            maxBuyin: this.state.maxBuyin,
            tableId: this.tableId,
          })
        }
      }
    } catch (error) {
      console.error('Failed to persist blackjack round:', error)
    }
  }

  private hasAnyBetOnTable() {
    return Array.from(this.state.players.values()).some((player) => player.bet > 0)
  }

  private movePlayerToObserver(player: BlackjackServerPlayer) {
    const observer: BlackjackServerObserver = {
      socketId: player.socketId,
      playerId: player.playerId,
      username: player.username,
      avatar: player.avatar,
      stack: player.stack + player.bet,
      hasTableEntry: true,
    }

    this.state.players.delete(player.seat)
    this.state.socketToSeat.delete(player.socketId)
    player.bet = 0
    this.state.observers.set(observer.playerId, observer)
    return observer
  }

  private applyMissedBetStandUps(activePlayerIds: string[]) {
    const active = new Set(activePlayerIds)
    const forcedNames: string[] = []

    for (const player of Array.from(this.state.players.values())) {
      if (active.has(player.playerId)) {
        player.missedBetRounds = 0
        continue
      }

      if (player.bet <= 0) {
        player.missedBetRounds += 1
      }

      if (player.missedBetRounds >= MAX_MISSED_BET_ROUNDS) {
        forcedNames.push(player.username)
        this.movePlayerToObserver(player)
      }
    }

    if (forcedNames.length > 0) {
      this.log(`${forcedNames.join(', ')} moved to waiting after 3 missed betting rounds`)
    }
  }

  private beginBettingCountdown() {
    if (this.state.phase !== 'betting' || this.bettingTimer) return

    this.clearNextRoundCountdown()
    this.state.bettingEndsAt = Date.now() + BETTING_WINDOW_MS
    this.setDealerMessage('Betting is now open.')
    this.bettingTimer = setTimeout(() => {
      this.bettingTimer = null
      void this.resolveBettingCountdown()
    }, BETTING_WINDOW_MS)
  }

  private async resolveBettingCountdown() {
    this.state.bettingEndsAt = null

    if (this.state.phase !== 'betting') {
      this.broadcastState()
      return
    }

    if (!this.hasAnyBetOnTable()) {
      this.setDealerMessage('Place your bets, please.')
      this.broadcastState()
      return
    }

    const result = await this.startRound()
    if (result.error) {
      this.broadcastState()
    }
  }

  private clearBettingCountdown() {
    if (this.bettingTimer) {
      clearTimeout(this.bettingTimer)
      this.bettingTimer = null
    }
    this.state.bettingEndsAt = null
  }

  private beginInsuranceCountdown(dealerNatural: boolean) {
    this.clearTurnCountdown()
    this.state.phase = 'insurance'
    this.state.status = 'playing'
    this.state.currentSeat = -1
    this.state.insuranceEndsAt = Date.now() + INSURANCE_WINDOW_MS
    this.setDealerMessage('Dealer shows an Ace. Would you like to buy insurance?')
    this.syncTableStatus()
    this.broadcastState()
    this.emitTableUpdated()

    this.insuranceTimer = setTimeout(() => {
      this.insuranceTimer = null
      void this.resolveInsuranceCountdown(dealerNatural)
    }, INSURANCE_WINDOW_MS)
  }

  private async resolveInsuranceCountdown(dealerNatural: boolean) {
    this.state.insuranceEndsAt = null

    if (this.state.phase !== 'insurance') {
      this.broadcastState()
      return
    }

    if (dealerNatural) {
      await this.settleRound()
      return
    }

    this.state.phase = 'playing'
    await this.continueInitialDeal()
  }

  private clearInsuranceCountdown() {
    if (this.insuranceTimer) {
      clearTimeout(this.insuranceTimer)
      this.insuranceTimer = null
    }
    this.state.insuranceEndsAt = null
  }

  private beginTurnCountdown() {
    this.clearTurnCountdown()
    const player = this.state.players.get(this.state.currentSeat)
    if (this.state.phase !== 'playing' || !player) return

    const seat = player.seat
    const handIndex = player.activeHandIndex
    this.state.turnEndsAt = Date.now() + TURN_WINDOW_MS
    this.turnTimer = setTimeout(() => {
      this.turnTimer = null
      void this.resolveTurnCountdown(seat, handIndex)
    }, TURN_WINDOW_MS)
  }

  private async resolveTurnCountdown(seat: number, handIndex: number) {
    if (this.state.phase !== 'playing' || this.state.currentSeat !== seat) return

    const player = this.state.players.get(seat)
    if (!player || player.activeHandIndex !== handIndex) return

    const hand = player.hands[handIndex]
    if (!hand || hand.status !== 'playing') return

    hand.status = 'stood'
    await this.advanceTurn()
  }

  private clearTurnCountdown() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer)
      this.turnTimer = null
    }
    this.state.turnEndsAt = null
  }

  private beginNextRoundCountdown() {
    this.clearNextRoundCountdown()
    this.state.nextRoundStartsAt = Date.now() + NEXT_ROUND_DELAY_MS
    this.nextRoundTimer = setTimeout(() => {
      this.nextRoundTimer = null
      this.openBettingRound()
    }, NEXT_ROUND_DELAY_MS)
  }

  private clearNextRoundCountdown() {
    if (this.nextRoundTimer) {
      clearTimeout(this.nextRoundTimer)
      this.nextRoundTimer = null
    }
    this.state.nextRoundStartsAt = null
  }

  private openBettingRound() {
    if (this.isRoundLocked()) return

    this.clearBettingCountdown()
    this.clearInsuranceCountdown()
    this.clearTurnCountdown()
    this.clearNextRoundCountdown()
    for (const seated of this.state.players.values()) {
      seated.bet = 0
      seated.insuranceBet = 0
      seated.hands = []
      seated.activeHandIndex = 0
    }

    this.state.phase = 'betting'
    this.state.status = 'waiting'
    this.state.dealerCards = []
    this.state.hideHoleCard = true
    this.state.currentSeat = -1
    this.setDealerMessage('Place your bets, please.')
    this.syncTableStatus()
    this.broadcastState()
    this.emitTableUpdated()
  }

  private getValidActionsForPlayer(player: BlackjackServerPlayer): BlackjackAction[] {
    if (this.state.phase !== 'playing' || player.seat !== this.state.currentSeat) return []

    const hand = player.hands[player.activeHandIndex]
    if (!hand || hand.status !== 'playing') return []

    const actions: BlackjackAction[] = ['hit', 'stand']

    if (hand.cards.length === 2 && player.stack >= hand.bet) {
      actions.push('double')
    }

    if (
      hand.cards.length === 2 &&
      player.hands.length < MAX_SPLIT_HANDS &&
      player.stack >= hand.bet &&
      isSameRankPair(hand)
    ) {
      actions.push('split')
    }

    if (hand.cards.length === 2 && player.hands.length === 1 && !hand.fromSplit) {
      actions.push('surrender')
    }

    return actions
  }

  private welcomeLine(username: string) {
    return randomChoice([`Welcome, ${username}.`, `Glad you can join us, ${username}.`])
  }

  private isRoundLocked() {
    return this.state.phase === 'playing' || this.state.phase === 'insurance'
  }

  private setDealerMessage(message: string) {
    this.personalDealerMessages.clear()
    this.state.message = message
    this.state.messageUpdatedAt = Date.now()
  }

  private setPersonalDealerMessages(messages: Map<string, string>) {
    const updatedAt = Date.now()
    this.personalDealerMessages.clear()
    for (const [playerId, message] of messages) {
      this.personalDealerMessages.set(playerId, { message, updatedAt })
    }
  }

  private clientStateFor(playerId: string): ClientBlackjackState {
    const player = this.getPlayerByPlayerId(playerId)
    const personalDealerMessage = this.personalDealerMessages.get(playerId)

    return {
      tableId: this.tableId,
      tableName: this.state.tableName,
      phase: this.state.phase,
      status: this.state.status,
      minBet: this.state.minBet,
      maxBet: this.state.maxBet,
      minBuyin: this.state.minBuyin,
      maxBuyin: this.state.maxBuyin,
      maxPlayers: this.state.maxPlayers,
      roundNumber: this.state.roundNumber,
      dealerCards: this.state.dealerCards.map((card, index) => (this.state.hideHoleCard && index === 1 ? null : card)),
      dealerScore: this.state.dealerCards.length === 0
        ? null
        : scoreHand(this.state.hideHoleCard ? this.state.dealerCards.slice(0, 1) : this.state.dealerCards),
      players: Array.from(this.state.players.values())
        .sort((a, b) => a.seat - b.seat)
        .map((seated) => {
          const isViewer = seated.playerId === playerId

          return {
            playerId: seated.playerId,
            username: seated.username,
            avatar: seated.avatar,
            seat: seated.seat,
            stack: seated.stack,
            bet: seated.bet,
            insuranceBet: seated.insuranceBet,
            hands: seated.hands.map((hand) => ({
              cards: isViewer ? hand.cards : [],
              cardCount: hand.cards.length,
              score: scoreHand(hand.cards),
              bet: hand.bet,
              status: hand.status,
              doubled: hand.doubled,
              result: hand.result,
              net: hand.net,
            })),
            activeHandIndex: seated.activeHandIndex,
            isConnected: seated.isConnected,
            isCurrentTurn: seated.seat === this.state.currentSeat,
            lastNet: seated.lastNet,
            lastResult: seated.lastResult,
          }
        }),
      observers: Array.from(this.state.observers.values()).map((observer) => ({
        playerId: observer.playerId,
        username: observer.username,
        avatar: observer.avatar,
        stack: observer.stack,
      })),
      currentSeat: this.state.currentSeat,
      myPlayerId: playerId,
      validActions: player ? this.getValidActionsForPlayer(player) : [],
      message: personalDealerMessage?.message ?? this.state.message,
      messageUpdatedAt: personalDealerMessage?.updatedAt ?? this.state.messageUpdatedAt,
      dealerTips: { ...this.state.dealerTips },
      shoeCardsLeft: this.state.deck.length,
      bettingEndsAt: this.state.bettingEndsAt,
      insuranceEndsAt: this.state.insuranceEndsAt,
      turnEndsAt: this.state.turnEndsAt,
      nextRoundStartsAt: this.state.nextRoundStartsAt,
    }
  }

  private log(message: string) {
    this.io.to(this.tableId).emit('blackjack_action_log', { message })
  }

  private syncTableStatus() {
    const status = this.isRoundLocked() ? 'playing' : 'waiting'
    this.state.status = status
    if (isLocalOnlyTable(this.tableId)) return
    supabaseService.updateTableStatus(this.tableId, status, this.getPlayerCount()).catch(console.error)
  }

  private emitTableUpdated() {
    this.io.emit('blackjack_table_updated', this.getSnapshot())
  }
}
