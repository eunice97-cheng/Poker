import { Server } from 'socket.io'
import { ServerGameState, ServerPlayer, PlayerAction, SidePot, HandResult } from '../types/game'
import { createShuffledDeck, dealCards } from './Deck'
import { evaluateHands, findWinners } from './HandEvaluator'
import { calculatePots } from './PotCalculator'
import { validateAction, getValidActions, getCallAmount, getMinRaise } from './ActionValidator'
import { supabaseService } from '../services/supabaseService'

const ACTION_TIMEOUT = parseInt(process.env.ACTION_TIMEOUT_SECONDS ?? '30') * 1000
const BETWEEN_HAND_DELAY = parseInt(process.env.BETWEEN_HAND_DELAY_SECONDS ?? '5') * 1000

export class GameEngine {
  private io: Server
  private state: ServerGameState

  constructor(io: Server, state: ServerGameState) {
    this.io = io
    this.state = state
  }

  // ─── Hand Lifecycle ───────────────────────────────────────────────────────

  async startHand() {
    const activePlayers = this.getActivePlayers()
    if (activePlayers.length < 2) {
      this.state.phase = 'waiting'
      this.broadcastGameState()
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

    switch (action) {
      case 'fold':
        player.folded = true
        player.hasActed = true
        break

      case 'check':
        player.hasActed = true
        break

      case 'call': {
        const callAmount = getCallAmount(player, this.state)
        if (callAmount >= player.stack) {
          // calling puts them all in
          this.applyBet(player, player.stack)
          player.allIn = true
        } else {
          this.applyBet(player, callAmount)
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
        } else {
          this.state.lastRaiseAmount = raiseTotal - this.state.currentBetLevel
          this.state.currentBetLevel = raiseTotal
          this.applyBet(player, raiseBy)
          // Re-open action: other players who already acted can re-raise
          this.reopenBetting(seat)
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
        break
      }
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

    // Post-flop: first active player left of dealer
    const firstSeat = this.nextActiveSeat(this.state.dealerSeat)
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

    // Remove busted players (stack = 0)
    for (const [seat, player] of this.state.players.entries()) {
      if (player.stack <= 0) {
        this.io.to(player.socketId).emit('busted', { message: 'You ran out of chips and have been removed from the table.' })
        this.state.players.delete(seat)
        this.state.socketToSeat.delete(player.socketId)
        await supabaseService.removeTablePlayer(this.state.tableId, player.playerId)
      }
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
      winners: [{ playerId: winner.playerId, username: winner.username, amount: this.state.pot, handRank: 'Last player standing', holeCards: winner.holeCards }],
      allHoleCards: [],
      pot: this.state.pot,
      community: this.state.community,
      sidePots: [],
    }

    this.io.to(this.state.tableId).emit('hand_result', result)
    this.state.phase = 'showdown'
    this.broadcastGameState()

    try {
      await supabaseService.updateChipBalances(Array.from(this.state.players.values()), this.state.tableId)
    } catch (err) {
      console.error('Failed to update chip balances:', err)
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
    const idx = seats.findIndex((s) => s > fromSeat)
    const next = idx === -1 ? seats[0] : seats[idx]
    const player = this.state.players.get(next)!
    if (player.sittingOut || !player.isConnected) {
      return this.nextActiveSeat(next)
    }
    return next
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
    for (const [seat, player] of this.state.players.entries()) {
      const sbSeat = this.getSBSeat()
      const bbSeat = this.getBBSeat()

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
        holeCards: p.playerId === player.playerId ? p.holeCards : p.holeCards.map(() => '??'),
        isDealer: s === this.state.dealerSeat,
        isSB: s === sbSeat,
        isBB: s === bbSeat,
        isCurrentTurn: s === this.state.currentSeat,
      }))

      const validActions = seat === this.state.currentSeat
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
        minRaise: getMinRaise(this.state),
        callAmount: getCallAmount(player, this.state),
        handNumber: this.state.handNumber,
        myPlayerId: player.playerId,
        validActions,
      }

      this.io.to(player.socketId).emit('game_state', gameState)
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
}
