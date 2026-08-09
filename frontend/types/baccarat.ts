import type { TableStatus } from './poker'

export type BaccaratSuit = 'S' | 'H' | 'D' | 'C'
export type BaccaratRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
export type BaccaratBetKey = 'player' | 'tie' | 'banker'
export type BaccaratWinner = BaccaratBetKey
export type BaccaratPhase = 'betting' | 'dealing' | 'settled'
export type BaccaratBets = Record<BaccaratBetKey, number>

export interface BaccaratCard {
  rank: BaccaratRank
  suit: BaccaratSuit
}

export interface BaccaratRoadItem {
  id: number
  winner: BaccaratWinner
  playerTotal: number
  bankerTotal: number
  natural: boolean
}

export interface ClientBaccaratRoundResult extends BaccaratRoadItem {
  playerCards: BaccaratCard[]
  bankerCards: BaccaratCard[]
  net: number
  label: string
}

export interface ClientBaccaratPlayer {
  playerId: string
  username: string
  avatar: string
  seat: number
  stack: number
  betTotal: number
  isConnected: boolean
}

export interface ClientBaccaratObserver {
  playerId: string
  username: string
  avatar: string
  stack: number
}

export interface BaccaratState {
  tableId: string
  tableName: string
  tableKind: 'house' | 'custom'
  houseSeat?: number
  phase: BaccaratPhase
  status: TableStatus
  minBet: number
  maxBet: number
  minBuyin: number
  maxBuyin: number
  maxPlayers: number
  roundNumber: number
  players: ClientBaccaratPlayer[]
  observers: ClientBaccaratObserver[]
  bets: BaccaratBets
  lastBets: BaccaratBets
  tableBets: BaccaratBets
  road: BaccaratRoadItem[]
  result: ClientBaccaratRoundResult | null
  myPlayerId: string
  message: string
  messageUpdatedAt: number
  dealerTips: Record<string, number>
  shoeCardsLeft: number
  bettingEndsAt: number | null
  nextRoundStartsAt: number | null
}

export interface BaccaratTableInfo {
  id: string
  name: string
  host_id: string | null
  game_type?: 'baccarat'
  table_kind?: 'house' | 'custom'
  house_seat?: number
  max_players: number
  small_blind: number
  big_blind: number
  min_buyin: number
  max_buyin: number
  status: TableStatus
  player_count: number
  created_at?: string
}

export interface BaccaratChatMessage {
  playerId: string
  username: string
  avatar?: string
  text: string
  timestamp: string
}
