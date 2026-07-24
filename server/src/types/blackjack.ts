export type BlackjackSuit = 'S' | 'H' | 'D' | 'C'
export type BlackjackRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
export type BlackjackPhase = 'betting' | 'playing' | 'settled'
export type BlackjackAction = 'hit' | 'stand' | 'double' | 'split' | 'surrender'
export type BlackjackHandStatus = 'playing' | 'stood' | 'busted' | 'blackjack' | 'surrendered' | 'settled'
export type BlackjackTableStatus = 'waiting' | 'playing' | 'finished'
export type BlackjackDealerTips = Record<string, number>

export interface BlackjackCard {
  rank: BlackjackRank
  suit: BlackjackSuit
  value: number
}

export interface BlackjackHand {
  cards: BlackjackCard[]
  bet: number
  status: BlackjackHandStatus
  fromSplit: boolean
  doubled: boolean
  result?: string
  net?: number
}

export interface BlackjackServerPlayer {
  socketId: string
  playerId: string
  username: string
  avatar: string
  seat: number
  stack: number
  bet: number
  hands: BlackjackHand[]
  activeHandIndex: number
  isConnected: boolean
  lastNet: number
  lastResult: string
  missedBetRounds: number
  reconnectTimer?: NodeJS.Timeout
}

export interface BlackjackServerObserver {
  socketId: string
  playerId: string
  username: string
  avatar: string
  stack: number
  hasTableEntry?: boolean
}

export interface BlackjackServerState {
  tableId: string
  tableName: string
  minBet: number
  maxBet: number
  minBuyin: number
  maxBuyin: number
  maxPlayers: number
  status: BlackjackTableStatus
  phase: BlackjackPhase
  deck: BlackjackCard[]
  shuffleDue: boolean
  dealerCards: BlackjackCard[]
  hideHoleCard: boolean
  players: Map<number, BlackjackServerPlayer>
  socketToSeat: Map<string, number>
  observers: Map<string, BlackjackServerObserver>
  currentSeat: number
  roundNumber: number
  message: string
  messageUpdatedAt: number
  dealerTips: BlackjackDealerTips
  bettingEndsAt: number | null
  turnEndsAt: number | null
  nextRoundStartsAt: number | null
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

export interface ClientBlackjackState {
  tableId: string
  tableName: string
  phase: BlackjackPhase
  status: BlackjackTableStatus
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
  dealerTips: BlackjackDealerTips
  shoeCardsLeft: number
  bettingEndsAt: number | null
  turnEndsAt: number | null
  nextRoundStartsAt: number | null
}

export interface BlackjackTableInfo {
  id: string
  name: string
  hostId: string | null
  maxPlayers: number
  minBet: number
  maxBet: number
  minBuyin: number
  maxBuyin: number
  status: BlackjackTableStatus
  playerCount: number
  gameType: 'blackjack'
}
