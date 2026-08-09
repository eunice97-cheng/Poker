'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChatEmojiTray } from '@/components/ui/ChatEmojiTray'
import { ChatMessageText } from '@/components/ui/ChatMessageText'
import { ExitIcon } from '@/components/ui/ExitIcon'
import { AvatarDisplay } from '@/components/ui/AvatarDisplay'
import { appendChatEmojiCode } from '@/lib/chat-emojis'
import { useAudio } from '@/hooks/useAudio'
import { useSocket } from '@/hooks/useSocket'
import { useBaccaratState } from '@/hooks/useBaccaratState'
import type { ChatMessage } from '@/types/poker'

type Suit = 'S' | 'H' | 'D' | 'C'
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
type BetKey = 'player' | 'tie' | 'banker'
type Winner = BetKey
type DealerPortraitKey = 'normal' | 'smiling' | 'blinking'
type RoundPhase = 'betting' | 'dealing' | 'settled'

type DealerAssets = {
  id: string
  name: string
  portraits: Record<DealerPortraitKey, string>
  thankYou: {
    normal: string
    wink: string
  }
}

type BaccaratCard = {
  rank: Rank
  suit: Suit
}

type Bets = Record<BetKey, number>

type RoadItem = {
  id: number
  winner: Winner
  playerTotal: number
  bankerTotal: number
  natural: boolean
}

type RoundResult = RoadItem & {
  playerCards: BaccaratCard[]
  bankerCards: BaccaratCard[]
  net: number
  label: string
}

type BaccaratRoomClientProps = {
  tableId: string
  token: string
  playerId: string
  username: string
  avatar: string
  chipBalance: number
  hasVipEmojis: boolean
  isAdmin?: boolean
}

const BLACKJACK_STYLESHEET = '/blackjack/styles.css?v=20260724-42'
const SUITS: Suit[] = ['S', 'H', 'D', 'C']
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const BACCARAT_MIN_BET = 100
const BACCARAT_MAX_BET = 10000
const CHIP_VALUES = [100, 500, 1000, 5000]
const CHIP_STACK_VALUES = [5000, 1000, 500, 100]
const CHIP_STACK_OFFSETS = [
  [0, 1, -5],
  [-4, -2, 8],
  [4, -2, -9],
  [-2, 3, 5],
  [2, 3, -4],
  [0, -5, 7],
] as const
const EMPTY_BETS: Bets = { player: 0, tie: 0, banker: 0 }
const MAX_CHAT_LENGTH = 200
const DEALER_TIP_AMOUNT = 100
const DEALER_ROTATION_MS = 2 * 60 * 60 * 1000
const BLINK_DELAY_RANGE_MS = [2000, 10000] as const
const BLINK_DURATION_RANGE_MS = [100, 400] as const
const SMILE_SWITCH_RANGE_MS = [5000, 25000] as const
const BACCARAT_BETTING_SECONDS = 10
const BACCARAT_SETTLED_SECONDS = 7
const BACCARAT_DEALING_DELAY_MS = 700
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
const SUIT_SYMBOLS: Record<Suit, string> = {
  S: '\u2660',
  H: '\u2665',
  D: '\u2666',
  C: '\u2663',
}

function money(value: number) {
  return value.toLocaleString()
}

function signedMoney(value: number) {
  if (value > 0) return `+${money(value)}`
  if (value < 0) return `-${money(Math.abs(value))}`
  return '0'
}

function totalWord(value: number) {
  return ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][value] ?? String(value)
}

function formatDealerCall(result: RoundResult) {
  const winnerCall = result.winner === 'player' ? 'Player wins.' : result.winner === 'banker' ? 'Banker wins.' : 'Tie.'

  if (result.natural) {
    const naturalCalls = [
      result.playerTotal >= 8 ? `Player natural ${totalWord(result.playerTotal)}.` : '',
      result.bankerTotal >= 8 ? `Banker natural ${totalWord(result.bankerTotal)}.` : '',
    ].filter(Boolean)

    return [...naturalCalls, winnerCall].join(' ')
  }

  return `Player, ${totalWord(result.playerTotal)}. Banker, ${totalWord(result.bankerTotal)}. ${winnerCall}`
}

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function randomMs([min, max]: readonly [number, number]) {
  return Math.round(min + Math.random() * (max - min))
}

function secondsLeft(target: number | null | undefined, now: number) {
  if (!target) return 0
  return Math.max(0, Math.ceil((target - now) / 1000))
}

function dealerForTime(time: number) {
  return DEALERS[Math.floor(time / DEALER_ROTATION_MS) % DEALERS.length] ?? DEALERS[0]
}

function createShoe() {
  const cards: BaccaratCard[] = []

  for (let deck = 0; deck < 8; deck++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) cards.push({ rank, suit })
    }
  }

  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const current = cards[i]
    cards[i] = cards[j]
    cards[j] = current
  }

  return cards
}

