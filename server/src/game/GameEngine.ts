import { Server } from 'socket.io'
import { ServerGameState, ServerObserver, ServerPlayer, PlayerAction, SidePot, HandResult } from '../types/game'
import { createShuffledDeck, dealCards } from './Deck'
import { evaluateHands, findWinners } from './HandEvaluator'
import { calculatePots } from './PotCalculator'
import { validateAction, getValidActions, getCallAmount, getMinRaise } from './ActionValidator'
import { supabaseService } from '../services/supabaseService'
import { decideHouseAction, getHouseExitLine, releaseHousePlayer, shouldHousePlayerRest } from '../ai/housePlayers'

const ACTION_TIMEOUT = parseInt(process.env.ACTION_TIMEOUT_SECONDS ?? '30') * 1000
const BETWEEN_HAND_DELAY = Math.max(parseInt(process.env.BETWEEN_HAND_DELAY_SECONDS ?? '5'), 5) * 1000

export class GameEngine {
  private io: Server
  private state: ServerGameState
  private onWaitingForPlayers: (() => void) | null

  constructor(io: Server, state: ServerGameState, onWaitingForPlayers?: () => void) {
    this.io = io
    this.state = state
    this.onWaitingForPlayers = onWaitingForPlayers ?? null
  }

  // ─── Hand Lifecycle ───────────────────────────────────────────────────────

  async startHand() {
    const activePlayers = this.getActivePlayers()
    if (activePlayers.length < 2) {
      this.state.phase = 'waiting'
      this.state.status = 'waiting'
      this.state.currentSeat = -1
      this.broadcastGameState()
      this.onWaitingForPlayers?.()
      return
    }

    this.state.handNumber++
    this.state.handStartedAt = new Date()
    this.state.community = []
    this.state.pot = 0
    this.state.sidePots = []
    this.state.phase = 'preflop'

    // Reset player hand state
    for (const player of this.state.players.values()) {
      player.holeCards = []
      player.currentBet = 0
      player.totalBetThisHand = 0
      player.folded = false
      player.allIn = false
      player.hasActed = false
    }

    // Move dealer button
    this.state.dealerSeat = this.nextActiveSeat(this.state.dealerSeat)

    // Deal hole cards
    let deck = createShuffledDeck()
    for (const player of activePlayers) {
      const { cards, remaining } = dealCards(deck, 2)
      player.holeCards = cards
      deck = remaining
    }
    this.state.deck = deck

    // Post blinds
    const sbSeat = this.nextActiveSeat(this.state.dealerSeat)
    const bbSeat = this.nextActiveSeat(sbSeat)
    const sbPlayer = this.state.players.get(sbSeat)!
    const bbPlayer = this.state.players.get(bbSeat)!

    this.postBlind(sbPlayer, this.state.smallBlind)
    this.postBlind(bbPlayer, this.state.bigBlind)

    this.state.currentBetLevel = this.state.bigBlind
    this.state.lastRaiseAmount = this.state.bigBlind

    // Preflop: UTG acts first (left of BB)
    this.state.currentSeat = this.nextActiveSeat(bbSeat)

    this.broadcastGameState()
    this.startActionTimer()
  }

