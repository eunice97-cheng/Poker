export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
export type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'allin'
export type TableStatus = 'waiting' | 'playing' | 'finished'

export interface ServerObserver {
  socketId: string
  playerId: string
  username: string
  avatar: string
  stack: number
  hasTableEntry?: boolean
}

export interface ServerPlayer {
  socketId: string
  playerId: string      // Supabase UUID
  username: string
  avatar: string
  seat: number
  stack: number
  holeCards: string[]   // actual cards — never sent to other clients
  currentBet: number    // amount bet in this betting round
  totalBetThisHand: number
  folded: boolean
  allIn: boolean
  sittingOut: boolean
  hasActed: boolean     // has acted in the current betting round
  isConnected: boolean
  isBot: boolean
  botTitle?: string
  botStyle?: string
  botMode?: 'auto' | 'manual'
  botJoinStack?: number
  botLeaveAfterHand?: boolean
  standUpAfterHand?: boolean
  reconnectTimer?: NodeJS.Timeout
}

export interface SidePot {
  amount: number
  eligiblePlayerIds: string[]
}

export interface ServerGameState {
  tableId: string
  tableName: string
  smallBlind: number
  bigBlind: number
  minBuyin: number
  maxBuyin: number
  maxPlayers: number
  phase: GamePhase
  status: TableStatus
  deck: string[]
  community: string[]
  pot: number
  sidePots: SidePot[]
  // seat -> player (undefined = empty seat)
  players: Map<number, ServerPlayer>
  // socketId -> seat (for quick lookup)
  socketToSeat: Map<string, number>
  observers: Map<string, ServerObserver>   // playerId -> observer
  dealerSeat: number
  currentSeat: number       // whose turn it is
  currentBetLevel: number   // highest bet this round
  lastRaiseAmount: number
  handNumber: number
  handStartedAt: Date | null
  actionTimer: NodeJS.Timeout | null
}

export interface ClientObserver {
  playerId: string
  username: string
  avatar: string
  stack: number
}

// What each client receives (personalized - no opponent hole cards)
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
  holeCards: string[]   // own real cards, or ['??','??'] for opponents
  isDealer: boolean
  isSB: boolean
  isBB: boolean
  isCurrentTurn: boolean
  isBot: boolean
  botTitle?: string
  standUpAfterHand?: boolean
}

export interface ClientGameState {
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
  myPlayerId: string
  validActions: PlayerAction[]
  observers: ClientObserver[]
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
  hostId: string | null
  maxPlayers: number
  smallBlind: number
  bigBlind: number
  minBuyin: number
  maxBuyin: number
  status: TableStatus
  playerCount: number
}