function baccaratValue(card: BaccaratCard) {
  if (card.rank === 'A') return 1
  if (card.rank === '10' || card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 0
  return Number(card.rank)
}

function handTotal(cards: BaccaratCard[]) {
  return cards.reduce((sum, card) => sum + baccaratValue(card), 0) % 10
}

function shouldBankerDraw(bankerTotal: number, playerThirdCard: BaccaratCard | null) {
  if (!playerThirdCard) return bankerTotal <= 5

  const playerThirdValue = baccaratValue(playerThirdCard)
  if (bankerTotal <= 2) return true
  if (bankerTotal === 3) return playerThirdValue !== 8
  if (bankerTotal === 4) return playerThirdValue >= 2 && playerThirdValue <= 7
  if (bankerTotal === 5) return playerThirdValue >= 4 && playerThirdValue <= 7
  if (bankerTotal === 6) return playerThirdValue === 6 || playerThirdValue === 7
  return false
}

function totalBets(bets: Bets) {
  return bets.player + bets.tie + bets.banker
}

function chipFacesForBet(value: number) {
  const faces: number[] = []
  let remaining = value

  for (const chipValue of CHIP_STACK_VALUES) {
    while (remaining >= chipValue && faces.length < CHIP_STACK_OFFSETS.length) {
      faces.push(chipValue)
      remaining -= chipValue
    }
  }

  return faces.length > 0 ? faces : [BACCARAT_MIN_BET]
}

function resolveRound(shoe: BaccaratCard[], bets: Bets, roundId: number) {
  const workingShoe = shoe.length < 60 ? createShoe() : [...shoe]
  const draw = () => {
    const card = workingShoe.pop()
    if (!card) throw new Error('Baccarat shoe is empty')
    return card
  }

  const playerCards = [draw(), draw()]
  const bankerCards = [draw(), draw()]
  let playerTotal = handTotal(playerCards)
  let bankerTotal = handTotal(bankerCards)
  const natural = playerTotal >= 8 || bankerTotal >= 8
  let playerThirdCard: BaccaratCard | null = null

  if (!natural) {
    if (playerTotal <= 5) {
      playerThirdCard = draw()
      playerCards.push(playerThirdCard)
      playerTotal = handTotal(playerCards)
    }

    if (shouldBankerDraw(bankerTotal, playerThirdCard)) {
      bankerCards.push(draw())
      bankerTotal = handTotal(bankerCards)
    }
  }

  const winner: Winner = playerTotal > bankerTotal ? 'player' : bankerTotal > playerTotal ? 'banker' : 'tie'
  const stake = totalBets(bets)
  let returns = 0

  if (winner === 'player') returns += bets.player * 2
  if (winner === 'banker') returns += bets.banker + Math.floor(bets.banker * 0.95)
  if (winner === 'tie') {
    returns += bets.tie * 9
    returns += bets.player + bets.banker
  }

  const label = winner === 'player' ? 'Player wins' : winner === 'banker' ? 'Banker wins' : 'Tie hand'

  return {
    nextShoe: workingShoe,
    returns,
    result: {
      id: roundId,
      winner,
      playerCards,
      bankerCards,
      playerTotal,
      bankerTotal,
      natural,
      net: returns - stake,
      label,
    } satisfies RoundResult,
  }
}

function Card({ card }: { card: BaccaratCard }) {
  const isRed = card.suit === 'H' || card.suit === 'D'

  return (
    <div className={classNames('card baccarat-card', isRed && 'red')}>
      <span className="rank">{card.rank}</span>
      <span className="suit">{SUIT_SYMBOLS[card.suit]}</span>
      <span className="bottom">{card.rank}</span>
    </div>
  )
}

function CardBack() {
  return <div className="card card-back baccarat-card-back" aria-hidden="true" />
}

function HandArea({
  label,
  cards,
  total,
  className,
}: {
  label: string
  cards: BaccaratCard[]
  total: number | null
  className: string
}) {
  return (
    <section className={classNames('hand-area baccarat-hand-area', className)} aria-label={`${label} hand`}>
      <h2>{label}</h2>
      <div className="cards">
        {cards.length > 0 ? cards.map((card, index) => <Card key={`${card.rank}-${card.suit}-${index}`} card={card} />) : (
          <>
            <CardBack />
            <CardBack />
          </>
        )}
      </div>
      <div className="score-pill" hidden={cards.length === 0}>{total ?? '?'}</div>
    </section>
  )
}

function BetChipStack({ amount }: { amount: number }) {
  if (amount <= 0) return null

  return (
    <span className="spot-chip-stack baccarat-spot-chip-stack" aria-hidden="true">
      {chipFacesForBet(amount).map((chip, chipIndex) => (
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
  )
}

function TableBetZone({
  label,
  payout,
  amount,
  className,
  onClick,
}: {
  label: string
  payout: string
  amount: number
  className: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={classNames('baccarat-bet-zone', amount > 0 && 'has-bet', className)}
      aria-label={`Bet on ${label}`}
      title={`Bet on ${label}`}
      onClick={onClick}
    >
      <span className="baccarat-zone-label">{label}</span>
      <small className="baccarat-zone-payout">{payout}</small>
      <BetChipStack amount={amount} />
      {amount > 0 && <em className="baccarat-zone-amount">{money(amount)}</em>}
    </button>
  )
}

function RoadPanel({ road }: { road: RoadItem[] }) {
  const recent = road.slice(-42)
  const cells = Array.from({ length: 42 }, (_, index) => recent[index] ?? null)

  return (
    <aside className="session-history baccarat-road" aria-label="Baccarat road">
      <header>
        <div className="history-heading">
          <span>ROAD</span>
          <strong>BEAD PLATE</strong>
        </div>
        <span className="baccarat-road__rounds">{road.length}</span>
      </header>
      <div className="baccarat-road__grid">
        {cells.map((item, index) => {
          if (!item) return <span key={index} className="baccarat-road__cell" />

          return (
            <span key={index} className={classNames('baccarat-road__cell', `is-${item.winner}`)}>
              {item.winner === 'player' ? 'P' : item.winner === 'banker' ? 'B' : 'T'}
            </span>
          )
        })}
      </div>
    </aside>
  )
}

function DealerTipBoard({ dealerName, total }: { dealerName: string; total: number }) {
  return (
    <aside className="dealer-tip-board baccarat-tip-board" aria-label="Dealer tip ranking">
      <header className="dealer-tip-board__header">
        <span>Dealer Tips</span>
        <strong>{money(total)}</strong>
      </header>
      <ol className="dealer-tip-board__list">
        <li className="dealer-tip-row is-leading is-active">
          <span className="dealer-tip-row__rank">01</span>
          <span className="dealer-tip-row__name">Dealer {dealerName}</span>
          <span className="dealer-tip-row__label">Total Tip Received</span>
          <strong>{money(total)}</strong>
        </li>
      </ol>
    </aside>
  )
}

function BaccaratSeatRail({
  players,
  maxPlayers,
  myPlayerId,
}: {
  players: Array<{
    playerId: string
    username: string
    avatar: string
    seat: number
    stack: number
    betTotal: number
  }>
  maxPlayers: number
  myPlayerId: string
}) {
  const bySeat = new Map(players.map((player) => [player.seat, player]))
  const seats = Array.from({ length: maxPlayers }, (_, index) => {
    const player = bySeat.get(index)
    return {
      id: index + 1,
      player,
      active: Boolean(player),
      isMe: player?.playerId === myPlayerId,
    }
  })

  return (
    <div className="baccarat-seat-rail" aria-label="Baccarat seats">
      {seats.map((seat) => (
        <div key={seat.id} className={classNames('baccarat-seat', `baccarat-seat-${seat.id}`, seat.active && 'is-active', seat.isMe && 'is-me')}>
          <span className="baccarat-seat__avatar">
            {seat.player ? (
              <AvatarDisplay avatarId={seat.player.avatar} size="sm" className="!h-8 !w-8 !rounded-full !border-[#d6ad48]/70" />
            ) : (
              <span aria-hidden="true" />
            )}
          </span>
          <span className="baccarat-seat__name">{seat.player ? seat.player.username : `Seat ${seat.id}`}</span>
          <strong>{seat.player?.betTotal ? `Bet ${money(seat.player.betTotal)}` : seat.active ? 'No bet' : 'Open'}</strong>
          <em>{seat.player ? `${money(seat.player.stack)} chips` : 'Available'}</em>
        </div>
      ))}
    </div>
  )
}

function BaccaratTableChat({
  messages,
  onSend,
  myPlayerId,
  hasVipEmojis,
}: {
  messages: ChatMessage[]
  onSend: (text: string) => void
  myPlayerId: string
  hasVipEmojis: boolean
}) {
  const [input, setInput] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [activeEmojiTray, setActiveEmojiTray] = useState<'standard' | 'vip' | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const showEmojiTray = activeEmojiTray === 'standard'
  const showVipEmojiTray = activeEmojiTray === 'vip'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (collapsed) setActiveEmojiTray(null)
  }, [collapsed])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    onSend(text)
    setInput('')
    setActiveEmojiTray(null)
  }

  const appendEmoji = (emojiCode: string) => {
    setInput((current) => appendChatEmojiCode(current, emojiCode, MAX_CHAT_LENGTH))
    setActiveEmojiTray(null)
  }

  const toggleCollapsed = () => {
    setCollapsed((current) => !current)
  }

  return (
    <div className="baccarat-chat-shell">
      {!collapsed && activeEmojiTray && (
        <div className="casino-table-chat__emoji-popover baccarat-chat-emoji-popover" data-kind={activeEmojiTray}>
          <ChatEmojiTray
            hasVipAccess={hasVipEmojis}
            onSelect={appendEmoji}
            variant="table"
            category={activeEmojiTray}
          />
        </div>
      )}

      <section className={classNames('blackjack-chat', collapsed && 'is-collapsed')} aria-label="Table chat">
        <div
          className="blackjack-chat-header"
          role="button"
          tabIndex={0}
          onClick={toggleCollapsed}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              toggleCollapsed()
            }
          }}
          aria-label={collapsed ? 'Show table chat' : 'Hide table chat'}
        >
          <span>TABLE CHAT</span>
          <button
            type="button"
            className="baccarat-chat-toggle"
            onClick={(event) => {
              event.stopPropagation()
              toggleCollapsed()
            }}
            onPointerDown={(event) => event.stopPropagation()}
            aria-label={collapsed ? 'Show table chat' : 'Hide table chat'}
          >
            {collapsed ? 'SHOW' : 'HIDE'}
          </button>
        </div>

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
                onClick={() => setActiveEmojiTray((current) => current === 'standard' ? null : 'standard')}
                aria-pressed={showEmojiTray}
                aria-label={showEmojiTray ? 'Hide emoji picker' : 'Show emoji picker'}
              >
                Emoji
              </button>
              <button
                type="button"
                className={classNames('blackjack-chat-emoji-button', showVipEmojiTray && 'is-active')}
                onClick={() => setActiveEmojiTray((current) => current === 'vip' ? null : 'vip')}
                aria-pressed={showVipEmojiTray}
                aria-label={showVipEmojiTray ? 'Hide VIP emoji picker' : 'Show VIP emoji picker'}
              >
                VIP
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
    </div>
  )
}

function TopbarLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="table-status-button">
      {children}
    </Link>
  )
}

function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <section className="rules-modal" id="rulesModal" role="dialog" aria-modal="true" aria-labelledby="rulesTitle" hidden={!open}>
      <div className="rules-backdrop" data-rules-close onClick={onClose} />
      <article className="rules-panel" tabIndex={-1}>
        <header className="rules-header">
          <div>
            <span>STANDARD BACCARAT</span>
            <h2 id="rulesTitle">Baccarat Table Rules</h2>
          </div>
          <button type="button" className="rules-close" id="rulesCloseBtn" aria-label="Close rules" onClick={onClose}>
            X
          </button>
        </header>

        <div className="rules-content">
          <section className="rules-block">
            <h3>Objective</h3>
            <ul>
              <li>Bet on Player, Banker, or Tie.</li>
              <li>Table stakes run from 100 to 10,000 chips.</li>
              <li>Baccarat chips are 100, 500, 1,000, and 5,000.</li>
              <li>The hand closest to 9 wins.</li>
              <li>Only the last digit of the hand total counts.</li>
            </ul>
          </section>
          <section className="rules-block">
            <h3>Card Values</h3>
            <ul>
              <li>Aces count as 1.</li>
              <li>Cards 2-9 use face value.</li>
              <li>10, Jack, Queen, and King count as 0.</li>
            </ul>
          </section>
          <section className="rules-block">
            <h3>Natural</h3>
            <ul>
              <li>An opening total of 8 or 9 is natural.</li>
              <li>No third card is drawn after a natural.</li>
              <li>Highest natural total wins the round.</li>
            </ul>
          </section>
          <section className="rules-block">
            <h3>Player</h3>
            <ul>
              <li>Player draws a third card on totals 0-5.</li>
              <li>Player stands on totals 6 or 7.</li>
              <li>Player wins pay 1:1.</li>
            </ul>
          </section>
          <section className="rules-block">
            <h3>Banker</h3>
            <ul>
              <li>Banker drawing follows the standard third-card table.</li>
              <li>Banker wins pay 0.95:1 after commission.</li>
            </ul>
          </section>
          <section className="rules-block">
            <h3>Tie</h3>
            <ul>
              <li>Tie wins pay 8:1.</li>
              <li>Player and Banker bets push on a tie.</li>
              <li>The bead plate records P, B, or T results.</li>
            </ul>
          </section>
        </div>
      </article>
    </section>
  )
}

