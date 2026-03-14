import { evaluateHands } from '../game/HandEvaluator'
import { getCallAmount, getMinRaise, getValidActions } from '../game/ActionValidator'
import { PlayerAction, ServerGameState, ServerPlayer } from '../types/game'

const HOUSE_AI_STARTING_BANKROLL = 10_000
const HOUSE_AI_REST_MS = 60 * 60 * 1000

type HouseStyle = 'calm' | 'drunk' | 'trickster' | 'warrior' | 'lucky' | 'assassin'

interface HousePlayerDefinition {
  id: string
  name: string
  title: string
  avatar: string
  style: HouseStyle
  introLine: string
  restLine: string
  guestLine: string
  aggression: number
  looseness: number
  bluffRate: number
  allInRate: number
}

interface HousePlayerState {
  profile: HousePlayerDefinition
  bankroll: number
  availableAt: number
  assignedTableId: string | null
  reserveStack: number
  joinedStack: number
}

const HOUSE_ROSTER: HousePlayerDefinition[] = [
  { id: 'ai_alice', name: 'Alice', title: 'The Calm Cultivator', avatar: 'ai_alice', style: 'calm', introLine: 'Alice takes a quiet seat and smooths the felt.', restLine: 'Alice exhales softly. "That is enough for tonight."', guestLine: 'Alice gives up the seat without complaint.', aggression: 0.22, looseness: 0.2, bluffRate: 0.06, allInRate: 0.01 },
  { id: 'ai_bernice', name: 'Bernice', title: 'The Drunken Gambler', avatar: 'ai_bernice', style: 'drunk', introLine: 'Bernice drops into the seat with a drink and a bad idea.', restLine: 'Bernice laughs into her drink. "All right, I need a breather."', guestLine: 'Bernice slides out of the seat. "Your turn to make bad decisions."', aggression: 0.72, looseness: 0.9, bluffRate: 0.2, allInRate: 0.14 },
  { id: 'ai_candice', name: 'Candice', title: 'The Fox Trickster', avatar: 'ai_candice', style: 'trickster', introLine: 'Candice slips into the game with a smile that means trouble.', restLine: 'Candice smirks. "Fine. I will save the rest for later."', guestLine: 'Candice rises with a grin. "I will leave the mind games to you two."', aggression: 0.58, looseness: 0.52, bluffRate: 0.34, allInRate: 0.04 },
  { id: 'ai_denice', name: 'Denice', title: 'The Iron Warrior', avatar: 'ai_denice', style: 'warrior', introLine: 'Denice takes her seat like she owns the room.', restLine: 'Denice pushes back from the table. "Not my round. Next time."', guestLine: 'Denice stands and yields the seat like a challenge, not a favor.', aggression: 0.82, looseness: 0.55, bluffRate: 0.15, allInRate: 0.08 },
  { id: 'ai_felice', name: 'Felice', title: 'The Lucky Disciple', avatar: 'ai_felice', style: 'lucky', introLine: 'Felice takes a seat with the kind of luck that scares people.', restLine: 'Felice blinks at the stack. "Oh. That went fast."', guestLine: 'Felice hops off the seat. "Looks like you two need the space."', aggression: 0.42, looseness: 0.7, bluffRate: 0.18, allInRate: 0.06 },
  { id: 'ai_gillece', name: 'Gillece', title: 'The Silent Assassin', avatar: 'ai_gillece', style: 'assassin', introLine: 'Gillece sits in silence. That is warning enough.', restLine: 'Gillece says nothing, only vanishes from the table.', guestLine: 'Gillece leaves the seat in silence for the new arrival.', aggression: 0.48, looseness: 0.34, bluffRate: 0.1, allInRate: 0.03 },
]

const houseStates = new Map<string, HousePlayerState>()
let rosterIndex = 0
let lastResetDay = ''

function getDayKey() {
  return new Date().toISOString().slice(0, 10)
}

