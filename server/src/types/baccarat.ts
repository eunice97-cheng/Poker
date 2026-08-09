export type BaccaratSuit = 'S' | 'H' | 'D' | 'C'
export type BaccaratRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
export type BaccaratBetKey = 'player' | 'tie' | 'banker'
export type BaccaratWinner = BaccaratBetKey
export type BaccaratPhase = 'betting' | 'dealing' | 'settled'
export type BaccaratTableStatus = 'waiting' | 'playing' | 'finished'
export type BaccaratBets = Record<BaccaratBetKey, number>
export type BaccaratDealerTips = Record<string, number>

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

export interface BaccaratRoundResult extends BaccaratRoadItem {
  playerCards: BaccaratCard[]
  bankerCards: BaccaratCard[]
  label: string
  netByPlayerId: Record<string, number>
}

export interface BaccaratServerPlayer {
  socketId: string
  playerId: string
  username: string
  avatar: string
  seat: number
  stack: number
  isConnected: boolean
  hasTableEntry?: boolean
}

export interface BaccaratServerObserver {
  socketId: string
  playerId: string
  username: string
  avatar: string
  stack: number
  hasTableEntry?: boolean
}

export interface BaccaratServerState {
  tableId: string
  tableName: string
  tableKind: 'house' | 'custom'
  houseSeat?: number
  minBet: number
  maxBet: number
  minBuyin: number
  maxBuyin: number
  maxPlayers: number
  status: BaccaratTableStatus
  phase: BaccaratPhase
  deck: BaccaratCard[]
  players: Map<number, BaccaratServerPlayer>
  socketToSeat: Map<string, number>
  observers: Map<string, BaccaratServerObserver>
  bets: Map<string, BaccaratBets>
  lastBets: Map<string, BaccaratBets>
  road: BaccaratRoadItem[]
  roundNumber: number
  result: BaccaratRoundResult | null
  message: string
  messageUpdatedAt: number
  dealerTips: BaccaratDealerTips
  bettingEndsAt: number | null
  nextRoundStartsAt: number | null
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

export interface ClientBaccaratRoundResult extends Omit<BaccaratRoundResult, 'netByPlayerId'> {
  net: number
}

export interface ClientBaccaratState {
  tableId: string
  tableName: string
  tableKind: 'house' | 'custom'
  houseSeat?: number
  phase: BaccaratPhase
  status: BaccaratTableStatus
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
  dealerTips: BaccaratDealerTips
  shoeCardsLeft: number
  bettingEndsAt: number | null
  nextRoundStartsAt: number | null
}

export interface BaccaratTableInfo {
  id: string
  name: string
  hostId: string | null
  tableKind: 'house' | 'custom'
  houseSeat?: number
  maxPlayers: number
  minBet: number
  maxBet: number
  minBuyin: number
  maxBuyin: number
  status: BaccaratTableStatus
  playerCount: number
  gameType: 'baccarat'
}

export interface BaccaratChatMessage {
  playerId: string
  username: string
  avatar?: string
  text: string
  timestamp: string
}
