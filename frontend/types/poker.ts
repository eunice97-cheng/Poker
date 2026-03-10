export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
export type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'allin'
export type TableStatus = 'waiting' | 'playing' | 'finished'

export interface ClientPlayer {
  playerId: string
  username: string
  avatar: string
  seat: number
  stack: number
  currentBet: number
  totalBetThisHand: number
  folded: boolean
  allIn: boolean
  sittingOut: boolean
  isConnected: boolean
  holeCards: string[]   // own real cards, '??' for opponents
  isDealer: boolean
  isSB: boolean
  isBB: boolean
  isCurrentTurn: boolean
}

export interface SidePot {
  amount: number
  eligiblePlayerIds: string[]
}

export interface GameState {
  tableId: string
  tableName: string
  phase: GamePhase
  pot: number
  sidePots: SidePot[]
  community: string[]
  players: ClientPlayer[]
  dealerSeat: number
  currentSeat: number
  smallBlind: number
  bigBlind: number
  minRaise: number
  callAmount: number
  handNumber: number
  myHandRank: string
  myPlayerId: string
  validActions: PlayerAction[]
}

export interface HandResult {
  winners: {
    playerId: string
    username: string
    amount: number
    handRank: string
    holeCards: string[]
  }[]
  allHoleCards: { playerId: string; username: string; holeCards: string[] }[]
  pot: number
  community: string[]
  sidePots: SidePot[]
}

export interface TableInfo {
  id: string
  name: string
  host_id: string | null
  max_players: number
  small_blind: number
  big_blind: number
  min_buyin: number
  max_buyin: number
  status: TableStatus
  player_count: number
  created_at: string
}

export interface Profile {
  id: string
  username: string
  chip_balance: number
  games_played: number
  games_won: number
  avatar: string
  created_at: string
}

export interface ChatMessage {
  playerId: string
  username: string
  text: string
  timestamp: string
  isSystem?: boolean
}

export interface ActionRequired {
  validActions: PlayerAction[]
  callAmount: number
  minRaise: number
  timeLimit: number
}
