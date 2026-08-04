'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { AvatarDisplay } from '@/components/ui/AvatarDisplay'
import { ChatBox } from '@/components/game/ChatBox'
import { ChatEmojiTray } from '@/components/ui/ChatEmojiTray'
import { ChatMessageText } from '@/components/ui/ChatMessageText'
import { ExitIcon } from '@/components/ui/ExitIcon'
import { useSocket } from '@/hooks/useSocket'
import { useBlackjackState } from '@/hooks/useBlackjackState'
import { appendChatEmojiCode } from '@/lib/chat-emojis'
import { useAudio } from '@/hooks/useAudio'
import type { BlackjackAction, BlackjackCard, BlackjackState, ClientBlackjackHand, ClientBlackjackPlayer } from '@/types/blackjack'
import type { ChatMessage } from '@/types/poker'

interface BlackjackTableClientProps {
  tableId: string
  token: string
  chipBalance: number
}

type SessionHistoryItem = {
  round: number
  label: string
  net: number
  detail: string
  type: 'win' | 'lose' | 'push'
}

type ChipAnimation = {
  id: number
  value: number
}

type BlackjackCelebrationTarget = 'dealer' | 'self' | 'table'

type BlackjackCelebration = {
  id: number
  key: string
  target: BlackjackCelebrationTarget
  name: string
}

type DealerPortraitKey = 'normal' | 'smiling' | 'blinking'

type DealerAssets = {
  id: string
  name: string
  portraits: Record<DealerPortraitKey, string>
  thankYou: {
    normal: string
    wink: string
  }
}

const CHIP_VALUES = [10, 20, 50, 100, 500, 1000]
const CHIP_STACK_VALUES = [1000, 500, 100, 50, 20, 10]
const CHIP_STACK_OFFSETS = [
  [0, 1, -5],
  [-4, -2, 8],
  [4, -2, -9],
  [-2, 3, 5],
  [2, 3, -4],
  [0, -5, 7],
] as const
const SEAT_COUNT = 7
const BLACKJACK_DEALER_TIP_AMOUNT = 10
const MAX_CHAT_LENGTH = 200
const DEALER_ROTATION_MS = 2 * 60 * 60 * 1000
const DEALERS: DealerAssets[] = [
  {
    id: 'chloe',
    name: 'Chloe',
    portraits: {
      normal: '/blackjack/Images/Dealers/Chloe.png',
      smiling: '/blackjack/Images/Dealers/Chloe%20-%20smiling.png',
      blinking: '/blackjack/Images/Dealers/Chloe%20-%20blinking.png',
    },
    thankYou: {
      normal: '/blackjack/Images/Dealers/chloe%20thank%20you.png',
      wink: '/blackjack/Images/Dealers/chloe%20thank%20you%20wink.png',
    },
  },
  {
    id: 'eunice',
    name: 'Eunice',
    portraits: {
      normal: '/blackjack/Images/Dealers/Eunice4.png',
      smiling: '/blackjack/Images/Dealers/Eunice4%20-%20smiling.png',
      blinking: '/blackjack/Images/Dealers/Eunice4%20-%20blinking.png',
    },
    thankYou: {
      normal: '/blackjack/Images/Dealers/thank%20you.png',
      wink: '/blackjack/Images/Dealers/thank%20you%20wink.png',
    },
  },
  {
    id: 'julie',
    name: 'Julie',
    portraits: {
      normal: '/blackjack/Images/Dealers/Julie.png',
      smiling: '/blackjack/Images/Dealers/Julie%20-%20smiling.png',
      blinking: '/blackjack/Images/Dealers/Julie%20-%20blinking.png',
    },
    thankYou: {
      normal: '/blackjack/Images/Dealers/Julie%20-%20thank%20you.png',
      wink: '/blackjack/Images/Dealers/Julie%20-%20thank%20you%20wink.png',
    },
  },
]
const BLINK_DELAY_RANGE_MS = [2000, 10000] as const
const BLINK_DURATION_RANGE_MS = [100, 400] as const
const SMILE_SWITCH_RANGE_MS = [5000, 25000] as const
const TRANSIENT_DEALER_LINE_MS = 4500
const BLACKJACK_CELEBRATION_MS = 2350
const DEALER_SWITCH_THANK_MS = 3200
const DEALER_SWITCH_GAP_MS = 650
const DEALER_SWITCH_INTRO_MS = 3600
const PERSISTENT_DEALER_LINES = new Set(['Place your bets, please.', 'Betting is now open.'])
const BLACKJACK_STYLESHEET = '/blackjack/styles.css?v=20260724-28'
const DEALER_AUDIO_BASE = '/blackjack/Audio/Dealer/'
const SUIT_SYMBOLS: Record<BlackjackCard['suit'], string> = {
  S: '\u2660',
  H: '\u2665',
  D: '\u2666',
  C: '\u2663',
}

const BLACKJACK_CELEBRATION_SPARKS = [
  ['-172px', '-72px', '0ms'],
  ['-126px', '82px', '70ms'],
  ['-68px', '-118px', '120ms'],
  ['18px', '124px', '30ms'],
  ['72px', '-104px', '95ms'],
  ['138px', '74px', '150ms'],
  ['178px', '-34px', '55ms'],
  ['-14px', '-148px', '180ms'],
] as const

const BLACKJACK_CELEBRATION_CHIPS = [
  { value: 10, x: '-128px', y: '74px', rotation: '-42deg', delay: '70ms' },
  { value: 50, x: '138px', y: '-66px', rotation: '38deg', delay: '120ms' },
  { value: 100, x: '-154px', y: '-44px', rotation: '58deg', delay: '170ms' },
  { value: 500, x: '118px', y: '88px', rotation: '-64deg', delay: '210ms' },
] as const

const ACTION_LABELS: Record<BlackjackAction, string> = {
  hit: 'HIT',
  stand: 'STAND',
  double: 'DOUBLE',
  split: 'SPLIT',
  surrender: 'SURRENDER',
}

const DEALER_AUDIO_FILES: Record<string, string> = {
  'Place your bets, please.': 'Place your bets, please.mp3',
  'Betting is now open.': 'Betting is now open.mp3',
  'No more bets.': 'No more bets.mp3',
  'Bets are closed.': 'Bets are closed.mp3',
  'Feel free to join the next round.': 'Feel free to join the next round.mp3',
  "Dealer's turn.": "Dealer's turn.mp3",
  'Better luck next hand.': 'Better luck next hand.mp3',
  'Natural twenty-one.': 'Natural twenty-one.mp3',
  'Blackjack! Congratulations.': 'Blackjack! Congratulations.mp3',
  'Natural blackjack for the dealer.': 'Natural blackjack for the dealer.mp3',
  "That's a dealer blackjack.": "That's a dealer blackjack.mp3",
  'All remaining hands win.': 'All remaining hands win.mp3',
  'A tie this round.': 'A tie this round.mp3',
  'Dealer shows an Ace. Would you like to buy insurance?': 'Dealer shows an Ace. Would you like to buy insurance.mp3',
}

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function tableMessage(message: string) {
  return message.replace(/\s*\(https?:\/\/[^)]+\)/gi, '').trim()
}

function randomMs([min, max]: readonly [number, number]) {
  return Math.round(min + Math.random() * (max - min))
}

function secondsLeft(target: number | null | undefined, now: number) {
  if (!target) return 0
  return Math.max(0, Math.ceil((target - now) / 1000))
}

function dealerAudioSrc(fileName: string) {
  return `${DEALER_AUDIO_BASE}${fileName.split('/').map(encodeURIComponent).join('/')}`
}

function isAddressedToViewer(addressedName: string, viewerName: string) {
  return addressedName.trim().toLowerCase() === viewerName.trim().toLowerCase()
}

function addressedDealerAudioSrc(addressedName: string, viewerName: string, fileName: string) {
  return isAddressedToViewer(addressedName, viewerName) ? dealerAudioSrc(fileName) : null
}