  async handleAction(socketId: string, action: PlayerAction, amount?: number) {
    const seat = this.state.socketToSeat.get(socketId)
    if (seat === undefined) return
    if (seat !== this.state.currentSeat) return

    const player = this.state.players.get(seat)
    if (!player) return

    const validation = validateAction(player, action, amount, this.state)
    if (!validation.valid) {
      this.io.to(socketId).emit('error', { message: validation.error })
      return
    }

    this.clearActionTimer()

    let actionMsg = ''

    switch (action) {
      case 'fold':
        player.folded = true
        player.hasActed = true
        actionMsg = `${player.username} folds`
        break

      case 'check':
        player.hasActed = true
        actionMsg = `${player.username} checks`
        break

      case 'call': {
        const callAmount = getCallAmount(player, this.state)
        if (callAmount >= player.stack) {
          this.applyBet(player, player.stack)
          player.allIn = true
          actionMsg = `${player.username} calls ${player.stack.toLocaleString()} (all in)`
        } else {
          this.applyBet(player, callAmount)
          actionMsg = `${player.username} calls ${callAmount.toLocaleString()}`
        }
        player.hasActed = true
        break
      }

      case 'raise': {
        const raiseTotal = validation.normalizedAmount!
        const raiseBy = raiseTotal - player.currentBet
        if (raiseBy >= player.stack) {
          this.applyBet(player, player.stack)
          player.allIn = true
          actionMsg = `${player.username} raises all in (${(player.currentBet).toLocaleString()})`
        } else {
          this.state.lastRaiseAmount = raiseTotal - this.state.currentBetLevel
          this.state.currentBetLevel = raiseTotal
          this.applyBet(player, raiseBy)
          this.reopenBetting(seat)
          actionMsg = `${player.username} raises to ${raiseTotal.toLocaleString()}`
        }
        player.hasActed = true
        break
      }

      case 'allin': {
        const allInAmount = player.stack
        const newTotal = player.currentBet + allInAmount
        if (newTotal > this.state.currentBetLevel) {
          this.state.lastRaiseAmount = Math.max(newTotal - this.state.currentBetLevel, this.state.lastRaiseAmount)
          this.state.currentBetLevel = newTotal
          this.reopenBetting(seat)
        }
        this.applyBet(player, allInAmount)
        player.allIn = true
        player.hasActed = true
        actionMsg = `${player.username} goes ALL IN — ${newTotal.toLocaleString()}`
        break
      }
    }

    if (actionMsg) {
      this.io.to(this.state.tableId).emit('action_log', { message: actionMsg })
    }

    this.broadcastGameState()
    await this.advanceRound()
  }

  // ─── Round Advancement ────────────────────────────────────────────────────

  private async advanceRound() {
    // Check if only one player remains
    const nonFolded = this.getActivePlayers().filter((p) => !p.folded)
    if (nonFolded.length === 1) {
      await this.awardPotToLastPlayer(nonFolded[0])
      return
    }

    // Check if betting round is complete
    if (this.isBettingRoundComplete()) {
      await this.moveToNextStreet()
    } else {
      // Advance to next player who can act
      this.state.currentSeat = this.nextActingSeat(this.state.currentSeat)
      this.broadcastGameState()
      this.startActionTimer()
    }
  }

  private isBettingRoundComplete(): boolean {
    const activePlayers = this.getActivePlayers().filter((p) => !p.folded && !p.allIn)
    if (activePlayers.length === 0) return true
    return activePlayers.every(
      (p) => p.hasActed && p.currentBet === this.state.currentBetLevel
    )
  }

  private async moveToNextStreet() {
    // Collect bets into pot
    this.collectBets()

    switch (this.state.phase) {
      case 'preflop':
        this.state.phase = 'flop'
        this.dealCommunity(3)
        break
      case 'flop':
        this.state.phase = 'turn'
        this.dealCommunity(1)
        break
      case 'turn':
        this.state.phase = 'river'
        this.dealCommunity(1)
        break
      case 'river':
        await this.showdown()
        return
    }

    // Reset betting round
    this.resetBettingRound()

    // If all remaining non-folded players are all-in, no one can act —
    // broadcast the new community cards then auto-advance to the next street.
    const canAct = this.getActivePlayers().filter((p) => !p.folded && !p.allIn)
    if (canAct.length === 0) {
      this.broadcastGameState()
      await new Promise((r) => setTimeout(r, 1500)) // brief pause so players see the cards
      await this.moveToNextStreet()
      return
    }

    // Post-flop: first player (left of dealer) who can still act (not folded, not all-in)
    const firstSeat = this.nextActingSeat(this.state.dealerSeat)
    this.state.currentSeat = firstSeat

    this.broadcastGameState()
    this.startActionTimer()
  }

  private dealCommunity(count: number) {
    // Burn one card
    this.state.deck = this.state.deck.slice(1)
    const { cards, remaining } = dealCards(this.state.deck, count)
    this.state.community.push(...cards)
    this.state.deck = remaining
  }

  // ─── Showdown ─────────────────────────────────────────────────────────────

