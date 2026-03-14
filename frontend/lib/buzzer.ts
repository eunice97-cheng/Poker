export interface BuzzerCurrentHousePlayer {
  playerId: string
  username: string
  avatar: string
  botTitle: string | null
  leaveAfterHand: boolean
  botMode: 'auto' | 'manual'
}

export interface BuzzerRoom {
  tableId: string
  tableName: string
  phase: string
  status: string
  playerCount: number
  realPlayerCount: number
  botPlayerCount: number
  maxPlayers: number
  smallBlind: number
  bigBlind: number
  minBuyin: number
  maxBuyin: number
  houseJoinSuppressed: boolean
  currentHousePlayer: BuzzerCurrentHousePlayer | null
  currentHousePlayers: BuzzerCurrentHousePlayer[]
  canSummon: boolean
  canDismiss: boolean
}

export interface BuzzerHousePlayer {
  id: string
  name: string
  title: string
  avatar: string
  bankroll: number
  availableAt: number
  assignedTableId: string | null
  isReady: boolean
}