function dealerAudioForLine(line: string, viewerName: string, isMyTurn: boolean) {
  const trimmed = line.trim()
  if (!trimmed) return null

  const exactFile = DEALER_AUDIO_FILES[trimmed]
  if (exactFile) return dealerAudioSrc(exactFile)

  const welcomeMatch = trimmed.match(/^Welcome, (.+)\.$/)
  if (welcomeMatch?.[1]) return addressedDealerAudioSrc(welcomeMatch[1], viewerName, 'Welcome.mp3')

  const gladMatch = trimmed.match(/^Glad you can join us, (.+)\.$/)
  if (gladMatch?.[1]) return addressedDealerAudioSrc(gladMatch[1], viewerName, 'Glad you can join us.mp3')

  const thanksMatch = trimmed.match(/^Thanks for playing, (.+)\.$/)
  if (thanksMatch?.[1]) return addressedDealerAudioSrc(thanksMatch[1], viewerName, 'Thanks for playing.mp3')

  const goodbyeMatch = trimmed.match(/^See you next time, (.+)\.$/)
  if (goodbyeMatch?.[1]) return addressedDealerAudioSrc(goodbyeMatch[1], viewerName, 'See you next time.mp3')

  const winMatch = trimmed.match(/^Well played, (.+)\.$/)
  if (winMatch?.[1]) return addressedDealerAudioSrc(winMatch[1], viewerName, 'Well played.mp3')

  const loseMatch = trimmed.match(/^Close one, (.+)\.$/)
  if (loseMatch?.[1]) return addressedDealerAudioSrc(loseMatch[1], viewerName, 'Close one.mp3')

  if (/^.+'s turn\.$/.test(trimmed)) return isMyTurn ? dealerAudioSrc('Your turn.mp3') : null

  const introMatch = trimmed.match(/^Good evening, I'm Dealer (.+)\. Place your bets when you're ready\.$/)
  if (introMatch?.[1]) {
    return dealerAudioSrc(`Good evening, I'm Dealer ${introMatch[1]}. Place your bets when you're ready..mp3`)
  }

  const tippedSignoffMatch = trimmed.match(/^Thank you for the tips and support\. Dealer (.+) is signing off\.$/)
  if (tippedSignoffMatch?.[1]) {
    return dealerAudioSrc(`Thank you for the tips and support. Dealer ${tippedSignoffMatch[1]} is signing off..mp3`)
  }

  const signoffMatch = trimmed.match(/^Thank you for playing\. Dealer (.+) is signing off\.$/)
  if (signoffMatch?.[1]) {
    return dealerAudioSrc(`Thank you for playing. Dealer ${signoffMatch[1]} is signing off..mp3`)
  }

  return null
}

function dealerForTime(time: number) {
  return DEALERS[Math.floor(time / DEALER_ROTATION_MS) % DEALERS.length] ?? DEALERS[0]
}

function dealerIntroLine(dealer: DealerAssets) {
  return `Good evening, I'm Dealer ${dealer.name}. Place your bets when you're ready.`
}

function dealerThankLine(dealer: DealerAssets, totalTips: number) {
  if (totalTips > 0) {
    return `Thank you for the tips and support. Dealer ${dealer.name} is signing off.`
  }

  return `Thank you for playing. Dealer ${dealer.name} is signing off.`
}

function money(value: number) {
  return `$${value.toLocaleString()}`
}

function signedMoney(value: number) {
  if (value > 0) return `+${money(value)}`
  if (value < 0) return `-${money(Math.abs(value))}`
  return '$0'
}

function clampIntegerValue(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.floor(value)))
}

function historyTypeFromNet(net: number, label: string): SessionHistoryItem['type'] {
  if (net > 0) return 'win'
  if (net < 0) return 'lose'
  if (label.toLowerCase().includes('push')) return 'push'
  return 'push'
}

function scoreCards(cards: BlackjackCard[]) {
  let total = cards.reduce((sum, card) => sum + card.value, 0)
  let aces = cards.filter((card) => card.rank === 'A').length

  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }

  return total
}

function handHasCards(hand: ClientBlackjackHand) {
  return (hand.cardCount ?? hand.cards.length) > 0
}

function handScore(hand: ClientBlackjackHand) {
  return hand.score ?? scoreCards(hand.cards)
}

function isBlackjackHand(hand: ClientBlackjackHand) {
  return hand.status === 'blackjack' || hand.result === 'Blackjack'
}

function blackjackCelebrationForState(state: BlackjackState): Omit<BlackjackCelebration, 'id'> | null {
  const dealerHasNatural = state.phase === 'settled'
    && state.dealerCards.length === 2
    && state.dealerCards.every((card) => card !== null)
    && state.dealerScore === 21

  if (dealerHasNatural) {
    return {
      key: `${state.tableId}:${state.roundNumber}:dealer-blackjack`,
      target: 'dealer',
      name: 'Dealer',
    }
  }

  const playersWithBlackjack = state.players.filter((player) => player.hands.some(isBlackjackHand))
  if (playersWithBlackjack.length === 0) return null

  const focusPlayer = playersWithBlackjack.find((player) => player.playerId === state.myPlayerId) ?? playersWithBlackjack[0]
  const playerIds = playersWithBlackjack.map((player) => player.playerId).sort().join('|')

  return {
    key: `${state.tableId}:${state.roundNumber}:player-blackjack:${playerIds}`,
    target: focusPlayer.playerId === state.myPlayerId ? 'self' : 'table',
    name: playersWithBlackjack.length > 1 ? `${playersWithBlackjack.length} Players` : focusPlayer.username,
  }
}

function otherPlayerScoreLabel(player: ClientBlackjackPlayer) {
  const hands = player.hands.filter(handHasCards)
  if (hands.length === 0) return ''
  return hands.map(handScore).join(' / ')
}

function chipFacesForBet(value: number) {
  const faces: number[] = []
  let remaining = value

  for (const chipValue of CHIP_STACK_VALUES) {
    while (remaining >= chipValue && faces.length < 6) {
      faces.push(chipValue)
      remaining -= chipValue
    }
  }

  return faces.length > 0 ? faces : [10]
}