export function BaccaratRoomClient({ tableId, token, playerId, username, avatar, chipBalance, hasVipEmojis, isAdmin = false }: BaccaratRoomClientProps) {
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
  } = useAudio()
  const {
    baccaratState,
    messages,
    tableError,
    lastError,
    placeBet: placeBaccaratBet,
    clearBets: clearBaccaratBets,
    rebet: rebetBaccarat,
    doubleBets: doubleBaccaratBets,
    sitOut,
    sitIn,
    tipDealer,
    leaveTable,
    sendChat: sendBaccaratChat,
  } = useBaccaratState(socket, tableId)
  const [selectedChip, setSelectedChip] = useState(100)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [activeDealer, setActiveDealer] = useState(() => dealerForTime(Date.now()))
  const [dealerPortrait, setDealerPortrait] = useState<DealerPortraitKey>('normal')
  const [tipImage, setTipImage] = useState(() => dealerForTime(Date.now()).thankYou.normal)
  const [tipVisible, setTipVisible] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState('')
  const tipTimeoutRef = useRef<number | null>(null)

  const me = useMemo(
    () => baccaratState?.players.find((player) => player.playerId === baccaratState.myPlayerId) ?? null,
    [baccaratState]
  )
  const waitingMe = useMemo(
    () => baccaratState?.observers.find((observer) => observer.playerId === baccaratState.myPlayerId) ?? null,
    [baccaratState]
  )
  const stack = me?.stack ?? waitingMe?.stack ?? 0
  const bets = baccaratState?.bets ?? EMPTY_BETS
  const lastBets = baccaratState?.lastBets ?? EMPTY_BETS
  const road = baccaratState?.road ?? []
  const result = baccaratState?.result ?? null
  const roundPhase = baccaratState?.phase ?? 'betting'
  const maxBet = baccaratState?.maxBet ?? BACCARAT_MAX_BET
  const minBet = baccaratState?.minBet ?? BACCARAT_MIN_BET
  const currentStake = totalBets(bets)
  const lastStake = totalBets(lastBets)
  const dealing = roundPhase === 'dealing'
  const roundClosed = !baccaratState || roundPhase !== 'betting'
  const waitingForBets = roundPhase === 'betting' && !baccaratState?.bettingEndsAt
  const canTipDealer = Boolean(me && stack >= DEALER_TIP_AMOUNT)
  const activeDealerTipTotal = baccaratState?.dealerTips?.[activeDealer.id] ?? 0
  const myPlayerId = baccaratState?.myPlayerId ?? playerId
  const isSeated = Boolean(me)
  const chatMessages = useMemo<ChatMessage[]>(
    () => messages.map((message) => ({ ...message, isSystem: false })),
    [messages]
  )
  const bettingSecondsLeft = secondsLeft(baccaratState?.bettingEndsAt, now)
  const nextRoundSecondsLeft = secondsLeft(baccaratState?.nextRoundStartsAt, now)
  const bgmEffectivelyMuted = musicMute || musicVol === 0
  const sfxEffectivelyMuted = sfxMute || sfxVol === 0

  useEffect(() => {
    const syncActiveDealer = () => setActiveDealer(dealerForTime(Date.now()))
    syncActiveDealer()
    const interval = window.setInterval(syncActiveDealer, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    setTipImage(activeDealer.thankYou.normal)
  }, [activeDealer])

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

  useEffect(() => {
    return () => {
      if (tipTimeoutRef.current) window.clearTimeout(tipTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  const tableCallLine = result ? formatDealerCall(result) : 'No result yet'

  const dealerLine = useMemo(() => {
    if (tableError) return tableError
    if (!baccaratState) return connected ? 'Finding your Baccarat seat.' : socketError ? 'Connecting to the Baccarat room.' : 'Opening Baccarat table.'
    if (dealing) return 'No more bets.'
    if (roundPhase === 'settled') return tableCallLine
    if (currentStake > 0) return `${money(currentStake)} on the layout.`
    return isSeated ? baccaratState.message : `Take a seat to play. ${money(minBet)} minimum.`
  }, [baccaratState, connected, currentStake, dealing, isSeated, minBet, roundPhase, socketError, tableCallLine, tableError])

  const timerLabel = waitingForBets ? 'Waiting For Bets' : roundPhase === 'betting' ? 'Betting Closes' : roundPhase === 'dealing' ? 'No More Bets' : 'Next Round'
  const timerValue = waitingForBets || roundPhase === 'dealing' ? '--' : `${roundPhase === 'settled' ? nextRoundSecondsLeft : bettingSecondsLeft}s`

  const displayMessage = leaveError || lastError || tableError || (dealing ? 'Cards are in motion.' : result ? tableCallLine : baccaratState?.message ?? 'Connecting to table.')

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

  const handleTip = async () => {
    if (!canTipDealer) return
    const res = await tipDealer(DEALER_TIP_AMOUNT, activeDealer.id)
    if (res.error) return
    setTipImage(activeDealer.thankYou.normal)
    setTipVisible(true)
    if (tipTimeoutRef.current) window.clearTimeout(tipTimeoutRef.current)
    const winkTimeout = window.setTimeout(() => setTipImage(activeDealer.thankYou.wink), 260)
    const normalTimeout = window.setTimeout(() => setTipImage(activeDealer.thankYou.normal), 620)
    tipTimeoutRef.current = window.setTimeout(() => {
      window.clearTimeout(winkTimeout)
      window.clearTimeout(normalTimeout)
      setTipVisible(false)
    }, 1600)
  }

  const placeBet = (key: BetKey) => {
    if (!isSeated || roundClosed || stack < selectedChip || currentStake + selectedChip > maxBet) return
    void placeBaccaratBet(key, selectedChip)
  }

  const clearBets = () => {
    if (!isSeated || roundClosed || currentStake <= 0) return
    void clearBaccaratBets()
  }

  const rebet = () => {
    if (!isSeated || roundClosed || lastStake <= 0) return
    const available = stack + currentStake
    if (available < lastStake || lastStake > maxBet) return
    void rebetBaccarat()
  }

  const doubleBets = () => {
    if (!isSeated || roundClosed || currentStake <= 0 || stack < currentStake || currentStake * 2 > maxBet) return
    void doubleBaccaratBets()
  }

  const handleStand = () => {
    if (roundClosed) return
    void sitOut()
  }

  const handleSit = () => {
    if (roundClosed) return
    void sitIn()
  }

  const sendChat = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    void sendBaccaratChat(trimmed)
  }

  const handleLeave = async () => {
    setLeaveError('')
    if (roundClosed && baccaratState) {
      setLeaveError('Please wait for this Baccarat round to finish before cashing out.')
      return
    }

    setLeaving(true)
    const res = await leaveTable()
    setLeaving(false)
    if (res.error) {
      setLeaveError(res.error)
      return
    }
    router.push('/baccarat')
  }

  return (
    <>
      <link rel="stylesheet" href={BLACKJACK_STYLESHEET} />

      <main className="game-shell baccarat-game-shell">
        <header className="topbar baccarat-topbar">
          <section className="balance-panel">
            <span>BALANCE</span>
            <strong>{money(stack)}</strong>
          </section>

          <section className="baccarat-title-panel" aria-label="Baccarat room">
            <img src="/baccarat/Images/baccarat-logo.png" alt="" aria-hidden="true" />
            <div>
              <strong>BACCARAT LOUNGE</strong>
            </div>
          </section>

          <nav className="utility-buttons" aria-label="Game options">
            <div className="audio-control">
              <button
                type="button"
                className={classNames('utility-button audio-toggle', bgmEffectivelyMuted && 'is-muted')}
                aria-label={bgmEffectivelyMuted ? 'Unmute BGM' : `Mute BGM. Volume ${Math.round(musicVol * 100)}%`}
                aria-pressed={bgmEffectivelyMuted}
                aria-expanded="false"
                aria-controls="audioPanel"
                onClick={handleBgmToggle}
              >
                <span id="audioIcon" className="utility-label" aria-hidden="true">Audio</span>
              </button>
              <div className="audio-panel" id="audioPanel" role="group" aria-label="Volume controls">
                <div className="audio-panel-row">
                  <label className="volume-label" htmlFor="baccaratBgmQuickVolumeSlider">
                    <span>BGM</span>
                    <strong>{bgmEffectivelyMuted ? 'OFF' : `${Math.round(musicVol * 100)}%`}</strong>
                  </label>
                  <input
                    type="range"
                    id="baccaratBgmQuickVolumeSlider"
                    min="0"
                    max="100"
                    value={Math.round(musicVol * 100)}
                    onChange={(event) => setMusicVol(Number(event.target.value) / 100)}
                  />
                  <button type="button" className={classNames('quick-sound-mute', bgmEffectivelyMuted && 'is-muted')} onClick={handleBgmToggle}>
                    {bgmEffectivelyMuted ? 'BGM Off' : 'BGM On'}
                  </button>
                </div>
                <div className="audio-panel-row">
                  <label className="volume-label" htmlFor="baccaratSfxQuickVolumeSlider">
                    <span>SFX</span>
                    <strong>{sfxEffectivelyMuted ? 'OFF' : `${Math.round(sfxVol * 100)}%`}</strong>
                  </label>
                  <input
                    type="range"
                    id="baccaratSfxQuickVolumeSlider"
                    min="0"
                    max="100"
                    value={Math.round(sfxVol * 100)}
                    onChange={(event) => setSfxVol(Number(event.target.value) / 100)}
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
            {isSeated ? (
              <button type="button" className="table-status-button" disabled={roundClosed} onClick={handleStand}>
                Stand
              </button>
            ) : (
              <button type="button" className="table-status-button" disabled={roundClosed} onClick={handleSit}>
                Sit
              </button>
            )}
            <TopbarLink href="/">Main Lobby</TopbarLink>
            {isAdmin && <TopbarLink href="/gm">GM</TopbarLink>}
            <button
              type="button"
              className="table-status-button is-cashout"
              aria-label="Cash out and leave Baccarat table"
              title="Cash out"
              disabled={leaving || (roundClosed && Boolean(baccaratState))}
              onClick={handleLeave}
            >
              <ExitIcon className="cashout-icon" />
            </button>
          </nav>
        </header>

        <section className="table-frame baccarat-table-frame">
          <RoadPanel road={road} />

          <div className="wood-rail baccarat-wood-rail">
            <img
              id="dealerPortrait"
              className="dealer-portrait"
              src={activeDealer.portraits[dealerPortrait]}
              alt=""
              aria-hidden="true"
            />
            <div className="dealer-speech" id="dealerSpeech" aria-live="polite">{dealerLine}</div>
            <DealerTipBoard dealerName={activeDealer.name} total={activeDealerTipTotal} />
            <div className={classNames('baccarat-table-timer', `is-${roundPhase}`)} aria-label="Baccarat round timer" aria-live="polite">
              <span>{timerLabel}</span>
              <strong>{timerValue}</strong>
            </div>

            <div className="felt-table baccarat-felt-table">
              <img className="baccarat-table-image" src="/baccarat/Images/baccarat-table-2.png" alt="" aria-hidden="true" />
              <div className="tip-control table-tip-control baccarat-table-tip-control">
                <button
                  type="button"
                  className="tip-button baccarat-tip-button"
                  disabled={!canTipDealer}
                  onClick={handleTip}
                >
                  <b>TIP</b>
                  <span>TIP DEALER</span>
                </button>
                <div className={classNames('tip-popup', tipVisible && 'is-visible')} id="tipPopup" aria-hidden={!tipVisible}>
                  <img src={tipImage} alt="" aria-hidden="true" />
                  <span>Thank you for the tip!</span>
                </div>
              </div>
              <div className="baccarat-result-ribbon" aria-live="polite">
                <span>TABLE CALL</span>
                <strong>{dealing ? 'No more bets' : tableCallLine}</strong>
              </div>
              <HandArea
                label="Player"
                cards={result?.playerCards ?? []}
                total={result?.playerTotal ?? null}
                className="baccarat-player-hand"
              />
              <HandArea
                label="Banker"
                cards={result?.bankerCards ?? []}
                total={result?.bankerTotal ?? null}
                className="baccarat-banker-hand"
              />

              <TableBetZone label="Player" payout="1 to 1" amount={bets.player} className="baccarat-zone-player" onClick={() => placeBet('player')} />
              <TableBetZone label="Tie" payout="8 to 1" amount={bets.tie} className="baccarat-zone-tie" onClick={() => placeBet('tie')} />
              <TableBetZone label="Banker" payout="0.95 to 1" amount={bets.banker} className="baccarat-zone-banker" onClick={() => placeBet('banker')} />
              <BaccaratSeatRail players={baccaratState?.players ?? []} maxPlayers={baccaratState?.maxPlayers ?? 6} myPlayerId={myPlayerId} />
            </div>
          </div>
        </section>

        <div className="blackjack-chat-panel baccarat-chat-panel">
          <BaccaratTableChat
            messages={chatMessages}
            onSend={sendChat}
            myPlayerId={myPlayerId}
            hasVipEmojis={hasVipEmojis}
          />
        </div>

        <section className="bottom-console baccarat-bottom-console">
          <div className="message" id="message">{displayMessage}</div>

          <aside className="round-info baccarat-round-info" aria-label="Round totals">
            <span>CURRENT BET</span>
            <strong id="currentBet">{money(currentStake)}</strong>
            <div />
            <span>WIN</span>
            <strong id="winAmount">{result ? signedMoney(result.net) : '0'}</strong>
          </aside>

          <div className="chip-selector" id="chipRow">
            {CHIP_VALUES.map((value) => (
              <button
                key={value}
                type="button"
                className={classNames('chip', `chip-${value}`, selectedChip === value && 'active')}
                data-value={value}
                aria-label={`${money(value)} chip`}
                disabled={!isSeated || roundClosed || stack < value || currentStake + value > maxBet}
                onClick={() => setSelectedChip(value)}
              >
                <span>{value}</span>
              </button>
            ))}
          </div>

          <div className="action-row baccarat-action-row" data-mode={currentStake > 0 ? 'betting' : 'idle'}>
            <button type="button" id="undoBtn" className="secondary action-button" disabled={!isSeated || lastStake <= 0 || lastStake > maxBet || roundClosed || stack + currentStake < lastStake} onClick={rebet} aria-label="Rebet">
              <b>Rebet</b>
              <span>REBET</span>
            </button>
            <button type="button" id="clearBtn" className="secondary action-button" disabled={!isSeated || currentStake <= 0 || roundClosed} onClick={clearBets} aria-label="Clear bet">
              <b>Clear</b>
              <span>CLEAR BET</span>
            </button>
            <button type="button" id="doubleBtn" className="action-button" disabled={currentStake <= 0 || roundClosed || stack < currentStake || currentStake * 2 > maxBet} onClick={doubleBets}>
              <b>Double</b>
              <span>DOUBLE</span>
            </button>
          </div>

        </section>
      </main>

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />

      <style jsx global>{`
        .baccarat-game-shell {
          --baccarat-bottom-console-height: 132px;
          --baccarat-chat-console-gap: 16px;
          height: 100svh;
          min-height: 0;
          grid-template-rows: minmax(0, 1fr) 132px;
          overflow: hidden;
          background:
            linear-gradient(180deg, rgba(0,0,0,.1), rgba(0,0,0,.66)),
            linear-gradient(90deg, rgba(0,0,0,.86), rgba(0,0,0,.26) 42%, rgba(0,0,0,.78)),
            url("/baccarat/Images/baccarat-lobby.png") center / cover no-repeat,
            #030504;
        }

        .casino-floating-buttons[data-table-page="true"] {
          z-index: 7 !important;
        }

        .baccarat-game-shell .topbar {
          left: 0;
          right: 24px;
          top: 14px;
          align-items: flex-start;
        }

        .baccarat-game-shell .balance-panel {
          min-width: 148px;
          margin-left: 238px;
        }

        .baccarat-title-panel {
          pointer-events: auto;
          position: absolute;
          left: 50%;
          top: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          width: min(720px, 48vw);
          min-height: 74px;
          padding: 9px 28px 10px;
          border: 1px solid rgba(214,173,72,.46);
          border-radius: 10px;
          background: linear-gradient(180deg, rgba(5,8,6,.88), rgba(1,3,2,.82));
          box-shadow: inset 0 1px rgba(255,255,255,.05), 0 16px 24px rgba(0,0,0,.32);
          transform: translateX(-50%);
        }

        .baccarat-title-panel img {
          width: 62px;
          height: 46px;
          object-fit: contain;
          filter: drop-shadow(0 8px 12px rgba(0,0,0,.46));
        }

        .baccarat-title-panel span {
          display: none;
          color: var(--gold);
          font-family: var(--font-display);
          font-size: .64rem;
          font-weight: 900;
          letter-spacing: .16em;
          line-height: 1;
          text-transform: uppercase;
        }

        .baccarat-title-panel strong {
          display: block;
          margin-top: 0;
          color: var(--gold-light);
          font-family: var(--font-display);
          font-size: clamp(1.85rem, 2.55vw, 2.95rem);
          font-weight: 900;
          letter-spacing: .08em;
          line-height: .95;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .baccarat-game-shell .table-frame {
          padding: 86px 210px 0;
          place-items: end center;
        }

        .baccarat-game-shell .utility-buttons {
          align-items: flex-start;
          gap: 6px;
        }

        .baccarat-game-shell .utility-buttons .table-status-button {
          min-height: 42px;
          display: inline-grid;
          place-items: center;
          text-decoration: none;
          white-space: nowrap;
        }

        .baccarat-game-shell .utility-button,
        .baccarat-game-shell .table-status-button.is-cashout {
          width: 42px;
          min-width: 42px;
          height: 42px;
          min-height: 42px;
        }

        .baccarat-game-shell .chip-5000,
        .baccarat-game-shell .chip-face-5000 {
          background-image: url("/baccarat/Images/Chips/5000.png");
          background-size: 122%;
        }

        .baccarat-road {
          left: 20px;
          top: 112px;
          width: 176px;
          max-height: min(430px, calc(100% - 130px));
        }

        .baccarat-road__rounds {
          color: #fff;
          font-family: var(--font-number);
          font-size: .9rem;
          font-weight: 800;
        }

        .baccarat-road__grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 6px;
          margin-top: 10px;
        }

        .baccarat-road__cell {
          display: grid;
          place-items: center;
          aspect-ratio: 1;
          border: 1px solid rgba(247,240,215,.52);
          border-radius: 999px;
          background: rgba(3,12,8,.36);
          color: #fff;
          font-family: var(--font-display);
          font-size: .6rem;
          font-weight: 900;
          line-height: 1;
        }

        .baccarat-road__cell.is-player {
          border-color: rgba(130,195,255,.62);
          background: #2474bc;
        }

        .baccarat-road__cell.is-banker {
          border-color: rgba(255,171,158,.62);
          background: #b7352a;
        }

        .baccarat-road__cell.is-tie {
          border-color: rgba(154,255,198,.62);
          background: #269e5e;
        }

        .baccarat-wood-rail {
          width: min(100%, 990px);
          max-height: calc(100svh - 144px);
          align-self: end;
          background: transparent !important;
          box-shadow: none !important;
          transform: translateY(8px);
        }

        .baccarat-wood-rail .dealer-portrait {
          top: -29%;
          width: clamp(150px, 8.7vw, 170px);
          z-index: 7;
        }

        .baccarat-wood-rail .dealer-speech {
          left: calc(50% + 112px);
          top: -4%;
        }

        .baccarat-tip-board {
          position: absolute !important;
          left: calc(50% - 386px) !important;
          top: -26% !important;
          z-index: 24 !important;
          width: 292px !important;
        }

        .baccarat-tip-board .dealer-tip-row {
          grid-template-columns: 28px minmax(176px, 1fr) auto;
          gap: 1px 7px;
          padding-inline: 8px;
        }

        .baccarat-tip-board .dealer-tip-row__label {
          letter-spacing: .08em;
        }

        .baccarat-table-timer {
          position: absolute;
          left: calc(50% - 386px);
          top: -8%;
          z-index: 24;
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 12px;
          width: 292px;
          min-height: 50px;
          padding: 9px 12px;
          border: 1px solid rgba(214,173,72,.52);
          border-radius: 10px;
          background:
            radial-gradient(circle at 18% 0%, rgba(243,212,125,.16), transparent 42%),
            linear-gradient(135deg, rgba(8,11,9,.96), rgba(2,5,4,.9));
          color: var(--gold-light);
          font-family: var(--font-display);
          box-shadow: inset 0 1px rgba(255,255,255,.07), 0 14px 24px rgba(0,0,0,.38);
        }

        .baccarat-table-timer span {
          overflow: hidden;
          font-size: .62rem;
          font-weight: 900;
          letter-spacing: .14em;
          line-height: 1;
          text-overflow: ellipsis;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .baccarat-table-timer strong {
          color: #fff;
          font-family: var(--font-number);
          font-size: 1.35rem;
          font-weight: 900;
          line-height: 1;
          text-shadow: 0 0 12px rgba(243,212,125,.32);
        }

        .baccarat-table-timer.is-dealing {
          border-color: rgba(255,195,100,.72);
        }

        .baccarat-felt-table {
          background: transparent !important;
          box-shadow: none !important;
        }

        .baccarat-table-image {
          position: absolute;
          inset: 0;
          z-index: 8;
          width: 100%;
          height: 100%;
          object-fit: contain;
          pointer-events: none;
          filter: drop-shadow(0 24px 30px rgba(0,0,0,.45));
        }

        .baccarat-result-ribbon {
          position: absolute;
          left: 50%;
          top: 18.5%;
          z-index: 18;
          width: min(560px, 54%);
          min-width: min(420px, 48%);
          max-width: 560px;
          padding: 9px 20px 11px;
          border: 1px solid rgba(214,173,72,.48);
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(8,11,9,.92), rgba(2,5,4,.86));
          color: var(--gold-light);
          text-align: center;
          transform: translateX(-50%);
          box-shadow: inset 0 1px rgba(255,255,255,.06), 0 16px 24px rgba(0,0,0,.4);
        }

        .baccarat-result-ribbon span {
          display: block;
          font-family: var(--font-display);
          font-size: .58rem;
          font-weight: 900;
          letter-spacing: .18em;
          line-height: 1;
        }

        .baccarat-result-ribbon strong {
          display: block;
          margin-top: 5px;
          color: #fff;
          font-family: var(--font-display);
          font-size: clamp(.8rem, 1.05vw, 1.06rem);
          font-weight: 900;
          line-height: 1.12;
          overflow-wrap: normal;
          text-wrap: balance;
          text-shadow: 0 1px 0 rgba(0,0,0,.75);
          white-space: normal;
        }

        .baccarat-felt-table .baccarat-table-tip-control {
          left: 50% !important;
          top: 34.8% !important;
          z-index: 140 !important;
          display: block !important;
          width: 112px !important;
          height: 58px !important;
          min-width: 112px !important;
          min-height: 58px !important;
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
          transform: translate(-50%, -50%);
        }

        .baccarat-felt-table .baccarat-table-tip-control .baccarat-tip-button {
          position: relative !important;
          display: flex !important;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          width: 100% !important;
          height: 100% !important;
          min-width: 100% !important;
          min-height: 100% !important;
          padding: 0 !important;
          border: 1px solid rgba(243,212,125,.9) !important;
          border-radius: 8px !important;
          background:
            radial-gradient(circle at 50% 15%, rgba(255,229,139,.32), transparent 40%),
            linear-gradient(180deg, #3a2a10, #070605) !important;
          color: #fff4c2 !important;
          cursor: pointer;
          filter: drop-shadow(0 10px 14px rgba(0,0,0,.48)) !important;
          box-shadow:
            inset 0 1px rgba(255,255,255,.14),
            inset 0 0 0 2px rgba(0,0,0,.38),
            0 0 18px rgba(214,173,72,.18) !important;
        }

        .baccarat-felt-table .baccarat-table-tip-control .baccarat-tip-button b,
        .baccarat-felt-table .baccarat-table-tip-control .baccarat-tip-button span {
          position: static;
          width: auto;
          height: auto;
          overflow: visible;
          clip: auto;
          color: inherit;
          line-height: 1;
        }

        .baccarat-felt-table .baccarat-table-tip-control .baccarat-tip-button b {
          font-family: var(--font-display);
          font-size: .9rem;
          font-weight: 900;
          letter-spacing: .08em;
        }

        .baccarat-felt-table .baccarat-table-tip-control .baccarat-tip-button span {
          font-family: var(--font-display);
          font-size: .54rem;
          font-weight: 900;
          letter-spacing: .08em;
        }

        .baccarat-felt-table .baccarat-table-tip-control .baccarat-tip-button:disabled {
          cursor: not-allowed;
          opacity: .58;
          filter: grayscale(.55) brightness(.72) drop-shadow(0 6px 10px rgba(0,0,0,.38));
        }

        .baccarat-game-shell .baccarat-hand-area {
          z-index: 78;
          width: 16%;
          min-width: 140px;
          padding: 7px 8px 9px;
          border: 1px solid rgba(214,173,72,.52);
          border-radius: 10px;
          background:
            radial-gradient(circle at 50% 0%, rgba(214,173,72,.11), transparent 62%),
            linear-gradient(180deg, rgba(2, 17, 10, .9), rgba(1, 7, 4, .78));
          pointer-events: none;
          box-shadow: inset 0 1px rgba(255,255,255,.08), 0 14px 24px rgba(0,0,0,.42);
        }

        .baccarat-game-shell .baccarat-hand-area h2 {
          display: block;
          margin: 0 0 6px;
          color: var(--gold-light);
          font-family: var(--font-display);
          font-size: .72rem;
          font-weight: 900;
          letter-spacing: .16em;
          line-height: 1;
          text-transform: uppercase;
        }

        .baccarat-game-shell .baccarat-hand-area .cards {
          min-height: 64px;
          gap: 5px;
        }

        .baccarat-game-shell .baccarat-hand-area .card {
          position: relative;
          width: 40px;
          height: 60px;
          overflow: hidden;
          padding: 4px;
          border-radius: 3px;
        }

        .baccarat-game-shell .baccarat-hand-area .baccarat-card .rank,
        .baccarat-game-shell .baccarat-hand-area .baccarat-card .bottom {
          position: absolute;
          font-size: .68rem;
          line-height: 1;
        }

        .baccarat-game-shell .baccarat-hand-area .baccarat-card .rank {
          left: 6px;
          top: 6px;
        }

        .baccarat-game-shell .baccarat-hand-area .baccarat-card .bottom {
          right: 6px;
          bottom: 6px;
          align-self: auto;
          transform: rotate(180deg);
        }

        .baccarat-game-shell .baccarat-hand-area .baccarat-card .suit {
          position: absolute;
          left: 50%;
          top: 52%;
          align-self: auto;
          font-size: 1.24rem;
          line-height: 1;
          transform: translate(-50%, -50%);
        }

        .baccarat-card-back {
          border-color: rgba(214,173,72,.86) !important;
        }

        .baccarat-game-shell .baccarat-hand-area .score-pill {
          min-width: 44px;
          width: 44px;
          min-height: 28px;
          margin-top: 4px;
          padding: 4px 8px;
        }

        .baccarat-player-hand {
          left: 35% !important;
          top: 46% !important;
          display: flex !important;
          opacity: 1 !important;
          visibility: visible !important;
          transform: translate(-50%, -50%) !important;
        }

        .baccarat-banker-hand {
          left: 65% !important;
          top: 46% !important;
          display: flex !important;
          opacity: 1 !important;
          visibility: visible !important;
          transform: translate(-50%, -50%) !important;
        }

        .baccarat-bet-zone {
          position: absolute;
          z-index: 26;
          display: grid;
          grid-template-rows: auto auto 1fr;
          place-items: start center;
          overflow: visible;
          padding: 12px 9px 9px;
          border: 1px solid rgba(214,173,72,.72);
          border-radius: 20px;
          background:
            radial-gradient(circle at 50% 18%, rgba(243,212,125,.14), transparent 42%),
            linear-gradient(180deg, rgba(5,52,30,.48), rgba(3,20,12,.18));
          color: var(--gold-light);
          cursor: pointer;
          transform: translate(-50%, -50%);
          transition: border-color .16s ease, background .16s ease, box-shadow .16s ease;
          box-shadow: inset 0 1px rgba(255,255,255,.08), inset 0 0 24px rgba(214,173,72,.06);
        }

        .baccarat-zone-label {
          position: relative;
          z-index: 42;
          color: #f4c65b;
          font-family: var(--font-display);
          font-size: clamp(.78rem, 1.12vw, 1.08rem);
          font-weight: 900;
          letter-spacing: .05em;
          line-height: .95;
          text-transform: uppercase;
          text-shadow: 0 2px 0 rgba(0,0,0,.82), 0 0 16px rgba(214,173,72,.24);
        }

        .baccarat-zone-payout {
          position: relative;
          z-index: 42;
          display: block;
          margin-top: 6px;
          color: #fff0af;
          font-family: var(--font-display);
          font-size: .58rem;
          font-weight: 800;
          letter-spacing: .1em;
          line-height: 1;
          text-transform: uppercase;
          text-shadow: 0 1px 0 rgba(0,0,0,.82);
        }

        .baccarat-bet-zone.has-bet .baccarat-zone-label,
        .baccarat-bet-zone.has-bet .baccarat-zone-payout {
          opacity: 0;
        }

        .baccarat-bet-zone:hover,
        .baccarat-bet-zone:focus-visible {
          border-color: rgba(243,212,125,.92);
          background:
            radial-gradient(circle at 50% 18%, rgba(243,212,125,.2), transparent 42%),
            linear-gradient(180deg, rgba(5,61,34,.58), rgba(3,24,14,.22));
          outline: 0;
          box-shadow: inset 0 1px rgba(255,255,255,.1), inset 0 0 28px rgba(243,212,125,.1), 0 0 0 1px rgba(243,212,125,.08);
        }

        .baccarat-zone-player {
          left: 35%;
          top: 64%;
          width: 18%;
          height: 14.8%;
        }

        .baccarat-zone-tie {
          left: 50%;
          top: 64%;
          width: 8.4%;
          height: 14.8%;
          padding-inline: 6px;
        }

        .baccarat-zone-banker {
          left: 65%;
          top: 64%;
          width: 18%;
          height: 14.8%;
        }

        .baccarat-zone-tie .baccarat-zone-label {
          font-size: clamp(.7rem, .95vw, .92rem);
        }

        .baccarat-spot-chip-stack {
          position: absolute;
          left: 50%;
          top: 48%;
          width: 60px;
          height: 54px;
          z-index: 36;
          pointer-events: none;
          transform: translate(-50%, -50%);
        }

        .baccarat-spot-chip-stack .spot-chip {
          width: 38px;
          height: 38px;
        }

        .baccarat-spot-chip-stack .chip-face-5000 {
          width: 44px;
          height: 44px;
          background-size: 118%;
        }

        .baccarat-zone-amount {
          position: absolute;
          left: 50%;
          top: calc(50% + 34px);
          z-index: 38;
          min-width: 72px;
          padding: 4px 9px;
          border: 1px solid rgba(243,212,125,.64);
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(8,11,9,.96), rgba(2,5,4,.9));
          color: #fff4c2;
          font-family: var(--font-display);
          font-size: .55rem;
          font-style: normal;
          font-weight: 900;
          letter-spacing: .04em;
          line-height: 1;
          text-align: center;
          text-transform: uppercase;
          transform: translateX(-50%);
          box-shadow: 0 10px 18px rgba(0,0,0,.38);
        }

        .baccarat-seat-rail {
          position: absolute;
          inset: 0;
          z-index: 34;
          display: block;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .baccarat-seat {
          position: absolute;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          grid-template-rows: auto auto;
          align-items: center;
          gap: 1px 7px;
          width: clamp(116px, 12.2%, 132px);
          min-width: 116px;
          min-height: 58px;
          padding: 7px 9px;
          border: 1px solid rgba(214,173,72,.18);
          border-radius: 12px;
          background: rgba(3,12,8,.78);
          color: rgba(247,240,215,.56);
          font-family: var(--font-display);
          text-align: left;
          transform: translate(-50%, -50%);
          box-shadow: inset 0 1px rgba(255,255,255,.04), 0 8px 14px rgba(0,0,0,.22);
        }

        .baccarat-seat-1 { left: 18%; top: 68%; }
        .baccarat-seat-2 { left: 30%; top: 78%; }
        .baccarat-seat-3 { left: 43%; top: 84%; }
        .baccarat-seat-4 { left: 57%; top: 84%; }
        .baccarat-seat-5 { left: 70%; top: 78%; }
        .baccarat-seat-6 { left: 82%; top: 68%; }

        .baccarat-seat.is-active {
          border-color: rgba(243,212,125,.56);
          background: linear-gradient(180deg, rgba(29,58,34,.84), rgba(3,20,12,.76));
          color: var(--gold-light);
        }

        .baccarat-seat__avatar {
          grid-column: 1;
          grid-row: 1 / span 2;
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
        }

        .baccarat-seat__avatar > span {
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          border: 1px solid rgba(214,173,72,.2);
          border-radius: 999px;
          background: rgba(255,255,255,.04);
          color: rgba(247,240,215,.42);
          font-size: .58rem;
          font-weight: 900;
        }

        .baccarat-seat__name,
        .baccarat-seat strong,
        .baccarat-seat em {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .baccarat-seat__name {
          grid-column: 2;
          grid-row: 1;
          font-size: .54rem;
          font-weight: 900;
          letter-spacing: .08em;
          line-height: 1;
          text-transform: uppercase;
        }

        .baccarat-seat strong {
          grid-column: 2;
          grid-row: 2;
          margin-top: 2px;
          color: #fff;
          font-family: var(--font-number);
          font-size: .74rem;
          font-weight: 900;
          line-height: 1;
        }

        .baccarat-seat em {
          grid-column: 1 / span 2;
          grid-row: 3;
          margin-top: 4px;
          color: rgba(247,240,215,.54);
          font-family: var(--font-body);
          font-size: .62rem;
          font-style: normal;
          font-weight: 700;
          line-height: 1;
          text-align: center;
        }

        .blackjack-chat-panel.baccarat-chat-panel {
          position: absolute !important;
          right: 20px !important;
          top: auto !important;
          bottom: calc(var(--baccarat-bottom-console-height) + var(--baccarat-chat-console-gap)) !important;
          z-index: 80 !important;
          display: block !important;
          width: 318px !important;
        }

        .baccarat-chat-shell {
          position: relative;
          width: 100%;
        }

        .baccarat-chat-panel .blackjack-chat {
          height: clamp(330px, 43vh, 438px);
        }

        .baccarat-chat-panel .blackjack-chat.is-collapsed {
          height: auto;
        }

        .baccarat-chat-panel .blackjack-chat-header {
          width: 100%;
          cursor: pointer;
          padding-right: 8px;
        }

        .baccarat-chat-toggle {
          position: relative;
          z-index: 3;
          display: inline-grid;
          place-items: center;
          height: 26px;
          min-width: 58px;
          border: 1px solid rgba(214,173,72,.42);
          border-radius: 7px;
          background: rgba(9,11,8,.76);
          color: #fff1b8;
          cursor: pointer;
          font-family: var(--font-display);
          font-size: .62rem;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .baccarat-chat-toggle:hover,
        .baccarat-chat-toggle:focus-visible {
          border-color: rgba(255,222,122,.82);
          color: #fff;
          outline: none;
        }

        .baccarat-chat-panel .blackjack-chat-compose {
          grid-template-columns: auto auto minmax(0, 1fr) auto;
        }

        .baccarat-chat-emoji-popover {
          right: calc(100% + 10px);
          bottom: 0;
          z-index: 90;
          width: min(288px, calc(100vw - 366px));
        }

        .baccarat-chat-emoji-popover[data-kind="vip"] {
          width: min(352px, calc(100vw - 366px));
        }

        .baccarat-chat-emoji-popover > div {
          max-height: min(320px, calc(100svh - 132px));
          overflow-y: auto;
        }

        .baccarat-bottom-console {
          grid-template-columns: minmax(420px, 1fr) auto minmax(260px, 1fr);
          grid-template-rows: 26px 76px;
          min-height: 132px;
          padding: 8px 18px 12px;
        }

        .baccarat-bottom-console .message {
          grid-column: 1;
          grid-row: 1;
        }

        .baccarat-bottom-console .chip-selector {
          grid-column: 1;
          grid-row: 2;
        }

        .baccarat-bottom-console .action-row {
          grid-column: 2;
          grid-row: 1 / span 2;
          justify-self: center;
        }

        .baccarat-bottom-console .round-info {
          grid-column: 3;
          grid-row: 1 / span 2;
          align-self: center;
          justify-self: end;
          width: min(100%, 286px);
        }

        .baccarat-bottom-console .baccarat-round-info {
          grid-template-columns: minmax(156px, 1.2fr) minmax(92px, .8fr);
          grid-template-rows: 34px 42px;
        }

        .baccarat-round-info span,
        .baccarat-round-info strong {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .baccarat-round-info span {
          padding-inline: 6px;
          font-size: .58rem;
          letter-spacing: .08em;
        }

        .baccarat-round-info span:nth-of-type(1) { grid-column: 1; grid-row: 1; }
        .baccarat-round-info span:nth-of-type(2) { grid-column: 2; grid-row: 1; }
        .baccarat-round-info strong:nth-of-type(1) { grid-column: 1; grid-row: 2; }
        .baccarat-round-info strong:nth-of-type(2) { grid-column: 2; grid-row: 2; }

        .baccarat-round-info div {
          grid-row: 1 / span 2;
          border-left: 1px solid rgba(214,173,72,.28);
        }

        .baccarat-round-info div:nth-of-type(1) { grid-column: 2; }

        .baccarat-bottom-console .action-row[data-mode="idle"] {
          display: flex !important;
        }

        .baccarat-bottom-console .action-button:disabled {
          opacity: .46;
        }

        @media (max-width: 1420px) {
          .baccarat-game-shell .topbar {
            left: 0;
            right: 60px;
          }

          .baccarat-game-shell .balance-panel {
            margin-left: 210px;
          }

          .baccarat-title-panel {
            width: 430px;
          }

          .baccarat-game-shell .table-frame {
            padding-left: 196px;
            padding-right: 196px;
          }

          .baccarat-wood-rail {
            width: min(100%, 920px);
          }

          .blackjack-chat-panel.baccarat-chat-panel {
            width: 300px !important;
          }

          .baccarat-bottom-console {
            grid-template-columns: minmax(330px, 1fr) auto minmax(300px, .85fr);
            gap: 8px 12px;
          }
        }

        @media (max-height: 780px) {
          .baccarat-game-shell {
            --baccarat-bottom-console-height: 116px;
            --baccarat-chat-console-gap: 10px;
            grid-template-rows: minmax(0, 1fr) 116px;
          }

          .baccarat-game-shell .topbar {
            top: 8px;
          }

          .baccarat-title-panel {
            min-height: 54px;
            padding: 6px 20px;
          }

          .baccarat-title-panel img {
            width: 52px;
            height: 38px;
          }

          .baccarat-title-panel strong {
            font-size: clamp(1.3rem, 2.2vw, 2rem);
          }

          .baccarat-game-shell .table-frame {
            padding-top: 66px;
          }

          .baccarat-wood-rail {
            max-height: calc(100svh - 126px);
            transform: translateY(4px);
          }

          .baccarat-wood-rail .dealer-portrait {
            top: -27%;
            width: clamp(142px, 8vw, 158px);
          }

          .baccarat-tip-board {
            left: calc(50% - 346px) !important;
            top: -24% !important;
            width: 260px !important;
          }

          .baccarat-tip-board .dealer-tip-row {
            grid-template-columns: 28px minmax(150px, 1fr) auto;
          }

          .baccarat-table-timer {
            left: calc(50% - 346px);
            top: -6%;
            width: 260px;
          }

          .baccarat-road {
            top: 86px;
          }

          .baccarat-chat-panel .blackjack-chat {
            height: clamp(270px, 39vh, 330px);
          }

          .baccarat-chat-panel .blackjack-chat.is-collapsed {
            height: auto;
          }

          .baccarat-chat-emoji-popover {
            width: min(260px, calc(100vw - 334px));
          }

          .baccarat-chat-emoji-popover[data-kind="vip"] {
            width: min(332px, calc(100vw - 334px));
          }

          .baccarat-bottom-console {
            grid-template-rows: 22px 66px;
            min-height: 116px;
            padding-top: 7px;
          }

          .baccarat-bottom-console .chip-selector {
            padding: 8px 12px;
          }

          .baccarat-bottom-console .chip {
            width: 46px;
            height: 46px;
          }

          .baccarat-bottom-console .action-button {
            width: 78px;
            height: 64px;
            min-width: 78px;
            min-height: 64px;
          }
        }

        @media (max-width: 760px) {
          .baccarat-game-shell {
            --baccarat-bottom-console-height: auto;
            height: auto;
            min-height: 100vh;
            grid-template-rows: auto auto auto;
            overflow: visible;
          }

          .baccarat-game-shell .topbar {
            position: relative;
            top: auto;
            left: auto;
            right: auto;
            align-items: center;
            gap: 8px;
            padding: 10px 12px;
          }

          .baccarat-game-shell .balance-panel {
            min-width: 126px;
            margin-left: 0;
            padding: 9px 12px;
          }

          .baccarat-title-panel {
            position: relative;
            left: auto;
            top: auto;
            order: 3;
            width: 100%;
            min-height: 52px;
            padding: 7px 12px;
            gap: 10px;
            transform: none;
          }

          .baccarat-title-panel img {
            width: 46px;
            height: 34px;
          }

          .baccarat-title-panel strong {
            font-size: clamp(1.08rem, 6vw, 1.58rem);
            letter-spacing: .06em;
            white-space: normal;
          }

          .baccarat-game-shell .utility-buttons {
            order: 2;
            width: 100%;
            align-items: center;
            gap: 6px;
            overflow-x: auto;
            padding-bottom: 2px;
            scrollbar-width: none;
          }

          .baccarat-game-shell .utility-buttons::-webkit-scrollbar {
            display: none;
          }

          .baccarat-game-shell .utility-buttons .table-status-button {
            min-height: 38px;
            padding-inline: 12px;
            font-size: .68rem;
          }

          .baccarat-game-shell .utility-button,
          .baccarat-game-shell .table-status-button.is-cashout {
            width: 38px;
            min-width: 38px;
            height: 38px;
            min-height: 38px;
          }

          .baccarat-game-shell .table-frame {
            display: block;
            padding: 0;
            overflow: hidden;
          }

          .baccarat-road {
            position: relative;
            left: auto;
            top: auto;
            width: calc(100% - 24px);
            max-width: 440px;
            max-height: none;
            margin: 10px auto 8px;
          }

          .baccarat-road__grid {
            display: flex;
            gap: 5px;
            overflow-x: auto;
            padding-bottom: 2px;
            scrollbar-width: none;
          }

          .baccarat-road__grid::-webkit-scrollbar {
            display: none;
          }

          .baccarat-road__cell {
            flex: 0 0 22px;
          }

          .baccarat-wood-rail {
            width: 1000px;
            max-width: 1000px;
            max-height: none;
            margin: 0 auto -300px;
            transform: scale(.58);
            transform-origin: top center;
          }

          .baccarat-wood-rail .dealer-portrait {
            top: -28%;
            width: 145px;
          }

          .baccarat-wood-rail .dealer-speech {
            left: 50%;
            top: -7%;
            width: min(310px, 54%);
            min-height: 38px;
            padding: 8px 12px;
            font-size: .68rem;
            line-height: 1.16;
            transform: translateX(-50%);
          }

          .baccarat-tip-board {
            display: none !important;
          }

          .baccarat-table-timer {
            left: 50%;
            top: -14%;
            width: 210px;
            min-height: 40px;
            padding: 7px 10px;
            transform: translateX(-50%);
          }

          .baccarat-table-timer span {
            font-size: .54rem;
          }

          .baccarat-table-timer strong {
            font-size: 1rem;
          }

          .baccarat-result-ribbon {
            top: 18%;
            width: 48%;
            min-width: 320px;
            padding: 7px 14px 8px;
          }

          .baccarat-result-ribbon span {
            font-size: .48rem;
          }

          .baccarat-result-ribbon strong {
            font-size: .72rem;
          }

          .baccarat-felt-table .baccarat-table-tip-control {
            width: 86px !important;
            height: 46px !important;
            min-width: 86px !important;
            min-height: 46px !important;
          }

          .baccarat-felt-table .baccarat-table-tip-control .baccarat-tip-button b {
            font-size: .72rem;
          }

          .baccarat-felt-table .baccarat-table-tip-control .baccarat-tip-button span {
            font-size: .45rem;
          }

          .baccarat-game-shell .baccarat-hand-area {
            min-width: 112px;
            padding: 6px;
          }

          .baccarat-game-shell .baccarat-hand-area h2 {
            font-size: .58rem;
          }

          .baccarat-game-shell .baccarat-hand-area .cards {
            min-height: 54px;
            gap: 4px;
          }

          .baccarat-game-shell .baccarat-hand-area .card {
            width: 34px;
            height: 51px;
          }

          .baccarat-zone-label {
            font-size: .74rem;
          }

          .baccarat-zone-payout {
            font-size: .48rem;
          }

          .baccarat-seat {
            width: 104px;
            min-width: 104px;
            min-height: 48px;
            padding: 6px 7px;
            gap: 1px 5px;
          }

          .baccarat-seat__avatar {
            width: 28px;
            height: 28px;
          }

          .baccarat-seat__avatar > span {
            width: 25px;
            height: 25px;
          }

          .baccarat-seat__name {
            font-size: .46rem;
          }

          .baccarat-seat strong {
            font-size: .62rem;
          }

          .baccarat-seat em {
            display: none;
          }

          .blackjack-chat-panel.baccarat-chat-panel {
            position: relative !important;
            right: auto !important;
            bottom: auto !important;
            width: calc(100% - 24px) !important;
            margin: 8px auto 12px;
          }

          .baccarat-chat-panel .blackjack-chat {
            height: auto;
            max-height: 288px;
          }

          .baccarat-chat-emoji-popover,
          .baccarat-chat-emoji-popover[data-kind="vip"] {
            left: 0;
            right: auto;
            bottom: 52px;
            width: min(330px, calc(100vw - 24px));
          }

          .baccarat-bottom-console {
            position: relative;
            left: auto;
            right: auto;
            bottom: auto;
            display: grid;
            grid-template-columns: 1fr;
            grid-template-rows: auto auto auto auto;
            gap: 9px;
            min-height: 0;
            margin: 0 12px 16px;
            padding: 10px;
            border-radius: 16px;
          }

          .baccarat-bottom-console .message,
          .baccarat-bottom-console .chip-selector,
          .baccarat-bottom-console .action-row,
          .baccarat-bottom-console .round-info {
            grid-column: 1;
            grid-row: auto;
            justify-self: stretch;
          }

          .baccarat-bottom-console .message {
            min-height: 22px;
            white-space: normal;
            text-align: center;
          }

          .baccarat-bottom-console .chip-selector {
            justify-content: flex-start;
            overflow-x: auto;
            padding: 8px;
            scrollbar-width: none;
          }

          .baccarat-bottom-console .chip-selector::-webkit-scrollbar {
            display: none;
          }

          .baccarat-bottom-console .chip {
            width: 52px;
            height: 52px;
            min-width: 52px;
          }

          .baccarat-bottom-console .action-row {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 7px;
          }

          .baccarat-bottom-console .action-button {
            width: 100%;
            min-width: 0;
            height: 58px;
            min-height: 58px;
          }

          .baccarat-bottom-console .round-info {
            width: 100%;
          }
        }

        @media (max-width: 940px) and (max-height: 430px) and (orientation: landscape) {
          html,
          body {
            height: 100%;
            overflow: hidden;
          }

          .baccarat-game-shell {
            height: 100svh;
            min-height: 0;
            display: block;
            overflow: hidden;
          }

          .baccarat-game-shell .topbar {
            position: fixed;
            top: 7px;
            left: 10px;
            right: 10px;
            z-index: 90;
            height: 38px;
            padding: 0;
            align-items: center;
          }

          .baccarat-game-shell .balance-panel {
            min-width: 96px;
            margin-left: 0;
            padding: 5px 8px;
            border-radius: 10px;
          }

          .baccarat-game-shell .balance-panel span {
            font-size: .46rem;
            letter-spacing: .12em;
          }

          .baccarat-game-shell .balance-panel strong {
            margin-top: 1px;
            font-size: .9rem;
            line-height: 1;
          }

          .baccarat-title-panel {
            left: 50%;
            top: 0;
            order: initial;
            width: 236px;
            min-height: 38px;
            padding: 4px 10px;
            gap: 7px;
            transform: translateX(-50%);
          }

          .baccarat-title-panel img {
            width: 32px;
            height: 24px;
          }

          .baccarat-title-panel strong {
            font-size: .92rem;
            letter-spacing: .08em;
            white-space: nowrap;
          }

          .baccarat-game-shell .utility-buttons {
            position: fixed;
            right: 10px;
            top: 9px;
            width: auto;
            height: 34px;
            align-items: center;
            gap: 5px;
            overflow: visible;
          }

          .baccarat-game-shell .utility-buttons .table-status-button {
            min-height: 34px;
            height: 34px;
            padding-inline: 9px;
            border-radius: 10px;
            font-size: .54rem;
          }

          .baccarat-game-shell .utility-button,
          .baccarat-game-shell .table-status-button.is-cashout {
            width: 34px;
            min-width: 34px;
            height: 34px;
            min-height: 34px;
            border-radius: 10px;
          }

          .baccarat-game-shell .table-frame {
            position: absolute;
            inset: 0;
            display: block;
            padding: 0;
            overflow: hidden;
          }

          .baccarat-road,
          .baccarat-tip-board,
          .blackjack-chat-panel.baccarat-chat-panel {
            display: none !important;
          }

          .baccarat-wood-rail {
            position: absolute;
            left: 50%;
            top: 52%;
            width: min(72vw, 660px);
            max-width: 660px;
            max-height: none;
            margin: 0;
            transform: translate(-50%, -50%);
            transform-origin: center;
            filter: drop-shadow(0 12px 18px rgba(0,0,0,.52));
          }

          .baccarat-wood-rail .dealer-portrait {
            top: -17%;
            width: clamp(76px, 9vw, 92px);
          }

          .baccarat-wood-rail .dealer-speech {
            left: 50%;
            top: 5%;
            z-index: 34;
            width: min(300px, 48vw);
            min-height: 30px;
            padding: 6px 10px;
            font-size: .58rem;
            line-height: 1.14;
            transform: translateX(-50%);
          }

          .baccarat-table-timer {
            left: calc(50% - 118px);
            top: 23%;
            z-index: 42;
            display: grid;
            width: 60px;
            min-height: 30px;
            padding: 4px 7px;
            border-radius: 999px;
            transform: translateY(-50%);
          }

          .baccarat-table-timer span {
            display: none;
          }

          .baccarat-table-timer strong {
            font-size: .9rem;
          }

          .baccarat-felt-table .baccarat-table-tip-control {
            left: calc(50% + 84px) !important;
            top: 23% !important;
            width: 64px !important;
            height: 34px !important;
            min-width: 64px !important;
            min-height: 34px !important;
          }

          .baccarat-felt-table .baccarat-table-tip-control .baccarat-tip-button {
            border-radius: 10px !important;
          }

          .baccarat-felt-table .baccarat-table-tip-control .baccarat-tip-button b {
            font-size: .58rem;
          }

          .baccarat-felt-table .baccarat-table-tip-control .baccarat-tip-button span {
            font-size: .44rem;
          }

          .baccarat-result-ribbon {
            top: 19%;
            width: min(330px, 48%);
            min-width: 210px;
            padding: 5px 10px 6px;
          }

          .baccarat-result-ribbon span {
            display: none;
          }

          .baccarat-result-ribbon strong {
            margin-top: 0;
            font-size: .58rem;
            line-height: 1.08;
          }

          .baccarat-game-shell .baccarat-hand-area {
            min-width: 76px;
            padding: 4px;
            border-radius: 8px;
          }

          .baccarat-game-shell .baccarat-hand-area h2 {
            margin-bottom: 4px;
            font-size: .48rem;
            letter-spacing: .1em;
          }

          .baccarat-game-shell .baccarat-hand-area .cards {
            min-height: 38px;
            gap: 3px;
          }

          .baccarat-game-shell .baccarat-hand-area .card {
            width: 26px;
            height: 39px;
            padding: 3px;
            border-radius: 5px;
          }

          .baccarat-game-shell .baccarat-hand-area .baccarat-card .rank,
          .baccarat-game-shell .baccarat-hand-area .baccarat-card .bottom {
            font-size: .5rem;
          }

          .baccarat-game-shell .baccarat-hand-area .baccarat-card .suit {
            font-size: .84rem;
          }

          .baccarat-game-shell .baccarat-hand-area .score-pill {
            width: 34px;
            min-width: 34px;
            min-height: 20px;
            padding: 3px 5px;
            font-size: .62rem;
          }

          .baccarat-bet-zone {
            border-radius: 12px;
            padding: 6px 5px;
          }

          .baccarat-zone-label {
            font-size: .54rem;
          }

          .baccarat-zone-payout {
            margin-top: 3px;
            font-size: .38rem;
            letter-spacing: .06em;
          }

          .baccarat-spot-chip-stack {
            width: 38px;
            height: 34px;
          }

          .baccarat-spot-chip-stack .spot-chip {
            width: 26px;
            height: 26px;
          }

          .baccarat-zone-amount {
            top: calc(50% + 22px);
            min-width: 48px;
            padding: 3px 6px;
            font-size: .42rem;
          }

          .baccarat-seat {
            width: 76px;
            min-width: 76px;
            min-height: 32px;
            padding: 4px 5px;
            border-radius: 9px;
            gap: 0 4px;
          }

          .baccarat-seat__avatar {
            width: 22px;
            height: 22px;
          }

          .baccarat-seat__avatar > span {
            width: 20px;
            height: 20px;
          }

          .baccarat-seat__name {
            font-size: .38rem;
            letter-spacing: .04em;
          }

          .baccarat-seat strong {
            font-size: .48rem;
          }

          .baccarat-seat em {
            display: none;
          }

          .baccarat-bottom-console {
            position: absolute;
            left: 76px;
            right: 76px;
            bottom: 8px;
            z-index: 76;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            width: auto;
            min-height: 0;
            margin: 0;
            padding: 6px;
            border-radius: 16px;
          }

          .baccarat-bottom-console .message {
            flex: 1 1 auto;
            width: auto;
            min-width: 0;
            max-width: 320px;
            font-size: .58rem;
            line-height: 1.1;
            overflow: hidden;
            text-align: center;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .baccarat-bottom-console .round-info {
            display: none;
          }

          .baccarat-bottom-console .chip-selector {
            position: fixed;
            left: 12px;
            top: 58px;
            z-index: 86;
            display: flex;
            flex-direction: column;
            gap: 4px;
            width: auto;
            max-height: calc(100svh - 72px);
            padding: 4px;
            overflow-y: auto;
            scrollbar-width: none;
          }

          .baccarat-bottom-console .chip-selector::-webkit-scrollbar {
            display: none;
          }

          .baccarat-bottom-console .chip-selector:not(:has(.chip:not(:disabled))) {
            display: none;
          }

          .baccarat-bottom-console .chip {
            width: 42px;
            height: 42px;
            min-width: 42px;
          }

          .baccarat-bottom-console .action-row {
            position: fixed;
            right: 12px;
            top: 50%;
            z-index: 86;
            display: flex !important;
            flex-direction: column;
            gap: 4px;
            transform: translateY(-50%);
          }

          .baccarat-bottom-console .action-row:not(:has(.action-button:not(:disabled))),
          .baccarat-bottom-console .action-row[data-mode="idle"] {
            display: none !important;
          }

          .baccarat-bottom-console .action-button {
            width: 58px;
            min-width: 58px;
            height: 42px;
            min-height: 42px;
            border-radius: 10px;
          }

          .baccarat-bottom-console .action-button b {
            font-size: .56rem;
          }

          .baccarat-bottom-console .action-button span {
            font-size: .38rem;
          }
        }
      `}</style>
    </>
  )
}