  private async showdown() {
    this.state.phase = 'showdown'
    this.state.currentSeat = -1
    this.collectBets()

    const pots = calculatePots(
      Array.from(this.state.players.values()).map((p) => ({
        playerId: p.playerId,
        totalBet: p.totalBetThisHand,
        allIn: p.allIn,
        folded: p.folded,
      }))
    )

    const totalDistributed = { amount: 0 }
    const winnerSummary: HandResult['winners'] = []

    for (const pot of pots) {
      const eligible = Array.from(this.state.players.values()).filter(
        (p) => !p.folded && pot.eligiblePlayerIds.includes(p.playerId)
      )
      if (eligible.length === 0) continue

      const evaluated = evaluateHands(
        eligible.map((p) => ({
          playerId: p.playerId,
          username: p.username,
          holeCards: p.holeCards,
        })),
        this.state.community
      )

      const winners = findWinners(evaluated)
      const share = Math.floor(pot.amount / winners.length)
      const remainder = pot.amount - share * winners.length

      winners.forEach((w, idx) => {
        const player = Array.from(this.state.players.values()).find(
          (p) => p.playerId === w.playerId
        )!
        player.stack += share + (idx === 0 ? remainder : 0)
        totalDistributed.amount += share + (idx === 0 ? remainder : 0)
        winnerSummary.push({
          playerId: w.playerId,
          username: w.username,
          amount: share + (idx === 0 ? remainder : 0),
          handRank: w.rank,
          holeCards: w.holeCards,
        })
      })
    }

    const allHoleCards = Array.from(this.state.players.values())
      .filter((p) => !p.folded)
      .map((p) => ({ playerId: p.playerId, username: p.username, holeCards: p.holeCards }))

    const result: HandResult = {
      winners: winnerSummary,
      allHoleCards,
      pot: this.state.pot,
      community: this.state.community,
      sidePots: pots,
    }

    this.io.to(this.state.tableId).emit('hand_result', result)
    this.broadcastGameState()

    // Persist to Supabase
    try {
      await supabaseService.recordHand(this.state, winnerSummary, allHoleCards)
      await supabaseService.updateChipBalances(
        Array.from(this.state.players.values()),
        this.state.tableId
      )
    } catch (err) {
      console.error('Failed to persist hand result:', err)
    }

    let removedBustedPlayers = false

    // Remove busted players (stack = 0)
    for (const [seat, player] of this.state.players.entries()) {
      if (player.stack <= 0 && !player.isBot) {
        this.state.players.delete(seat)
        this.state.socketToSeat.delete(player.socketId)
        removedBustedPlayers = true
        await supabaseService.removeTablePlayer(this.state.tableId, player.playerId)
        this.io.to(player.socketId).emit('busted', {
          message: 'You ran out of chips!',
          minBuyin: this.state.minBuyin,
          maxBuyin: this.state.maxBuyin,
          tableId: this.state.tableId,
        })
        // Mark as broke so they receive 2,000 free chips after 24 hours
        await supabaseService.markPlayerBroke(player.playerId).catch(console.error)
      }
    }

    if (removedBustedPlayers) {
      this.broadcastGameState()
    }

    const seatsChangedAfterHand = await this.processPostHandSeatTransitions()
    const seatedQueuedObservers = await this.seatQueuedObservers()
    if (seatsChangedAfterHand && !seatedQueuedObservers) {
      this.broadcastGameState()
    }

    // If no real players remain after busts, delete the table — no next hand needed
    const realPlayersLeft = Array.from(this.state.players.values()).filter(p => !p.isBot)
    if (realPlayersLeft.length === 0) {
      await supabaseService.deleteTable(this.state.tableId).catch(console.error)
      return
    }

    // Schedule next hand
    setTimeout(() => {
      this.startHand().catch(console.error)
    }, BETWEEN_HAND_DELAY)
  }