function ensureDailyReset() {
  const dayKey = getDayKey()
  if (dayKey === lastResetDay) return
  lastResetDay = dayKey

  houseStates.clear()
  for (const profile of HOUSE_ROSTER) {
    houseStates.set(profile.id, {
      profile,
      bankroll: HOUSE_AI_STARTING_BANKROLL,
      availableAt: 0,
      assignedTableId: null,
      reserveStack: 0,
      joinedStack: 0,
    })
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function cardRankValue(card: string) {
  const rank = card[0]
  const values: Record<string, number> = {
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    T: 10,
    J: 11,
    Q: 12,
    K: 13,
    A: 14,
  }
  return values[rank] ?? 0
}

function getPreflopStrength(holeCards: string[]) {
  if (holeCards.length !== 2) return 0
  const [a, b] = holeCards
  const av = cardRankValue(a)
  const bv = cardRankValue(b)
  const hi = Math.max(av, bv)
  const lo = Math.min(av, bv)
  const pair = av === bv
  const suited = a[1] === b[1]
  const gap = hi - lo

  let score = hi * 4 + lo * 2
  if (pair) score += 28 + hi * 2
  if (suited) score += 7
  if (gap === 1) score += 6
  else if (gap === 2) score += 3
  else if (gap >= 4) score -= 10
  if (hi >= 13 && lo >= 10) score += 8

  return clamp(score, 5, 100)
}

function rankToStrength(rank: string) {
  const normalized = rank.toLowerCase()
  if (normalized.includes('straight flush')) return 100
  if (normalized.includes('four of a kind')) return 98
  if (normalized.includes('full house')) return 95
  if (normalized.includes('flush')) return 88
  if (normalized.includes('straight')) return 82
  if (normalized.includes('three of a kind')) return 74
  if (normalized.includes('two pair')) return 62
  if (normalized.includes('pair')) return 47
  return 26
}

function getHandStrength(player: ServerPlayer, state: ServerGameState) {
  if (state.community.length < 3) return getPreflopStrength(player.holeCards)
  try {
    const [evaluated] = evaluateHands(
      [{ playerId: player.playerId, username: player.username, holeCards: player.holeCards }],
      state.community
    )
    return evaluated ? rankToStrength(evaluated.rank) : getPreflopStrength(player.holeCards)
  } catch {
    return getPreflopStrength(player.holeCards)
  }
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function buildAssignedHousePlayer(
  state: HousePlayerState,
  tableId: string,
  seat: number,
  minBuyin: number,
  maxBuyin: number,
  botMode: 'auto' | 'manual'
): ServerPlayer | null {
  const now = Date.now()
  if (state.assignedTableId) return null
  if (state.availableAt > now) return null
  if (state.bankroll < minBuyin) return null

  const joinStack = clamp(state.bankroll, minBuyin, maxBuyin)
  const reserveStack = state.bankroll - joinStack
  state.assignedTableId = tableId
  state.joinedStack = joinStack
  state.reserveStack = reserveStack

  return {
    socketId: `bot:${state.profile.id}`,
    playerId: state.profile.id,
    username: state.profile.name,
    avatar: state.profile.avatar,
    seat,
    stack: joinStack,
    holeCards: [],
    currentBet: 0,
    totalBetThisHand: 0,
    folded: false,
    allIn: false,
    sittingOut: false,
    hasActed: false,
    isConnected: true,
    isBot: true,
    botTitle: state.profile.title,
    botStyle: state.profile.style,
    botMode,
    botJoinStack: joinStack,
  }
}

export function assignHousePlayer(
  tableId: string,
  seat: number,
  minBuyin: number,
  maxBuyin: number
): ServerPlayer | null {
  ensureDailyReset()

  for (let i = 0; i < HOUSE_ROSTER.length; i++) {
    const profile = HOUSE_ROSTER[(rosterIndex + i) % HOUSE_ROSTER.length]
    const state = houseStates.get(profile.id)!
    const player = buildAssignedHousePlayer(state, tableId, seat, minBuyin, maxBuyin, 'auto')
    if (!player) continue

    rosterIndex = (rosterIndex + i + 1) % HOUSE_ROSTER.length
    return player
  }

  return null
}

export function assignSpecificHousePlayer(
  housePlayerId: string,
  tableId: string,
  seat: number,
  minBuyin: number,
  maxBuyin: number
): ServerPlayer | null {
  ensureDailyReset()
  const state = houseStates.get(housePlayerId)
  if (!state) return null

  return buildAssignedHousePlayer(state, tableId, seat, minBuyin, maxBuyin, 'manual')
}

export function isHousePlayerAvailable(housePlayerId: string, minBuyin: number) {
  ensureDailyReset()
  const state = houseStates.get(housePlayerId)
  if (!state) return false

  return !state.assignedTableId && state.availableAt <= Date.now() && state.bankroll >= minBuyin
}

export function getAvailableHousePlayers(minBuyin: number) {
  ensureDailyReset()
  return Array.from(houseStates.values())
    .filter((state) => !state.assignedTableId && state.availableAt <= Date.now() && state.bankroll >= minBuyin)
    .map((state) => state.profile.id)
}

export function getHouseProfileSummary(housePlayerId: string) {
  ensureDailyReset()
  const state = houseStates.get(housePlayerId)
  if (!state) return null

  return {
    id: state.profile.id,
    name: state.profile.name,
    title: state.profile.title,
    avatar: state.profile.avatar,
    bankroll: state.bankroll,
    availableAt: state.availableAt,
    assignedTableId: state.assignedTableId,
    isReady: !state.assignedTableId && state.availableAt <= Date.now(),
  }
}

export function rejuvenateHousePlayer(housePlayerId: string, minBankroll: number) {
  ensureDailyReset()
  const state = houseStates.get(housePlayerId)
  if (!state) {
    return { ok: false as const, message: 'House player not found.' }
  }

  if (state.assignedTableId) {
    return { ok: false as const, message: `${state.profile.name} is already working another table.` }
  }

  const bankrollFloor = Math.max(0, minBankroll)
  const chipsAdded = Math.max(0, bankrollFloor - state.bankroll)

  state.bankroll += chipsAdded
  state.availableAt = 0
  state.joinedStack = 0
  state.reserveStack = 0

  if (chipsAdded > 0) {
    return {
      ok: true as const,
      message: `${state.profile.name} is rejuvenated and topped up with ${chipsAdded.toLocaleString()} chips.`,
      chipsAdded,
      bankroll: state.bankroll,
    }
  }

  return {
    ok: true as const,
    message: `${state.profile.name} is rejuvenated and ready for your buzzer.`,
    chipsAdded: 0,
    bankroll: state.bankroll,
  }
}

export function releaseHousePlayer(player: ServerPlayer, reason: 'table_closed' | 'rest' | 'normal' = 'normal') {
  ensureDailyReset()
  const state = houseStates.get(player.playerId)
  if (!state) return

  state.assignedTableId = null
  state.bankroll = Math.max(0, state.reserveStack + Math.max(0, player.stack + player.currentBet))
  state.joinedStack = 0
  state.reserveStack = 0
  state.availableAt = reason === 'rest' ? Date.now() + HOUSE_AI_REST_MS : 0
}

export function releaseHousePlayersForTable(players: Iterable<ServerPlayer>) {
  for (const player of players) {
    if (player.isBot) releaseHousePlayer(player, 'table_closed')
  }
}

export function shouldHousePlayerRest(player: ServerPlayer) {
  if (!player.isBot || !player.botJoinStack) return false
  return player.stack <= player.botJoinStack * 0.5
}

export function decideHouseAction(player: ServerPlayer, state: ServerGameState): { action: PlayerAction; amount?: number } {
  ensureDailyReset()
  const validActions = getValidActions(player, state)
  const toCall = getCallAmount(player, state)
  const minRaise = getMinRaise(state)
  const maxTotal = player.currentBet + player.stack
  const pot = state.pot + Array.from(state.players.values()).reduce((sum, p) => sum + p.currentBet, 0)
  const strength = getHandStrength(player, state)
  const profile = houseStates.get(player.playerId)?.profile

  if (!profile) {
    return { action: toCall > 0 && validActions.includes('call') ? 'call' : 'check' }
  }

  const pressure = toCall / Math.max(1, player.stack + player.currentBet)
  const street = state.community.length
  const rand = Math.random()
  const bluffChance = profile.bluffRate * (street >= 3 ? 1.2 : 0.8)
  const allInChance = profile.allInRate + (profile.style === 'drunk' ? 0.08 : 0)
  const aggressiveRaiseChance = profile.aggression * (strength / 100)
  const looseCallFloor = 20 + profile.looseness * 25

  if (validActions.includes('allin')) {
    if (strength >= 93) return { action: 'allin' }
    if (profile.style === 'drunk' && rand < allInChance) return { action: 'allin' }
    if (profile.style === 'warrior' && strength >= 78 && pressure > 0.35 && rand < 0.45) return { action: 'allin' }
  }

  if (validActions.includes('raise')) {
    const wantsBluff =
      profile.style === 'trickster' && strength < 45 && rand < bluffChance && pressure < 0.4

    const wantsTrapRaise =
      profile.style === 'assassin' && street >= 3 && strength >= 72 && rand < 0.58

    const wantsValueRaise =
      strength >= 60 + (1 - profile.aggression) * 15 && rand < aggressiveRaiseChance + profile.looseness * 0.12

    const wantsChaosRaise =
      (profile.style === 'drunk' || profile.style === 'lucky') && rand < profile.aggression * 0.22

    if (wantsBluff || wantsTrapRaise || wantsValueRaise || wantsChaosRaise) {
      let raiseFactor = 1.2 + profile.aggression * 1.4
      if (profile.style === 'drunk') raiseFactor += Math.random() * 2.2
      if (profile.style === 'lucky') raiseFactor += Math.random() * 1.3
      if (profile.style === 'assassin' && street < 3) raiseFactor = 1.0

      const target = clamp(
        Math.round(minRaise + Math.max(state.bigBlind, pot * (0.18 + raiseFactor * 0.12))),
        minRaise,
        maxTotal
      )

      if (target >= maxTotal && validActions.includes('allin') && (strength >= 75 || rand < allInChance)) {
        return { action: 'allin' }
      }

      if (target >= minRaise && target <= maxTotal) {
        if (!(profile.style === 'assassin' && street < 3 && strength < 85)) {
          return { action: 'raise', amount: target }
        }
      }
    }
  }

  if (toCall > 0) {
    const shouldFold =
      strength < looseCallFloor - pressure * 30 &&
      !(profile.style === 'trickster' && rand < bluffChance) &&
      !(profile.style === 'lucky' && rand < 0.18)

    if (shouldFold && validActions.includes('fold')) {
      return { action: 'fold' }
    }

    if (validActions.includes('call')) {
      if (profile.style === 'calm' && pressure > 0.28 && strength < 55) return { action: 'fold' }
      if (profile.style === 'assassin' && street < 3 && strength < 48 && pressure > 0.18) return { action: 'fold' }
      return { action: 'call' }
    }
  }

  if (validActions.includes('check')) return { action: 'check' }
  if (validActions.includes('call')) return { action: 'call' }
  if (validActions.includes('fold')) return { action: 'fold' }

  return { action: 'check' }
}

export function getHouseRestingSummary() {
  ensureDailyReset()
  return Array.from(houseStates.values()).map((state) => ({
    id: state.profile.id,
    name: state.profile.name,
    title: state.profile.title,
    avatar: state.profile.avatar,
    bankroll: state.bankroll,
    availableAt: state.availableAt,
    assignedTableId: state.assignedTableId,
    isReady: !state.assignedTableId && state.availableAt <= Date.now(),
  }))
}

function getHouseProfile(playerId: string) {
  ensureDailyReset()
  return houseStates.get(playerId)?.profile ?? null
}

export function getHouseIntroLine(playerId: string) {
  return getHouseProfile(playerId)?.introLine ?? null
}

export function getHouseExitLine(playerId: string, reason: 'rest' | 'guest') {
  const profile = getHouseProfile(playerId)
  if (!profile) return null
  return reason === 'rest' ? profile.restLine : profile.guestLine
}
