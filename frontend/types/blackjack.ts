import type { TableStatus } from './poker'

export type BlackjackSuit = 'S' | 'H' | 'D' | 'C'
export type BlackjackRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
export type BlackjackPhase = 'betting' | 'playing' | 'settled'
export type BlackjackAction = 'hit' | 'stand' | 'double' | 'split' | 'surrender'
export type BlackjackHandStatus = 'playing' | 'stood' | 'busted' | 'blackjack' | 'surrendered' | 'settled'

export interface BlackjackCard {
  rank: BlackjackRank
  suit: BlackjackSuit
  value: number
}

export interface ClientBlackjackHand {
  cards: BlackjackCard[]
  cardCount: number
  score: number
  bet: number
  status: BlackjackHandStatus
  doubled: boolean
  result?: string
  net?: number
}

export interface ClientBlackjackPlayer {
  playerId: string
  username: string
  avatar: string
  seat: number
  stack: number
  bet: number
  hands: ClientBlackjackHand[]
  activeHandIndex: number
  isConnected: boolean
  isCurrentTurn: boolean
  lastNet: number
  lastResult: string
}

export interface ClientBlackjackObserver {
  playerId: string
  username: string
  avatar: string
  stack: number
}

export interface BlackjackState {
  tableId: string
  tableName: string
  phase: BlackjackPhase
  status: TableStatus
  minBet: number
  maxBet: number
  minBuyin: number
  maxBuyin: number
  maxPlayers: number
  roundNumber: number
  dealerCards: (BlackjackCard | null)[]
  dealerScore: number | null
  players: ClientBlackjackPlayer[]
  observers: ClientBlackjackObserver[]
  currentSeat: number
  myPlayerId: string
  validActions: BlackjackAction[]
  message: string
  messageUpdatedAt: number
  shoeCardsLeft: number
  bettingEndsAt: number | null
  turnEndsAt: number | null
  nextRoundStartsAt: number | null
}

export interface BlackjackTableInfo {
  id: string
  name: string
  host_id: string | null
  game_type?: 'blackjack'
  max_players: number
  small_blind: number
  big_blind: number
  min_buyin: number
  max_buyin: number
  status: TableStatus
  player_count: number
  created_at?: string
}

export interface BlackjackChatMessage {
  playerId: string
  username: string
  avatar?: string
  text: string
  timestamp: string
}