export function BlackjackTableClient({ tableId, token, chipBalance: initialChipBalance }: BlackjackTableClientProps) {
  const router = useRouter()
  const { socket, connected, error: socketError } = useSocket(token)
  const {
    musicVol,
    sfxVol,
    musicMute,
    sfxMute,
    setMusicVol,
    setSfxVol,
    toggleMusic,
    toggleSfx,
    playSfx,
    playDealerVoice,
  } = useAudio()
  const [accountBalance, setAccountBalance] = useState(initialChipBalance)
  const [selectedChip, setSelectedChip] = useState(10)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeDealer, setActiveDealer] = useState(() => dealerForTime(Date.now()))
  const [dealerPortrait, setDealerPortrait] = useState<DealerPortraitKey>('normal')
  const [pendingDealer, setPendingDealer] = useState<DealerAssets | null>(null)
  const [dealerSwitchLine, setDealerSwitchLine] = useState('')
  const [dealerTransitionState, setDealerTransitionState] = useState<'stable' | 'leaving' | 'away' | 'arriving'>('stable')
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([])
  const recordedRoundRef = useRef<number | null>(null)
  const [tipVisible, setTipVisible] = useState(false)
  const [tipImage, setTipImage] = useState(() => dealerForTime(Date.now()).thankYou.normal)
  const [tipLoading, setTipLoading] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState('')
  const [rebuyAmount, setRebuyAmount] = useState(1000)
  const [rebuyLoading, setRebuyLoading] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [showDealerLine, setShowDealerLine] = useState(true)
  const [chipAnimation, setChipAnimation] = useState<ChipAnimation | null>(null)
  const [blackjackCelebration, setBlackjackCelebration] = useState<BlackjackCelebration | null>(null)
  const chipAnimationTimeoutRef = useRef<number | null>(null)
  const blackjackCelebrationTimeoutRef = useRef<number | null>(null)
  const seenBlackjackCelebrationsRef = useRef<Set<string>>(new Set())
  const tipTimeoutsRef = useRef<number[]>([])
  const dealerSwitchTimeoutsRef = useRef<number[]>([])
  const activeDealerRef = useRef(activeDealer)
  const blackjackSfxRef = useRef({ roundKey: '', cardCount: 0, resultKey: '' })
  const dealerVoiceKeyRef = useRef('')

  const {
    blackjackState,
    messages,
    actionLogs,
    bustedInfo,
    tableError,
    lastError,
    clearBusted,
    clearLastError,
    placeBet,
    clearBet,
    buyInsurance,
    rebuy,
    tipDealer,
    sitOut,
    sitIn,
    sendAction,
    sendChat,
  } = useBlackjackState(socket, tableId)

  const me = useMemo(
    () => blackjackState?.players.find((player) => player.playerId === blackjackState.myPlayerId) ?? null,
    [blackjackState]
  )
  const waitingMe = useMemo(
    () => blackjackState?.observers?.find((observer) => observer.playerId === blackjackState.myPlayerId) ?? null,
    [blackjackState]
  )
  const viewerName = me?.username ?? waitingMe?.username ?? ''
  const visualSeatPlayers = useMemo(() => {
    const seats: Array<ClientBlackjackPlayer | undefined> = Array.from({ length: SEAT_COUNT })
    if (!blackjackState) return seats

    blackjackState.players.forEach((player) => {
      if (player.seat >= 0 && player.seat < SEAT_COUNT) {
        seats[player.seat] = player
      }
    })

    return seats
  }, [blackjackState])

  const playerHands = me?.hands ?? []
  const activeHand = playerHands[me?.activeHandIndex ?? 0] ?? playerHands[0] ?? null
  const currentBet = playerHands.length > 0 ? playerHands.reduce((sum, hand) => sum + hand.bet, 0) : me?.bet ?? 0
  const tableMinBuyin = blackjackState?.minBuyin ?? bustedInfo?.minBuyin ?? 1000
  const tableMaxBuyin = blackjackState?.maxBuyin ?? bustedInfo?.maxBuyin ?? 20000
  const tableStack = me?.stack ?? waitingMe?.stack ?? 0
  const normalizedRebuyAmount = clampIntegerValue(rebuyAmount, tableMinBuyin, tableMaxBuyin)
  const chatMessages = useMemo<ChatMessage[]>(
    () => messages.map((message) => ({ ...message, isSystem: false })),
    [messages]
  )
  const activeDealerTipTotal = blackjackState?.dealerTips?.[activeDealer.id] ?? 0
  const activeDealerTipRows = useMemo(() => [
    {
      id: activeDealer.id,
      name: activeDealer.name,
      total: activeDealerTipTotal,
      active: true,
    },
  ], [activeDealer.id, activeDealer.name, activeDealerTipTotal])
  const canBet = blackjackState?.phase === 'betting'
  const isRoundLocked = blackjackState?.phase === 'playing' || blackjackState?.phase === 'insurance'
  const needsTableBuyIn = Boolean((me || waitingMe) && !isRoundLocked && tableStack < (blackjackState?.minBet ?? 0))
  const canSitAtSeat = Boolean(waitingMe && blackjackState && blackjackState.players.length < blackjackState.maxPlayers)
  const isMyTurn = Boolean(me?.isCurrentTurn)
  const bettingSecondsLeft = secondsLeft(blackjackState?.bettingEndsAt, now)
  const insuranceSecondsLeft = secondsLeft(blackjackState?.insuranceEndsAt, now)
  const turnSecondsLeft = secondsLeft(blackjackState?.turnEndsAt, now)
  const nextRoundSecondsLeft = secondsLeft(blackjackState?.nextRoundStartsAt, now)
  const countdown = blackjackState?.bettingEndsAt
    ? { label: 'BETS CLOSE', value: bettingSecondsLeft }
    : blackjackState?.insuranceEndsAt
      ? { label: 'INSURANCE', value: insuranceSecondsLeft }
      : blackjackState?.turnEndsAt
        ? { label: 'TURN', value: turnSecondsLeft }
        : blackjackState?.nextRoundStartsAt
          ? { label: 'NEXT ROUND', value: nextRoundSecondsLeft }
          : null
  const dealerUpcard = blackjackState?.dealerCards[0] ?? null
  const insuranceAmount = activeHand ? Math.floor(activeHand.bet / 2) : 0
  const canBuyInsurance = Boolean(
    blackjackState?.phase === 'insurance' &&
    dealerUpcard?.rank === 'A' &&
    me &&
    activeHand?.status === 'playing' &&
    insuranceAmount > 0 &&
    (me.insuranceBet ?? 0) <= 0 &&
    me.stack >= insuranceAmount
  )
  const lastWin = blackjackState?.phase === 'settled' && me && me.lastNet > 0 ? me.lastNet : 0
  const historyWins = sessionHistory.filter((item) => item.type === 'win').length
  const historyLosses = sessionHistory.filter((item) => item.type === 'lose').length
  const historyPushes = sessionHistory.filter((item) => item.type === 'push').length
  const dealerLine = blackjackState?.message ?? ''
  const visibleDealerLine = showDealerLine ? dealerLine : ''
  const displayedDealerLine = dealerSwitchLine || visibleDealerLine
  const tablePrompt = waitingMe
    ? canSitAtSeat
      ? 'Tap a vacant seat to sit down'
      : 'Table is full. Watching this round.'
    : blackjackState?.phase === 'insurance'
      ? me?.insuranceBet
        ? `Insurance placed: ${money(me.insuranceBet)}`
        : 'Dealer shows ace. Insurance is open.'
      : needsTableBuyIn
        ? 'Buy in to continue playing.'
      : canBet
        ? 'Tap a chip to place your bet'
        : 'Waiting for the next round.'
  const displayMessage = tableMessage(leaveError || lastError || bustedInfo?.message || tablePrompt)
  const bgmVolume = Math.round(musicVol * 100)
  const sfxVolume = Math.round(sfxVol * 100)
  const bgmEffectivelyMuted = musicMute || bgmVolume === 0
  const sfxEffectivelyMuted = sfxMute || sfxVolume === 0
  const canTipDealer = Boolean(me && me.stack >= BLACKJACK_DEALER_TIP_AMOUNT && !tipLoading)
  const dealerCanSwitch = !blackjackState || !isRoundLocked

  useEffect(() => {
    if (!blackjackState?.bettingEndsAt && !blackjackState?.insuranceEndsAt && !blackjackState?.turnEndsAt && !blackjackState?.nextRoundStartsAt) return

    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(interval)
  }, [blackjackState?.bettingEndsAt, blackjackState?.insuranceEndsAt, blackjackState?.turnEndsAt, blackjackState?.nextRoundStartsAt])

  useEffect(() => {
    if (!blackjackState) return
    setRebuyAmount((amount) => clampIntegerValue(amount, blackjackState.minBuyin, blackjackState.maxBuyin))
  }, [blackjackState?.maxBuyin, blackjackState?.minBuyin])

  useEffect(() => {
    setSessionHistory([])
    recordedRoundRef.current = null
    seenBlackjackCelebrationsRef.current.clear()
  }, [tableId])

  useEffect(() => {
    const syncDealer = () => {
      const nextDealer = dealerForTime(Date.now())
      if (activeDealerRef.current.id !== nextDealer.id) {
        setPendingDealer(nextDealer)
      }
    }

    syncDealer()
    const interval = window.setInterval(syncDealer, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    activeDealerRef.current = activeDealer
  }, [activeDealer])

  useEffect(() => {
    if (!pendingDealer || !dealerCanSwitch || dealerTransitionState !== 'stable') return

    const previousDealer = activeDealerRef.current
    if (previousDealer.id === pendingDealer.id) {
      setPendingDealer(null)
      return
    }

    dealerSwitchTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout))
    dealerSwitchTimeoutsRef.current = []

    setDealerPortrait('normal')
    setDealerTransitionState('leaving')
    setDealerSwitchLine(dealerThankLine(previousDealer, blackjackState?.dealerTips?.[previousDealer.id] ?? 0))

    dealerSwitchTimeoutsRef.current = [
      window.setTimeout(() => {
        setDealerSwitchLine('')
        setDealerTransitionState('away')
      }, DEALER_SWITCH_THANK_MS),
      window.setTimeout(() => {
        setActiveDealer(pendingDealer)
        setPendingDealer(null)
        setDealerPortrait('normal')
        setDealerTransitionState('arriving')
        setDealerSwitchLine(dealerIntroLine(pendingDealer))
      }, DEALER_SWITCH_THANK_MS + DEALER_SWITCH_GAP_MS),
      window.setTimeout(() => {
        setDealerSwitchLine('')
        setDealerTransitionState('stable')
      }, DEALER_SWITCH_THANK_MS + DEALER_SWITCH_GAP_MS + DEALER_SWITCH_INTRO_MS),
    ]
  }, [blackjackState?.dealerTips, dealerCanSwitch, dealerTransitionState, pendingDealer])

  useEffect(() => {
    setDealerPortrait('normal')
    if (!tipVisible) setTipImage(activeDealer.thankYou.normal)
  }, [activeDealer, tipVisible])

  useEffect(() => {
    return () => {
      if (chipAnimationTimeoutRef.current) window.clearTimeout(chipAnimationTimeoutRef.current)
      if (blackjackCelebrationTimeoutRef.current) window.clearTimeout(blackjackCelebrationTimeoutRef.current)
      tipTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout))
      tipTimeoutsRef.current = []
      dealerSwitchTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout))
      dealerSwitchTimeoutsRef.current = []
    }
  }, [])

  useEffect(() => {
    if (!blackjackState) return

    const nextCelebration = blackjackCelebrationForState(blackjackState)
    if (!nextCelebration || seenBlackjackCelebrationsRef.current.has(nextCelebration.key)) return

    seenBlackjackCelebrationsRef.current.add(nextCelebration.key)
    if (blackjackCelebrationTimeoutRef.current) window.clearTimeout(blackjackCelebrationTimeoutRef.current)

    setBlackjackCelebration({ ...nextCelebration, id: Date.now() })
    blackjackCelebrationTimeoutRef.current = window.setTimeout(() => {
      setBlackjackCelebration(null)
      blackjackCelebrationTimeoutRef.current = null
    }, BLACKJACK_CELEBRATION_MS)
  }, [blackjackState])

  useEffect(() => {
    if (!blackjackState) return

    setShowDealerLine(true)
    if (PERSISTENT_DEALER_LINES.has(blackjackState.message)) return

    const timeout = window.setTimeout(() => setShowDealerLine(false), TRANSIENT_DEALER_LINE_MS)
    return () => window.clearTimeout(timeout)
  }, [blackjackState?.message, blackjackState?.messageUpdatedAt])

  useEffect(() => {
    const src = dealerAudioForLine(displayedDealerLine, viewerName, isMyTurn)
    if (!src) return

    const voiceKey = dealerSwitchLine
      ? `switch:${dealerTransitionState}:${dealerSwitchLine}`
      : `table:${blackjackState?.messageUpdatedAt ?? 0}:${displayedDealerLine}`

    if (dealerVoiceKeyRef.current === voiceKey) return
    dealerVoiceKeyRef.current = voiceKey
    playDealerVoice(src)
  }, [blackjackState?.messageUpdatedAt, dealerSwitchLine, dealerTransitionState, displayedDealerLine, isMyTurn, playDealerVoice, viewerName])

  useEffect(() => {
    if (!blackjackState || !me || blackjackState.phase !== 'settled' || !me.lastResult) return
    if (recordedRoundRef.current === blackjackState.roundNumber) return

    recordedRoundRef.current = blackjackState.roundNumber
    setSessionHistory((prev) => [
      {
        round: blackjackState.roundNumber,
        label: me.lastResult,
        net: me.lastNet,
        detail: `Round ${blackjackState.roundNumber}`,
        type: historyTypeFromNet(me.lastNet, me.lastResult),
      },
      ...prev,
    ].slice(0, 12))
  }, [blackjackState, me])

  useEffect(() => {
    if (!blackjackState) return

    const roundKey = `${blackjackState.tableId}:${blackjackState.roundNumber}`
    const visibleCardCount = blackjackState.dealerCards.length + blackjackState.players.reduce((playerTotal, player) => (
      playerTotal + player.hands.reduce((handTotal, hand) => handTotal + (hand.cardCount ?? hand.cards.length), 0)
    ), 0)

    const previous = blackjackSfxRef.current
    if (previous.roundKey !== roundKey) {
      if ((blackjackState.phase === 'playing' || blackjackState.phase === 'insurance') && visibleCardCount > 0) {
        playSfx('deal')
      }
      blackjackSfxRef.current = { roundKey, cardCount: visibleCardCount, resultKey: previous.resultKey }
      return
    }

    if ((blackjackState.phase === 'playing' || blackjackState.phase === 'insurance') && visibleCardCount > previous.cardCount) {
      playSfx('deal')
    }

    previous.cardCount = visibleCardCount
  }, [blackjackState, playSfx])

  useEffect(() => {
    if (!blackjackState || !me || blackjackState.phase !== 'settled' || !me.lastResult) return

    const resultKey = `${blackjackState.tableId}:${blackjackState.roundNumber}:${me.lastResult}:${me.lastNet}`
    if (blackjackSfxRef.current.resultKey === resultKey) return

    blackjackSfxRef.current.resultKey = resultKey
    if (me.lastNet > 0) playSfx('win')
    else if (me.lastNet < 0) playSfx('lose')
    else playSfx('click')
  }, [blackjackState, me, playSfx])

  useEffect(() => {
    let blinkTimer: number | undefined
    let blinkRestoreTimer: number | undefined
    let smileTimer: number | undefined
    let smiling = false

    const syncPortrait = () => setDealerPortrait(smiling ? 'smiling' : 'normal')

    const scheduleBlink = () => {
      blinkTimer = window.setTimeout(() => {
        setDealerPortrait('blinking')
        blinkRestoreTimer = window.setTimeout(() => {
          syncPortrait()
          scheduleBlink()
        }, randomMs(BLINK_DURATION_RANGE_MS))
      }, randomMs(BLINK_DELAY_RANGE_MS))
    }

    const scheduleSmile = () => {
      smileTimer = window.setTimeout(() => {
        smiling = !smiling
        syncPortrait()
        scheduleSmile()
      }, randomMs(SMILE_SWITCH_RANGE_MS))
    }

    scheduleBlink()
    scheduleSmile()

    return () => {
      if (blinkTimer) window.clearTimeout(blinkTimer)
      if (blinkRestoreTimer) window.clearTimeout(blinkRestoreTimer)
      if (smileTimer) window.clearTimeout(smileTimer)
    }
  }, [])

  const handleBgmToggle = () => {
    if (musicMute || musicVol === 0) {
      setMusicVol(0.7)
      if (musicMute) toggleMusic()
      return
    }

    toggleMusic()
  }

  const handleSfxToggle = () => {
    if (sfxMute || sfxVol === 0) {
      setSfxVol(0.6)
      if (sfxMute) toggleSfx()
      return
    }

    toggleSfx()
  }

  const handleBgmVolumeChange = (nextVolume: number) => {
    setMusicVol(nextVolume / 100)
    if (nextVolume > 0 && musicMute) toggleMusic()
  }

  const handleSfxVolumeChange = (nextVolume: number) => {
    setSfxVol(nextVolume / 100)
    if (nextVolume > 0 && sfxMute) toggleSfx()
  }

  const handleChip = async (amount: number) => {
    setSelectedChip(amount)
    if (canBet && me && me.stack >= amount && me.bet + amount <= blackjackState.maxBet) {
      if (chipAnimationTimeoutRef.current) window.clearTimeout(chipAnimationTimeoutRef.current)
      setChipAnimation({ id: Date.now(), value: amount })
      chipAnimationTimeoutRef.current = window.setTimeout(() => setChipAnimation(null), 520)
      const result = await placeBet(amount)
      if (!result.error) playSfx('raise')
    }
  }

  const handleSitOut = async () => {
    clearLastError()
    const result = await sitOut()
    if (!result.error) playSfx('sitStand')
  }

  const handleSitIn = async (seat?: number) => {
    clearLastError()
    const result = await sitIn(seat)
    if (!result.error) playSfx('sitStand')
  }

  const handleClearBet = async () => {
    const result = await clearBet()
    if (!result.error) playSfx('click')
  }

  const handleBlackjackAction = async (action: BlackjackAction) => {
    const result = await sendAction(action)
    if (result.error) return

    if (action === 'hit') playSfx('deal')
    else if (action === 'double') playSfx('raise')
    else if (action === 'surrender') playSfx('fold')
    else playSfx('click')
  }

  const handleInsurance = async () => {
    clearLastError()
    const result = await buyInsurance()
    if (!result.error) playSfx('click')
  }

  const clearTipTimers = () => {
    tipTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout))
    tipTimeoutsRef.current = []
  }

  const handleTip = async () => {
    clearTipTimers()
    clearLastError()
    setTipVisible(false)

    if (!canTipDealer) return

    setTipLoading(true)
    const result = await tipDealer(BLACKJACK_DEALER_TIP_AMOUNT, activeDealer.id, activeDealer.name)
    setTipLoading(false)
    if (result.error) return

    playSfx('click')
    setTipImage(activeDealer.thankYou.normal)
    setTipVisible(true)
    tipTimeoutsRef.current = [
      window.setTimeout(() => setTipImage(activeDealer.thankYou.wink), 280),
      window.setTimeout(() => setTipImage(activeDealer.thankYou.normal), 620),
      window.setTimeout(() => setTipVisible(false), 1900),
    ]
  }

  const leaveTable = useCallback(() => {
    if (!socket) {
      setLeaveError('Leave failed. Please try again.')
      return
    }

    const confirmed = window.confirm('Cash out and leave this blackjack table?')
    if (!confirmed) return

    setLeaving(true)
    setLeaveError('')

    const timeout = window.setTimeout(() => {
      setLeaving(false)
      setLeaveError('Leave timed out. Please try again.')
    }, 15000)

    socket.emit('blackjack_leave_table', { tableId }, (res?: { balance?: number; error?: string }) => {
      window.clearTimeout(timeout)
      setLeaving(false)

      if (res?.error) {
        setLeaveError(res.error)
        return
      }

      if (res?.balance !== undefined) setAccountBalance(res.balance)
      playSfx('joinLeave')
      router.push('/blackjack')
    })
  }, [socket, tableId, playSfx, router])

  const handleRebuy = async () => {
    if (!blackjackState) return
    setRebuyLoading(true)
    clearLastError()

    const amount = clampIntegerValue(rebuyAmount, blackjackState.minBuyin, blackjackState.maxBuyin)
    setRebuyAmount(amount)
    const res = await rebuy(amount)
    if (res.balance !== undefined) setAccountBalance(res.balance)
    if (!res.error) {
      setSettingsOpen(false)
      clearBusted()
      playSfx('raise')
    }

    setRebuyLoading(false)
  }

  if (socketError || tableError) {
    const errorMessage = tableMessage(tableError ?? `Connection error: ${socketError}`)

    return (
      <>
        <link rel="stylesheet" href={BLACKJACK_STYLESHEET} />
        <main className="game-shell">
          <header className="topbar">
            <section className="balance-panel">
              <span>BALANCE</span>
              <strong id="balance">{money(accountBalance)}</strong>
            </section>
          </header>

          <section className="table-frame">
            <aside className="session-history" id="sessionHistory" aria-label="Session win and loss history">
              <header>
                <div className="history-heading">
                  <span>SESSION</span>
                  <strong>HISTORY</strong>
                </div>
              </header>
              <div className="history-summary" aria-label="Session totals">
                <span id="historyWins">0 W</span>
                <span id="historyLosses">0 L</span>
                <span id="historyPushes">0 P</span>
              </div>
              <ol className="history-list" id="sessionHistoryList">
                <li className="history-empty">No rounds yet</li>
              </ol>
            </aside>

            <div className="wood-rail">
              <img id="dealerPortrait" className="dealer-portrait" src={activeDealer.portraits.normal} alt="" aria-hidden="true" />
              <div className="dealer-speech" id="dealerSpeech" aria-live="polite">
                {errorMessage}
              </div>
              <div className="felt-table">
                <img className="table-logo" src="/blackjack/Images/Table/table%20logo.png" alt="" aria-hidden="true" />
                <section className="hand-area dealer-area" aria-label="Dealer hand">
                  <h2>DEALER</h2>
                  <div className="cards" id="dealerCards" />
                  <div className="score-pill" id="dealerScore" hidden>0</div>
                </section>
                <section className="hand-area player-area" aria-label="Player hand">
                  <div className="score-pill" id="playerScore" hidden>0</div>
                  <div className="cards" id="playerCards" />
                </section>
                <div className="bet-spots" id="betSpots" aria-label="Table betting circles">
                  {Array.from({ length: SEAT_COUNT }, (_, index) => (
                    <button key={index} type="button" className={classNames('bet-spot', `bet-spot-${index + 1}`, 'is-vacant')} disabled>
                      <span className="spot-label">VACANT</span>
                      <span className="spot-total" hidden>$0</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="bottom-console">
            <div className="message" id="message">
              {errorMessage}
            </div>
            <aside className="round-info" aria-label="Round totals">
              <span>CURRENT BET</span>
              <strong id="currentBet">$0</strong>
              <div />
              <span>WIN</span>
              <strong id="winAmount">$0</strong>
            </aside>
            <div className="chip-selector" id="chipRow">
              {CHIP_VALUES.map((value) => (
                <button key={value} type="button" className={`chip chip-${value}`} disabled aria-label={`${money(value)} chip`}>
                  <span>{value}</span>
                </button>
              ))}
            </div>
            <div className="action-row">
              <button type="button" id="newRoundBtn" className="primary action-button" onClick={() => router.push('/blackjack')}>
                <b>Back</b>
                <span>BACK</span>
              </button>
            </div>
          </section>
        </main>
      </>
    )
  }

  if (!connected || !blackjackState) {
    return (
      <main className="game-shell">
        <link rel="stylesheet" href={BLACKJACK_STYLESHEET} />
        <section className="table-frame">
          <div className="wood-rail">
            <img className="dealer-portrait" src={activeDealer.portraits.normal} alt="" aria-hidden="true" />
            <div className="dealer-speech">Connecting to table...</div>
            <div className="felt-table">
              <img className="table-logo" src="/blackjack/Images/Table/table%20logo.png" alt="" aria-hidden="true" />
            </div>
          </div>
        </section>
        <section className="bottom-console">
          <div className="message">Loading blackjack table...</div>
        </section>
      </main>
    )
  }

  return (
    <>
      <link rel="stylesheet" href={BLACKJACK_STYLESHEET} />

      <main className="game-shell">
        {blackjackCelebration && <BlackjackCelebrationEffect celebration={blackjackCelebration} />}

        <header className="topbar">
          <section className="balance-panel">
            <span>BALANCE</span>
            <strong id="balance">{money(me?.stack ?? accountBalance)}</strong>
          </section>
          <nav className="utility-buttons" aria-label="Game options">
            <div className="audio-control">
              <button
                type="button"
                className={classNames(
                  'utility-button audio-toggle',
                  bgmEffectivelyMuted && 'is-muted',
                  !bgmEffectivelyMuted && bgmVolume > 0 && bgmVolume < 35 && 'is-low'
                )}
                id="audioToggle"
                aria-label={bgmEffectivelyMuted ? 'Unmute BGM' : `Mute BGM. Volume ${bgmVolume}%`}
                aria-pressed={bgmEffectivelyMuted}
                aria-expanded="false"
                aria-controls="audioPanel"
                onClick={handleBgmToggle}
              >
                <span id="audioIcon" className="utility-label" aria-hidden="true">Audio</span>
              </button>
              <div className="audio-panel" id="audioPanel" role="group" aria-label="Volume controls">
                <div className="audio-panel-row">
                  <label className="volume-label" htmlFor="bgmQuickVolumeSlider">
                    <span>BGM</span>
                    <strong>{bgmEffectivelyMuted ? 'OFF' : `${bgmVolume}%`}</strong>
                  </label>
                  <input
                    type="range"
                    id="bgmQuickVolumeSlider"
                    min="0"
                    max="100"
                    value={bgmVolume}
                    onChange={(event) => handleBgmVolumeChange(Number(event.target.value))}
                  />
                  <button type="button" className={classNames('quick-sound-mute', bgmEffectivelyMuted && 'is-muted')} onClick={handleBgmToggle}>
                    {bgmEffectivelyMuted ? 'BGM Off' : 'BGM On'}
                  </button>
                </div>
                <div className="audio-panel-row">
                  <label className="volume-label" htmlFor="sfxQuickVolumeSlider">
                    <span>SFX</span>
                    <strong>{sfxEffectivelyMuted ? 'OFF' : `${sfxVolume}%`}</strong>
                  </label>
                  <input
                    type="range"
                    id="sfxQuickVolumeSlider"
                    min="0"
                    max="100"
                    value={sfxVolume}
                    onChange={(event) => handleSfxVolumeChange(Number(event.target.value))}
                  />
                  <button type="button" className={classNames('quick-sound-mute', sfxEffectivelyMuted && 'is-muted')} onClick={handleSfxToggle}>
                    {sfxEffectivelyMuted ? 'SFX Off' : 'SFX On'}
                  </button>
                </div>
              </div>
            </div>
            <button type="button" className="utility-button" id="helpBtn" aria-label="Help" onClick={() => setRulesOpen(true)}>
              <span className="utility-label" aria-hidden="true">Help</span>
            </button>
          </nav>
        </header>

        <section className="table-frame">
          <aside
            className={classNames('session-history', !historyOpen && 'is-collapsed')}
            id="sessionHistory"
            aria-label="Session win and loss history"
          >
            <header>
              <div className="history-heading">
                <span>SESSION</span>
                <strong>HISTORY</strong>
              </div>
              <button
                type="button"
                className={classNames('history-toggle', !historyOpen && 'is-collapsed')}
                id="historyToggleBtn"
                aria-label={historyOpen ? 'Hide history details' : 'Show history details'}
                aria-expanded={historyOpen}
                aria-controls="sessionHistoryList"
                onClick={() => setHistoryOpen((open) => !open)}
              >
                <span aria-hidden="true" />
              </button>
            </header>
            <div className="history-summary" aria-label="Session totals">
              <span id="historyWins">{historyWins} W</span>
              <span id="historyLosses">{historyLosses} L</span>
              <span id="historyPushes">{historyPushes} P</span>
            </div>
            <ol className="history-list" id="sessionHistoryList" hidden={!historyOpen}>
              {sessionHistory.length === 0 ? (
                <li className="history-empty">No rounds yet</li>
              ) : (
                sessionHistory.map((item) => (
                  <li key={item.round} className={`history-item is-${item.type}`}>
                    <div className="history-topline">
                      <span className="history-result">{item.label}</span>
                      <span className="history-amount">{signedMoney(item.net)}</span>
                    </div>
                    <div className="history-detail">{item.detail}</div>
                  </li>
                ))
              )}
            </ol>
          </aside>

          <div className="wood-rail">
            <img
              id="dealerPortrait"
              className={classNames('dealer-portrait', `is-${dealerTransitionState}`)}
              src={activeDealer.portraits[dealerPortrait]}
              alt=""
              aria-hidden="true"
            />
            <div className="dealer-speech" id="dealerSpeech" aria-live="polite" hidden={!displayedDealerLine}>{displayedDealerLine}</div>
            <DealerTipBoard rows={activeDealerTipRows} total={activeDealerTipTotal} />
            <div className="round-countdown" id="roundCountdown" aria-live="polite" hidden={!countdown}>
              <span>{countdown?.label ?? 'COUNTDOWN'}</span>
              <strong>{countdown?.value ?? 0}</strong>
            </div>
            <div className="felt-table">
              <img className="table-logo" src="/blackjack/Images/Table/table%20logo.png" alt="" aria-hidden="true" />

              <div className="tip-control table-tip-control">
                <button
                  type="button"
                  id="tipBtn"
                  className="tip-button action-button"
                  disabled={!canTipDealer}
                  onClick={handleTip}
                >
                  <b>TIP</b>
                  <span>TIP DEALER</span>
                </button>
                <div className={classNames('tip-popup', tipVisible && 'is-visible')} id="tipPopup" aria-hidden={!tipVisible}>
                  <img
                    src={tipImage}
                    alt=""
                    aria-hidden="true"
                    onError={(event) => {
                      event.currentTarget.src = activeDealer.thankYou.normal
                    }}
                  />
                  <span>Thank you for the tip!</span>
                </div>
              </div>

              <section className="hand-area dealer-area" aria-label="Dealer hand">
                <h2>DEALER</h2>
                <div className="cards" id="dealerCards">
                  {blackjackState.dealerCards.map((card, index) => <Card key={`dealer-${index}`} card={card} />)}
                </div>
                <div className="score-pill" id="dealerScore" hidden={blackjackState.dealerCards.length === 0}>
                  {blackjackState.dealerCards.length === 0 ? 0 : blackjackState.dealerScore ?? '?'}
                </div>
              </section>

              <section className="hand-area player-area" aria-label="Player hand">
                <div
                  className={classNames('score-pill', playerHands.length > 1 && 'is-split-score')}
                  id="playerScore"
                  hidden={!playerHands.some(handHasCards)}
                >
                  {activeHand ? handScore(activeHand) : 0}
                </div>
                <div className={classNames('cards', playerHands.length > 1 && 'split-layout')} id="playerCards">
                  {playerHands.length > 1 ? (
                    playerHands.map((hand, index) => (
                      <SplitHand
                        key={index}
                        hand={hand}
                        index={index}
                        active={Boolean(me?.isCurrentTurn && index === me.activeHandIndex)}
                      />
                    ))
                  ) : (
                    activeHand?.cards.map((card, index) => <Card key={`player-${index}`} card={card} />)
                  )}
                </div>
              </section>

              <div className="bet-spots" id="betSpots" aria-label="Table betting circles">
                {Array.from({ length: SEAT_COUNT }, (_, index) => {
                  const player = visualSeatPlayers[index]
                  return (
                    <BetSpot
                      key={index}
                      index={index}
                      player={player}
                      isMe={player?.playerId === blackjackState.myPlayerId}
                      placingChip={player?.playerId === blackjackState.myPlayerId ? chipAnimation : null}
                      onClick={() => {
                        if (player?.playerId === blackjackState.myPlayerId && canBet) handleChip(selectedChip)
                        if (!player && canSitAtSeat) void handleSitIn(index)
                      }}
                      canSit={canSitAtSeat}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <div
          className="blackjack-chat-panel"
          style={{
            position: 'absolute',
            right: 20,
            top: 254,
            zIndex: 8,
            width: 320,
            pointerEvents: 'auto',
          }}
        >
          <BlackjackChatPanel
            messages={chatMessages}
            onSend={(text) => { void sendChat(text) }}
            myPlayerId={blackjackState.myPlayerId}
            hasVipEmojis={false}
          />
          <div className="chat-seat-controls" aria-label="Table seating controls">
            {me && (
              <button
                type="button"
                className="table-status-button"
                disabled={isRoundLocked && playerHands.length > 0}
                onClick={handleSitOut}
              >
                Stand
              </button>
            )}
            {waitingMe && (
              <button
                type="button"
                className="table-status-button"
                disabled={blackjackState.players.length >= blackjackState.maxPlayers}
                onClick={() => handleSitIn()}
              >
                Sit
              </button>
            )}
            <button
              type="button"
              className="table-status-button is-cashout"
              disabled={leaving}
              aria-label={leaving ? 'Leaving table' : 'Cash out and leave table'}
              title={leaving ? 'Leaving table' : 'Cash out'}
              onClick={leaveTable}
            >
              <ExitIcon className="cashout-icon" />
            </button>
          </div>
        </div>

        <div className="blackjack-mobile-seat-controls" aria-label="Mobile table seating controls">
          {me && (
            <button
              type="button"
              className="table-status-button"
              disabled={isRoundLocked && playerHands.length > 0}
              onClick={handleSitOut}
            >
              Stand
            </button>
          )}
          {waitingMe && (
            <button
              type="button"
              className="table-status-button"
              disabled={blackjackState.players.length >= blackjackState.maxPlayers}
              onClick={() => handleSitIn()}
            >
              Sit
            </button>
          )}
          <button
            type="button"
            className="table-status-button is-cashout"
            disabled={leaving}
            aria-label={leaving ? 'Leaving table' : 'Cash out and leave table'}
            title={leaving ? 'Leaving table' : 'Cash out'}
            onClick={leaveTable}
          >
            <ExitIcon className="cashout-icon" />
          </button>
        </div>

        <div className="blackjack-mobile-chat-panel">
          <ChatBox
            messages={chatMessages}
            onSend={(text) => { void sendChat(text) }}
            myPlayerId={blackjackState.myPlayerId}
            hasVipEmojis={false}
            initialCollapsed
          />
        </div>

        <section className="bottom-console">
          <div className="message" id="message">{displayMessage}</div>

          <aside className="round-info" aria-label="Round totals">
            <span>CURRENT BET</span>
            <strong id="currentBet">{money(currentBet)}</strong>
            <div />
            <span>WIN</span>
            <strong id="winAmount">{signedMoney(lastWin)}</strong>
          </aside>

          {needsTableBuyIn ? (
            <div className="rebuy-panel" id="rebuyPanel" aria-label="Buy in to the blackjack table">
              <div className="rebuy-copy">
                <span>TABLE STACK</span>
                <strong>Buy in to continue</strong>
              </div>
              <label className="rebuy-amount" htmlFor="rebuyAmountInput">
                <span>BUY-IN</span>
                <input
                  id="rebuyAmountInput"
                  type="number"
                  min={tableMinBuyin}
                  max={tableMaxBuyin}
                  step={100}
                  value={rebuyAmount}
                  onChange={(event) => {
                    setRebuyAmount(clampIntegerValue(Number(event.target.value), tableMinBuyin, tableMaxBuyin))
                  }}
                />
              </label>
              <button
                type="button"
                className="rebuy-submit"
                disabled={rebuyLoading}
                onClick={handleRebuy}
              >
                {rebuyLoading ? 'Buying In' : `Buy In ${money(normalizedRebuyAmount)}`}
              </button>
            </div>
          ) : (
            <div className="chip-selector" id="chipRow">
              {CHIP_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={classNames('chip', `chip-${value}`, selectedChip === value && 'active')}
                  data-value={value}
                  aria-label={`${money(value)} chip`}
                  disabled={!canBet || !me || me.stack < value || me.bet + value > blackjackState.maxBet}
                  onClick={() => handleChip(value)}
                >
                  <span>{value}</span>
                </button>
              ))}
            </div>
          )}

          <div className="action-row">
            <button type="button" id="undoBtn" className="secondary action-button" disabled={!canBet || !me || me.bet <= 0} onClick={handleClearBet}>
              <b>Undo</b>
              <span>UNDO</span>
            </button>
            <button type="button" id="clearBtn" className="secondary action-button" disabled={!canBet || !me || me.bet <= 0} onClick={handleClearBet}>
              <b>X</b>
              <span>CLEAR BET</span>
            </button>
            {(['hit', 'stand', 'double', 'split'] as BlackjackAction[]).map((action) => (
              <button
                key={action}
                type="button"
                id={`${action}Btn`}
                className="action-button"
                disabled={!isMyTurn || !blackjackState.validActions.includes(action)}
                onClick={() => handleBlackjackAction(action)}
              >
                <b>{ACTION_LABELS[action]}</b>
                <span>{ACTION_LABELS[action]}</span>
              </button>
            ))}
            <button
              type="button"
              id="insuranceBtn"
              className="insurance-button action-button"
              disabled={!canBuyInsurance}
              onClick={handleInsurance}
            >
              <b>{blackjackState.phase === 'insurance' && insuranceAmount > 0 ? money(insuranceAmount) : 'INS'}</b>
              <span>INSURANCE</span>
            </button>
            <button
              type="button"
              id="surrenderBtn"
              className="action-button"
              disabled={!isMyTurn || !blackjackState.validActions.includes('surrender')}
              onClick={() => handleBlackjackAction('surrender')}
            >
              <b>1/2</b>
              <span>SURRENDER</span>
            </button>
          </div>
        </section>
      </main>

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />

      <section className="settings-modal" id="settingsModal" role="dialog" aria-modal="true" aria-labelledby="settingsTitle" hidden={!settingsOpen}>
        <div className="settings-backdrop" data-settings-close onClick={() => setSettingsOpen(false)} />
        <article className="settings-panel" tabIndex={-1}>
          <header className="settings-header">
            <div>
              <span>AUDIO MIXER</span>
              <h2 id="settingsTitle">Sound Settings</h2>
            </div>
            <button type="button" className="settings-close" id="settingsCloseBtn" aria-label="Close settings" onClick={() => setSettingsOpen(false)}>
              X
            </button>
          </header>

          <div className="settings-content">
            <section className="settings-channel" aria-labelledby="bgmSettingsTitle">
              <div className="settings-channel-head">
                <div>
                  <h3 id="bgmSettingsTitle">BGM</h3>
                  <p>Background music</p>
                </div>
                <button
                  type="button"
                  className={classNames('sound-mute', bgmEffectivelyMuted && 'is-muted')}
                  id="bgmMuteBtn"
                  aria-pressed={bgmEffectivelyMuted}
                  onClick={handleBgmToggle}
                >
                  {bgmEffectivelyMuted ? 'Unmute' : 'Mute'}
                </button>
              </div>
              <label className="settings-slider-label" htmlFor="bgmVolumeSlider">
                <span>Volume</span>
                <strong id="bgmVolumeValue">{bgmVolume}%</strong>
              </label>
              <input
                className="settings-slider"
                type="range"
                id="bgmVolumeSlider"
                min="0"
                max="100"
                value={bgmVolume}
                onChange={(event) => handleBgmVolumeChange(Number(event.target.value))}
              />
            </section>

            <section className="settings-channel" aria-labelledby="sfxSettingsTitle">
              <div className="settings-channel-head">
                <div>
                  <h3 id="sfxSettingsTitle">SFX</h3>
                  <p>Cards, chips, and table sounds</p>
                </div>
                <button
                  type="button"
                  className={classNames('sound-mute', sfxEffectivelyMuted && 'is-muted')}
                  id="sfxMuteBtn"
                  aria-pressed={sfxEffectivelyMuted}
                  onClick={handleSfxToggle}
                >
                  {sfxEffectivelyMuted ? 'Unmute' : 'Mute'}
                </button>
              </div>
              <label className="settings-slider-label" htmlFor="sfxVolumeSlider">
                <span>Volume</span>
                <strong id="sfxVolumeValue">{sfxVolume}%</strong>
              </label>
              <input
                className="settings-slider"
                type="range"
                id="sfxVolumeSlider"
                min="0"
                max="100"
                value={sfxVolume}
                onChange={(event) => handleSfxVolumeChange(Number(event.target.value))}
              />
            </section>
          </div>
        </article>
      </section>
    </>
  )
}

function Card({ card }: { card: BlackjackCard | null }) {
  if (!card) return <div className="card back" aria-label="Face down card" />

  const isRed = card.suit === 'H' || card.suit === 'D'

  return (
    <div className={classNames('card', isRed && 'red')}>
      <span className="rank">{card.rank}</span>
      <span className="suit">{SUIT_SYMBOLS[card.suit]}</span>
      <span className="rank bottom">{card.rank}</span>
    </div>
  )
}

function SplitHand({ hand, index, active }: { hand: ClientBlackjackHand; index: number; active: boolean }) {
  return (
    <div className={classNames('split-hand', active && 'active', hand.status !== 'playing' && 'complete')}>
      <div className="split-hand-label">HAND {index + 1}</div>
      <div className="split-hand-cards">
        {hand.cards.map((card, cardIndex) => <Card key={cardIndex} card={card} />)}
      </div>
      <div className="split-hand-score">{handScore(hand)}</div>
    </div>
  )
}

function DealerTipBoard({
  rows,
  total,
}: {
  rows: Array<{ id: string; name: string; total: number; active: boolean }>
  total: number
}) {
  return (
    <aside className="dealer-tip-board" aria-label="Dealer tip ranking">
      <header className="dealer-tip-board__header">
        <span>Dealer Support</span>
        <strong>{money(total)}</strong>
      </header>
      <ol className="dealer-tip-board__list">
        {rows.map((row, index) => (
          <li key={row.id} className={classNames('dealer-tip-row', row.active && 'is-active', index === 0 && 'is-leading')}>
            <span className="dealer-tip-row__rank">{String(index + 1).padStart(2, '0')}</span>
            <span className="dealer-tip-row__name">Dealer {row.name}</span>
            <span className="dealer-tip-row__label">Total Tip Received</span>
            <strong>{money(row.total)}</strong>
          </li>
        ))}
      </ol>
    </aside>
  )
}

function BlackjackCelebrationEffect({ celebration }: { celebration: BlackjackCelebration }) {
  const ownerLabel = celebration.target === 'dealer' ? 'Dealer' : celebration.name

  return (
    <div
      key={celebration.id}
      className={classNames('blackjack-celebration', `is-${celebration.target}`)}
      aria-live="polite"
      aria-label={`${ownerLabel} blackjack`}
    >
      <div className="blackjack-celebration-stage">
        <div className="blackjack-celebration-cards" aria-hidden="true">
          <div className="blackjack-celebration-card is-ace">
            <span>A</span>
            <strong>{SUIT_SYMBOLS.S}</strong>
            <span>A</span>
          </div>
          <div className="blackjack-celebration-card is-face">
            <span>K</span>
            <strong>{SUIT_SYMBOLS.H}</strong>
            <span>K</span>
          </div>
        </div>

        <div className="blackjack-celebration-copy">
          <span>{ownerLabel}</span>
          <strong>BLACKJACK</strong>
        </div>

        {BLACKJACK_CELEBRATION_SPARKS.map(([x, y, delay], index) => (
          <span
            key={`spark-${index}`}
            className="blackjack-celebration-spark"
            style={{
              '--spark-x': x,
              '--spark-y': y,
              '--spark-delay': delay,
            } as CSSProperties}
          />
        ))}

        {BLACKJACK_CELEBRATION_CHIPS.map((chip, index) => (
          <span
            key={`chip-${chip.value}-${index}`}
            className="blackjack-celebration-chip"
            style={{
              '--celebration-chip-image': `url("/blackjack/Images/Chips/${chip.value}.png")`,
              '--celebration-chip-x': chip.x,
              '--celebration-chip-y': chip.y,
              '--celebration-chip-rotation': chip.rotation,
              '--celebration-chip-delay': chip.delay,
            } as CSSProperties}
          />
        ))}
      </div>
    </div>
  )
}

function BlackjackChatPanel({
  messages,
  onSend,
  myPlayerId,
  hasVipEmojis,
  initialCollapsed = false,
}: {
  messages: ChatMessage[]
  onSend: (text: string) => void
  myPlayerId: string
  hasVipEmojis: boolean
  initialCollapsed?: boolean
}) {
  const [input, setInput] = useState('')
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const [showEmojiTray, setShowEmojiTray] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (collapsed) setShowEmojiTray(false)
  }, [collapsed])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    onSend(text)
    setInput('')
    setShowEmojiTray(false)
  }

  const appendEmoji = (emojiCode: string) => {
    setInput((current) => appendChatEmojiCode(current, emojiCode, MAX_CHAT_LENGTH))
    setShowEmojiTray(false)
  }

  return (
    <section className={classNames('blackjack-chat', collapsed && 'is-collapsed')} aria-label="Table chat">
      <button type="button" className="blackjack-chat-header" onClick={() => setCollapsed((current) => !current)}>
        <span>TABLE CHAT</span>
        <strong>{collapsed ? 'SHOW' : 'HIDE'}</strong>
      </button>

      {!collapsed && (
        <>
          <div className="blackjack-chat-messages" aria-live="polite">
            {messages.length === 0 ? (
              <p className="blackjack-chat-empty">No messages yet</p>
            ) : (
              messages.map((message, index) => (
                message.isSystem ? (
                  <p key={`${message.playerId}-${index}`} className="blackjack-chat-line is-system">
                    <ChatMessageText text={message.text} size="sm" />
                  </p>
                ) : (
                  <p
                    key={`${message.playerId}-${index}`}
                    className={classNames('blackjack-chat-line', message.playerId === myPlayerId && 'is-own')}
                  >
                    <span className="blackjack-chat-name">{message.username}</span>
                    <ChatMessageText text={message.text} size="sm" />
                  </p>
                )
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {showEmojiTray && (
            <div className="blackjack-chat-emoji">
              <ChatEmojiTray hasVipAccess={hasVipEmojis} onSelect={appendEmoji} variant="table" />
            </div>
          )}

          <form
            className="blackjack-chat-compose"
            onSubmit={(event) => {
              event.preventDefault()
              handleSend()
            }}
          >
            <button
              type="button"
              className={classNames('blackjack-chat-emoji-button', showEmojiTray && 'is-active')}
              onClick={() => setShowEmojiTray((current) => !current)}
            >
              Emoji
            </button>
            <input
              type="text"
              value={input}
              maxLength={MAX_CHAT_LENGTH}
              placeholder="Type a message..."
              onChange={(event) => setInput(event.target.value)}
            />
            <button type="submit" className="blackjack-chat-send">Send</button>
          </form>
        </>
      )}
    </section>
  )
}

function BetSpot({
  index,
  player,
  isMe,
  placingChip,
  onClick,
  canSit,
}: {
  index: number
  player?: ClientBlackjackPlayer
  isMe: boolean
  placingChip?: ChipAnimation | null
  onClick: () => void
  canSit?: boolean
}) {
  const visualBet = player ? player.bet || player.hands.reduce((sum, hand) => sum + hand.bet, 0) : 0
  const hasBet = visualBet > 0
  const label = player ? player.username.toUpperCase() : 'VACANT'
  const otherPlayerScore = player && !isMe ? otherPlayerScoreLabel(player) : ''

  return (
    <button
      type="button"
      className={classNames(
        'bet-spot',
        `bet-spot-${index + 1}`,
        player ? 'is-active' : 'is-vacant',
        !player && canSit && 'can-sit',
        hasBet && 'has-bet'
      )}
      disabled={player ? !isMe : !canSit}
      onClick={onClick}
    >
      {hasBet && (
        <span className="spot-chip-stack" aria-hidden="true">
          {chipFacesForBet(visualBet).map((chip, chipIndex) => (
            <span
              key={`${chip}-${chipIndex}`}
              className={`spot-chip chip-face-${chip}`}
              style={{
                '--chip-x': `${CHIP_STACK_OFFSETS[chipIndex]?.[0] ?? 0}px`,
                '--chip-y': `${CHIP_STACK_OFFSETS[chipIndex]?.[1] ?? 0}px`,
                '--chip-rotation': `${CHIP_STACK_OFFSETS[chipIndex]?.[2] ?? 0}deg`,
              } as CSSProperties}
            />
          ))}
        </span>
      )}
      {placingChip && (
        <span
          key={placingChip.id}
          className="bet-chip-fly"
          aria-hidden="true"
          style={{ '--bet-chip-image': `url("/blackjack/Images/Chips/${placingChip.value}.png")` } as CSSProperties}
        />
      )}
      {!player && <span className="spot-label">VACANT</span>}
      {otherPlayerScore && (
        <span className="other-player-hand-preview" aria-label={`${player?.username} hand total ${otherPlayerScore}`}>
          <span className="other-player-card-back" aria-hidden="true" />
          <span className="other-player-score-pill">{otherPlayerScore}</span>
        </span>
      )}
      <span className="spot-total" hidden={!hasBet}>{hasBet ? money(visualBet) : '$0'}</span>
      {player && (
        <span
          className="blackjack-seat-player"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            top: 'calc(50% + 43px)',
            zIndex: 5,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            minWidth: '88px',
            pointerEvents: 'none',
            transform: 'translateX(-50%)',
            filter: 'drop-shadow(0 7px 9px rgba(0,0,0,.55))',
          }}
        >
          <AvatarDisplay avatarId={player.avatar ?? 'avatar_m1'} size="sm" className="!h-8 !w-8 !rounded-full !border-[#d6ad48]/70" />
          <span
            style={{
              maxWidth: '96px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              border: '1px solid rgba(214,173,72,.28)',
              borderRadius: '999px',
              background: 'rgba(3,12,8,.76)',
              color: 'var(--gold-light)',
              padding: '3px 7px 4px',
              fontFamily: 'var(--font-display)',
              fontSize: '.58rem',
              fontWeight: 800,
              letterSpacing: '.08em',
              lineHeight: 1,
              textTransform: 'uppercase',
            }}
          >
            {label}
          </span>
        </span>
      )}
    </button>
  )
}

function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <section className="rules-modal" id="rulesModal" role="dialog" aria-modal="true" aria-labelledby="rulesTitle" hidden={!open}>
      <div className="rules-backdrop" data-rules-close onClick={onClose} />
      <article className="rules-panel" tabIndex={-1}>
        <header className="rules-header">
          <div>
            <span>8-DECK SHOE</span>
            <h2 id="rulesTitle">Blackjack Table Rules</h2>
          </div>
          <button type="button" className="rules-close" id="rulesCloseBtn" aria-label="Close rules" onClick={onClose}>
            X
          </button>
        </header>

        <div className="rules-content">
          <section className="rules-block">
            <h3>Objective</h3>
            <ul>
              <li>Beat the dealer without going over 21.</li>
              <li>Cards should total as close to 21 as possible.</li>
              <li>A hand over 21 busts and loses immediately.</li>
            </ul>
          </section>
          <section className="rules-block">
            <h3>Deck And Values</h3>
            <ul>
              <li>Game uses 8 standard decks, 416 cards total.</li>
              <li>Aces count as 1 or 11.</li>
              <li>Cards 2-10 use face value. Jack, Queen, and King count as 10.</li>
              <li>The shoe reshuffles after the cut card is reached.</li>
            </ul>
          </section>
          <section className="rules-block">
            <h3>Blackjack</h3>
            <ul>
              <li>A natural blackjack is Ace plus any 10-value card on the first two cards.</li>
              <li>Natural blackjack pays 3:2.</li>
              <li>Blackjack after splitting Aces is treated as normal 21 and pays 1:1.</li>
            </ul>
          </section>
          <section className="rules-block">
            <h3>Dealer</h3>
            <ul>
              <li>Dealer receives one card face up and one card face down.</li>
              <li>If the upcard is an Ace or 10-value card, the dealer peeks for blackjack before players act.</li>
              <li>Dealer hits 16 or less and stands on all 17s, including Soft 17.</li>
            </ul>
          </section>
          <section className="rules-block">
            <h3>Player Options</h3>
            <ul>
              <li>Hit: take another card until standing, reaching 21, or busting.</li>
              <li>Stand: take no more cards.</li>
              <li>Double Down: double the wager on any first two cards, receive exactly one card, then stand.</li>
              <li>Surrender: late surrender is available before taking another action; half the wager is returned.</li>
            </ul>
          </section>
          <section className="rules-block">
            <h3>Split Rules</h3>
            <ul>
              <li>Split is allowed when the first two cards are the same rank.</li>
              <li>A second wager equal to the original wager is placed automatically.</li>
              <li>Re-splitting is allowed up to 4 total hands.</li>
              <li>Double after split is allowed.</li>
              <li>Split Aces receive one card per Ace. Re-splitting Aces is allowed up to the 4-hand limit.</li>
            </ul>
          </section>
          <section className="rules-block">
            <h3>Insurance</h3>
            <ul>
              <li>Insurance is offered only when the dealer shows an Ace.</li>
              <li>Maximum insurance bet is 50% of the original wager.</li>
              <li>Insurance pays 2:1 if the dealer has blackjack. Otherwise, the insurance bet loses.</li>
            </ul>
          </section>
          <section className="rules-block">
            <h3>Results And Payouts</h3>
            <ul>
              <li>Standard win pays 1:1.</li>
              <li>Natural blackjack pays 3:2.</li>
              <li>Push returns the original wager.</li>
              <li>Surrender returns 50% of the original wager.</li>
              <li>Table limits are $10 minimum and $5,000 maximum.</li>
            </ul>
          </section>
        </div>
      </article>
    </section>
  )
}