  private async awardPotToLastPlayer(winner: ServerPlayer) {
    this.collectBets()
    winner.stack += this.state.pot

    const result: HandResult = {
      winners: [{ playerId: winner.playerId, username: winner.username, amount: this.state.pot, handRank: 'Last player standing', holeCards: [] }],
      allHoleCards: [],
      pot: this.state.pot,
      community: this.state.community,
      sidePots: [],
    }

    this.io.to(this.state.tableId).emit('hand_result', result)
    this.state.phase = 'showdown'
    this.state.currentSeat = -1
    this.broadcastGameState()

    try {
      await supabaseService.updateChipBalances(Array.from(this.state.players.values()), this.state.tableId)
    } catch (err) {
      console.error('Failed to update chip balances:', err)
    }

    const seatsChangedAfterHand = await this.processPostHandSeatTransitions()
    const seatedQueuedObservers = await this.seatQueuedObservers()
    if (seatsChangedAfterHand && !seatedQueuedObservers) {
      this.broadcastGameState()
    }

    setTimeout(() => {
      this.startHand().catch(console.error)
    }, BETWEEN_HAND_DELAY)
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private postBlind(player: ServerPlayer, amount: number) {
    const actual = Math.min(amount, player.stack)
    player.stack -= actual
    player.currentBet += actual
    player.totalBetThisHand += actual
    if (player.stack === 0) player.allIn = true
  }

  private applyBet(player: ServerPlayer, amount: number) {
    const actual = Math.min(amount, player.stack)
    player.stack -= actual
    player.currentBet += actual
    player.totalBetThisHand += actual
    const newTotal = player.currentBet
    if (newTotal > this.state.currentBetLevel) {
      this.state.currentBetLevel = newTotal
    }
  }

  private collectBets() {
    for (const player of this.state.players.values()) {
      this.state.pot += player.currentBet
      player.currentBet = 0
    }
  }

  private resetBettingRound() {
    this.state.currentBetLevel = 0
    this.state.lastRaiseAmount = this.state.bigBlind
    for (const player of this.state.players.values()) {
      player.currentBet = 0
      player.hasActed = false
    }
  }

  private reopenBetting(raiserSeat: number) {
    for (const [seat, player] of this.state.players.entries()) {
      if (seat !== raiserSeat && !player.folded && !player.allIn) {
        player.hasActed = false
      }
    }
  }

  getActivePlayers(): ServerPlayer[] {
    return Array.from(this.state.players.values()).filter(
      (p) => !p.sittingOut && p.isConnected
    )
  }

  private nextActiveSeat(fromSeat: number): number {
    const seats = Array.from(this.state.players.keys()).sort((a, b) => a - b)
    if (seats.length === 0) return fromSeat
    // Linear scan — visits each seat at most once, no risk of infinite recursion
    let current = fromSeat
    for (let i = 0; i < seats.length; i++) {
      const idx = seats.findIndex((s) => s > current)
      const next = idx === -1 ? seats[0] : seats[idx]
      const player = this.state.players.get(next)!
      if (!player.sittingOut && player.isConnected) return next
      current = next
    }
    // Fallback: no active player found — return first seat to avoid crash
    return seats[0]
  }

  private nextActingSeat(fromSeat: number): number {
    const seats = Array.from(this.state.players.keys()).sort((a, b) => a - b)
    let searchFrom = fromSeat
    for (let i = 0; i < seats.length; i++) {
      const idx = seats.findIndex((s) => s > searchFrom)
      const next = idx === -1 ? seats[0] : seats[idx]
      const player = this.state.players.get(next)!
      if (!player.folded && !player.allIn && !player.sittingOut && player.isConnected) {
        return next
      }
      searchFrom = next
    }
    return fromSeat
  }

  private startActionTimer() {
    const seat = this.state.currentSeat
    const player = this.state.players.get(seat)
    if (!player) return

    this.clearActionTimer()

    // Bot: always call if there's a bet, otherwise check
    if (player.isBot) {
      this.state.actionTimer = setTimeout(() => {
        if (this.state.currentSeat !== seat) return
        const { action, amount } = decideHouseAction(player, this.state)
        this.handleAction(player.socketId, action, amount).catch(console.error)
      }, 1500)
      return
    }

    this.state.actionTimer = setTimeout(() => {
      // Auto-fold on timeout
      this.handleAction(player.socketId, 'fold').catch(console.error)
    }, ACTION_TIMEOUT)

    this.io.to(player.socketId).emit('action_required', {
      validActions: getValidActions(player, this.state),
      callAmount: getCallAmount(player, this.state),
      minRaise: getMinRaise(this.state),
      timeLimit: ACTION_TIMEOUT / 1000,
    })
  }

  clearActionTimer() {
    if (this.state.actionTimer) {
      clearTimeout(this.state.actionTimer)
      this.state.actionTimer = null
    }
  }

  // ─── State Broadcasting ───────────────────────────────────────────────────

  broadcastGameState() {
    const clientObservers = Array.from(this.state.observers.values()).map(obs => ({
      playerId: obs.playerId,
      username: obs.username,
      avatar: obs.avatar,
      stack: obs.stack,
    }))

    for (const [seat, player] of this.state.players.entries()) {
      const sbSeat = this.getSBSeat()
      const bbSeat = this.getBBSeat()

      // Evaluate current hand strength for this player
      let myHandRank = ''
      if (player.holeCards.length === 2 && this.state.community.length >= 3) {
        try {
          const evaluated = evaluateHands(
            [{ playerId: player.playerId, username: player.username, holeCards: player.holeCards }],
            this.state.community
          )
          if (evaluated.length > 0) myHandRank = evaluated[0].rank
        } catch {
          // pokersolver can throw on incomplete hands
        }
      }

      const clientPlayers = Array.from(this.state.players.entries()).map(([s, p]) => ({
        playerId: p.playerId,
        username: p.username,
        avatar: p.avatar,
        seat: s,
        stack: p.stack,
        currentBet: p.currentBet,
        totalBetThisHand: p.totalBetThisHand,
        folded: p.folded,
        allIn: p.allIn,
        sittingOut: p.sittingOut,
        isConnected: p.isConnected,
        isBot: p.isBot,
        botTitle: p.botTitle,
        standUpAfterHand: p.standUpAfterHand,
        holeCards: p.playerId === player.playerId ? p.holeCards : p.holeCards.map(() => '??'),
        isDealer: s === this.state.dealerSeat,
        isSB: s === sbSeat,
        isBB: s === bbSeat,
        isCurrentTurn: this.state.phase !== 'waiting' && this.state.phase !== 'showdown' && s === this.state.currentSeat,
      }))

      const validActions = this.state.phase !== 'waiting' && this.state.phase !== 'showdown' && seat === this.state.currentSeat
        ? getValidActions(player, this.state)
        : []

      const gameState = {
        tableId: this.state.tableId,
        tableName: this.state.tableName,
        phase: this.state.phase,
        pot: this.state.pot + Array.from(this.state.players.values()).reduce((s, p) => s + p.currentBet, 0),
        sidePots: this.state.sidePots,
        community: this.state.community,
        players: clientPlayers,
        dealerSeat: this.state.dealerSeat,
        currentSeat: this.state.currentSeat,
        smallBlind: this.state.smallBlind,
        bigBlind: this.state.bigBlind,
        minRaise: this.state.phase !== 'waiting' && this.state.phase !== 'showdown' ? getMinRaise(this.state) : 0,
        callAmount: this.state.phase !== 'waiting' && this.state.phase !== 'showdown' ? getCallAmount(player, this.state) : 0,
        handNumber: this.state.handNumber,
        myPlayerId: player.playerId,
        validActions,
        myHandRank,
        observers: clientObservers,
      }

      this.io.to(player.socketId).emit('game_state', gameState)
    }

    // Broadcast to observers (same state but no valid actions, no hole cards revealed)
    for (const obs of this.state.observers.values()) {
      const observerState = {
        tableId: this.state.tableId,
        tableName: this.state.tableName,
        phase: this.state.phase,
        pot: this.state.pot + Array.from(this.state.players.values()).reduce((s, p) => s + p.currentBet, 0),
        sidePots: this.state.sidePots,
        community: this.state.community,
        players: Array.from(this.state.players.entries()).map(([s, p]) => ({
          playerId: p.playerId,
          username: p.username,
          avatar: p.avatar,
          seat: s,
          stack: p.stack,
          currentBet: p.currentBet,
          totalBetThisHand: p.totalBetThisHand,
          folded: p.folded,
          allIn: p.allIn,
          sittingOut: p.sittingOut,
          isConnected: p.isConnected,
          isBot: p.isBot,
          botTitle: p.botTitle,
          standUpAfterHand: p.standUpAfterHand,
          holeCards: p.holeCards.map(() => '??'),
          isDealer: s === this.state.dealerSeat,
          isSB: s === this.getSBSeat(),
          isBB: s === this.getBBSeat(),
          isCurrentTurn: this.state.phase !== 'waiting' && this.state.phase !== 'showdown' && s === this.state.currentSeat,
        })),
        dealerSeat: this.state.dealerSeat,
        currentSeat: this.state.currentSeat,
        smallBlind: this.state.smallBlind,
        bigBlind: this.state.bigBlind,
        minRaise: 0,
        callAmount: 0,
        handNumber: this.state.handNumber,
        myPlayerId: obs.playerId,
        validActions: [],
        myHandRank: '',
        observers: clientObservers,
      }
      this.io.to(obs.socketId).emit('game_state', observerState)
    }

    // Also emit to spectators (no player state) — lobby observers
    this.io.to(`lobby:${this.state.tableId}`).emit('table_update', {
      tableId: this.state.tableId,
      phase: this.state.phase,
      playerCount: this.state.players.size,
    })
  }

  private getSBSeat(): number {
    return this.nextActiveSeat(this.state.dealerSeat)
  }

  private getBBSeat(): number {
    return this.nextActiveSeat(this.getSBSeat())
  }

  private async seatQueuedObservers() {
    const queuedObservers = Array.from(this.state.observers.values()).filter((observer) => !observer.hasTableEntry)
    if (queuedObservers.length === 0) return false

    for (const observer of queuedObservers) {
      const seat = this.findEmptySeat()
      if (seat === null) break

      this.state.observers.delete(observer.playerId)

      const player: ServerPlayer = {
        socketId: observer.socketId,
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

      this.state.players.set(seat, player)
      this.state.socketToSeat.set(player.socketId, seat)
      this.io.to(this.state.tableId).emit('action_log', { message: `${observer.username} takes a seat` })
      this.io.to(this.state.tableId).emit('player_joined', {
        playerId: observer.playerId,
        username: observer.username,
        seat,
        stack: observer.stack,
      })

      await supabaseService.addTablePlayer(this.state.tableId, observer.playerId, seat, observer.stack).catch(console.error)
    }

    this.state.status = 'waiting'
    this.broadcastGameState()
    return true
  }

  private findEmptySeat(): number | null {
    for (let seat = 0; seat < this.state.maxPlayers; seat++) {
      if (!this.state.players.has(seat)) return seat
    }
    return null
  }

  private async processPostHandSeatTransitions() {
    let seatsChanged = false
    const moreThanOneRealPlayer = Array.from(this.state.players.values()).filter((player) => !player.isBot).length > 1
    const queuedHumanObservers = Array.from(this.state.observers.values()).filter(
      (observer) => !observer.hasTableEntry && !observer.playerId.startsWith('ai_')
    ).length

    for (const [seat, player] of this.state.players.entries()) {
      if (player.stack <= 0 && !player.isBot) {
        continue
      }

      if (player.isBot) {
        const shouldExitForGuests =
          Boolean(player.botLeaveAfterHand)
          || (
            player.botMode !== 'manual'
            && (moreThanOneRealPlayer || queuedHumanObservers > 0)
          )
        if (player.stack <= 0) {
          releaseHousePlayer(player, 'rest')
          this.state.players.delete(seat)
          this.state.socketToSeat.delete(player.socketId)
          seatsChanged = true
          continue
        }
        if (shouldHousePlayerRest(player)) {
          releaseHousePlayer(player, 'rest')
          this.state.players.delete(seat)
          this.state.socketToSeat.delete(player.socketId)
          seatsChanged = true
          this.io.to(this.state.tableId).emit('action_log', { message: getHouseExitLine(player.playerId, 'rest') ?? `${player.username} leaves to rest for a while` })
          continue
        }
        if (shouldExitForGuests) {
          releaseHousePlayer(player, 'normal')
          this.state.players.delete(seat)
          this.state.socketToSeat.delete(player.socketId)
          seatsChanged = true
          this.io.to(this.state.tableId).emit('action_log', { message: getHouseExitLine(player.playerId, 'guest') ?? `${player.username} leaves the table` })
        }
        continue
      }

      if (!player.standUpAfterHand) continue

      player.standUpAfterHand = false
      this.state.players.delete(seat)
      this.state.socketToSeat.delete(player.socketId)
      seatsChanged = true
      const observer: ServerObserver = {
        socketId: player.socketId,
        playerId: player.playerId,
        username: player.username,
        avatar: player.avatar,
        stack: player.stack,
        hasTableEntry: true,
      }
      this.state.observers.set(player.playerId, observer)
      this.io.to(this.state.tableId).emit('action_log', { message: `${player.username} stands up` })
    }

    return seatsChanged
  }
}
