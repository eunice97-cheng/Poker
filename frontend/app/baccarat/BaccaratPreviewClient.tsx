'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { ChatEmojiTray } from '@/components/ui/ChatEmojiTray'
import { ChatMessageText } from '@/components/ui/ChatMessageText'
import { ExitIcon } from '@/components/ui/ExitIcon'
import { AvatarDisplay } from '@/components/ui/AvatarDisplay'
import { appendChatEmojiCode } from '@/lib/chat-emojis'
import { useAudio } from '@/hooks/useAudio'
import type { ChatMessage } from '@/types/poker'

type Suit = 'S' | 'H' | 'D' | 'C'
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
type BetKey = 'dealer' | 'tie' | 'banker'
type Winner = BetKey
type DealerPortraitKey = 'normal' | 'smiling' | 'blinking'

type BaccaratCard = {
  rank: Rank
  suit: Suit
}

type Bets = Record<BetKey, number>

type RoadItem = {
  id: number
  winner: Winner
  dealerTotal: number
  bankerTotal: number
  natural: boolean
}

type RoundResult = RoadItem & {
  dealerCards: BaccaratCard[]
  bankerCards: BaccaratCard[]
  net: number
  label: string
}

type BaccaratPreviewClientProps = {
  username: string
  chipBalance: number
}

const BLACKJACK_STYLESHEET = '/blackjack/styles.css?v=20260724-42'
const SUITS: Suit[] = ['S', 'H', 'D', 'C']
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
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
const EMPTY_BETS: Bets = { dealer: 0, tie: 0, banker: 0 }
const MAX_CHAT_LENGTH = 200
const DEALER_TIP_AMOUNT = 10
const BLINK_DELAY_RANGE_MS = [2000, 10000] as const
const BLINK_DURATION_RANGE_MS = [100, 400] as const
const SMILE_SWITCH_RANGE_MS = [5000, 25000] as const
const DEALER_PORTRAITS: Record<DealerPortraitKey, string> = {
  normal: '/blackjack/Images/Dealers/Eunice4.png',
  smiling: '/blackjack/Images/Dealers/Eunice4%20-%20smiling.png',
  blinking: '/blackjack/Images/Dealers/Eunice4%20-%20blinking.png',
}
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

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function randomMs([min, max]: readonly [number, number]) {
  return Math.round(min + Math.random() * (max - min))
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

function shouldBankerDraw(bankerTotal: number, dealerThirdCard: BaccaratCard | null) {
  if (!dealerThirdCard) return bankerTotal <= 5

  const dealerThirdValue = baccaratValue(dealerThirdCard)
  if (bankerTotal <= 2) return true
  if (bankerTotal === 3) return dealerThirdValue !== 8
  if (bankerTotal === 4) return dealerThirdValue >= 2 && dealerThirdValue <= 7
  if (bankerTotal === 5) return dealerThirdValue >= 4 && dealerThirdValue <= 7
  if (bankerTotal === 6) return dealerThirdValue === 6 || dealerThirdValue === 7
  return false
}

function totalBets(bets: Bets) {
  return bets.dealer + bets.tie + bets.banker
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

  return faces.length > 0 ? faces : [10]
}

function resolveRound(shoe: BaccaratCard[], bets: Bets, roundId: number) {
  const workingShoe = shoe.length < 60 ? createShoe() : [...shoe]
  const draw = () => {
    const card = workingShoe.pop()
    if (!card) throw new Error('Baccarat shoe is empty')
    return card
  }

  const dealerCards = [draw(), draw()]
  const bankerCards = [draw(), draw()]
  let dealerTotal = handTotal(dealerCards)
  let bankerTotal = handTotal(bankerCards)
  const natural = dealerTotal >= 8 || bankerTotal >= 8
  let dealerThirdCard: BaccaratCard | null = null

  if (!natural) {
    if (dealerTotal <= 5) {
      dealerThirdCard = draw()
      dealerCards.push(dealerThirdCard)
      dealerTotal = handTotal(dealerCards)
    }

    if (shouldBankerDraw(bankerTotal, dealerThirdCard)) {
      bankerCards.push(draw())
      bankerTotal = handTotal(bankerCards)
    }
  }

  const winner: Winner = dealerTotal > bankerTotal ? 'dealer' : bankerTotal > dealerTotal ? 'banker' : 'tie'
  const stake = totalBets(bets)
  let returns = 0

  if (winner === 'dealer') returns += bets.dealer * 2
  if (winner === 'banker') returns += bets.banker + Math.floor(bets.banker * 0.95)
  if (winner === 'tie') {
    returns += bets.tie * 9
    returns += bets.dealer + bets.banker
  }

  const label = winner === 'dealer' ? 'Dealer wins' : winner === 'banker' ? 'Banker wins' : 'Tie hand'

  return {
    nextShoe: workingShoe,
    returns,
    result: {
      id: roundId,
      winner,
      dealerCards,
      bankerCards,
      dealerTotal,
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
    <div className={classNames('card', isRed && 'red')}>
      <span className="rank">{card.rank}</span>
      <span className="suit">{SUIT_SYMBOLS[card.suit]}</span>
      <span className="bottom">{card.rank}</span>
    </div>
  )
}

function CardBack() {
  return <div className="card card-back" aria-hidden="true" />
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
      <strong>{money(amount)}</strong>
    </span>
  )
}

function TableBetZone({
  label,
  amount,
  className,
  onClick,
}: {
  label: string
  amount: number
  className: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={classNames('baccarat-bet-zone', className)}
      aria-label={`Bet on ${label}`}
      title={`Bet on ${label}`}
      onClick={onClick}
    >
      <span>{label}</span>
      <BetChipStack amount={amount} />
      {amount > 0 && <em className="baccarat-zone-amount">{label} {money(amount)}</em>}
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
              {item.winner === 'dealer' ? 'D' : item.winner === 'banker' ? 'B' : 'T'}
            </span>
          )
        })}
      </div>
    </aside>
  )
}

function DealerTipBoard({ total }: { total: number }) {
  return (
    <aside className="dealer-tip-board baccarat-tip-board" aria-label="Dealer tip ranking">
      <header className="dealer-tip-board__header">
        <span>Dealer Support</span>
        <strong>{money(total)}</strong>
      </header>
      <ol className="dealer-tip-board__list">
        <li className="dealer-tip-row is-leading is-active">
          <span className="dealer-tip-row__rank">01</span>
          <span className="dealer-tip-row__name">Dealer Eunice</span>
          <span className="dealer-tip-row__label">Total Tip Received</span>
          <strong>{money(total)}</strong>
        </li>
      </ol>
    </aside>
  )
}

function BaccaratSeatRail({ username, stake }: { username: string; stake: number }) {
  const seats = Array.from({ length: 6 }, (_, index) => ({
    id: index + 1,
    label: index === 0 ? username : `Seat ${index + 1}`,
    stake: index === 0 ? stake : 0,
    active: index === 0,
  }))

  return (
    <div className="baccarat-seat-rail" aria-label="Baccarat seats">
      {seats.map((seat) => (
        <div key={seat.id} className={classNames('baccarat-seat', seat.active && 'is-active')}>
          <span className="baccarat-seat__avatar">
            {seat.active ? (
              <AvatarDisplay avatarId="avatar_gm" size="sm" className="!h-8 !w-8 !rounded-full !border-[#d6ad48]/70" />
            ) : (
              <span aria-hidden="true" />
            )}
          </span>
          <span className="baccarat-seat__name">{seat.label}</span>
          <strong>{seat.stake > 0 ? `BET ${money(seat.stake)}` : seat.active ? 'BET 0' : 'OPEN'}</strong>
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
            <span>8-DECK SHOE</span>
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
              <li>Bet on Dealer, Banker, or Tie.</li>
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
            <h3>Dealer</h3>
            <ul>
              <li>Dealer draws a third card on totals 0-5.</li>
              <li>Dealer stands on totals 6 or 7.</li>
              <li>Dealer wins pay 1:1.</li>
            </ul>
          </section>
          <section className="rules-block">
            <h3>Banker</h3>
            <ul>
              <li>Banker drawing follows the standard third-card table.</li>
              <li>Banker wins pay 0.95:1 after commission.</li>
              <li>Preview commission is shown in the bottom console.</li>
            </ul>
          </section>
          <section className="rules-block">
            <h3>Tie</h3>
            <ul>
              <li>Tie wins pay 8:1.</li>
              <li>Dealer and Banker bets push on a tie.</li>
              <li>The bead plate records D, B, or T results.</li>
            </ul>
          </section>
        </div>
      </article>
    </section>
  )
}

export function BaccaratPreviewClient({ username, chipBalance }: BaccaratPreviewClientProps) {
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
  const [shoe, setShoe] = useState(() => createShoe())
  const [selectedChip, setSelectedChip] = useState(100)
  const [stack, setStack] = useState(() => Math.max(1000, Math.floor(chipBalance)))
  const [bets, setBets] = useState<Bets>(EMPTY_BETS)
  const [lastBets, setLastBets] = useState<Bets>(EMPTY_BETS)
  const [road, setRoad] = useState<RoadItem[]>([])
  const [result, setResult] = useState<RoundResult | null>(null)
  const [dealing, setDealing] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [dealerPortrait, setDealerPortrait] = useState<DealerPortraitKey>('normal')
  const [dealerTipTotal, setDealerTipTotal] = useState(0)
  const [tipVisible, setTipVisible] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const tipTimeoutRef = useRef<number | null>(null)

  const currentStake = totalBets(bets)
  const lastStake = totalBets(lastBets)
  const canDeal = currentStake > 0 && !dealing
  const canTipDealer = stack >= DEALER_TIP_AMOUNT
  const myPlayerId = 'baccarat-preview-gm'
  const bgmEffectivelyMuted = musicMute || musicVol === 0
  const sfxEffectivelyMuted = sfxMute || sfxVol === 0

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

  const dealerLine = useMemo(() => {
    if (dealing) return 'No more bets.'
    if (currentStake > 0) return `${money(currentStake)} on the layout.`
    return 'Place your bets, please.'
  }, [currentStake, dealing])

  const resultLine = result
    ? `${result.label} / ${result.dealerTotal}-${result.bankerTotal} / ${signedMoney(result.net)}`
    : 'No result yet'

  const displayMessage = dealing ? 'Cards are in motion.' : resultLine

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

  const handleTip = () => {
    if (!canTipDealer) return
    setStack((current) => current - DEALER_TIP_AMOUNT)
    setDealerTipTotal((current) => current + DEALER_TIP_AMOUNT)
    setTipVisible(true)
    if (tipTimeoutRef.current) window.clearTimeout(tipTimeoutRef.current)
    tipTimeoutRef.current = window.setTimeout(() => setTipVisible(false), 1600)
  }

  const placeBet = (key: BetKey) => {
    if (dealing || stack < selectedChip) return
    setStack((current) => current - selectedChip)
    setBets((current) => ({ ...current, [key]: current[key] + selectedChip }))
  }

  const clearBets = () => {
    if (dealing || currentStake <= 0) return
    setStack((current) => current + currentStake)
    setBets(EMPTY_BETS)
  }

  const rebet = () => {
    if (dealing || lastStake <= 0) return
    const available = stack + currentStake
    if (available < lastStake) return

    setStack(available - lastStake)
    setBets(lastBets)
  }

  const doubleBets = () => {
    if (dealing || currentStake <= 0 || stack < currentStake) return
    setStack((current) => current - currentStake)
    setBets((current) => ({
      dealer: current.dealer * 2,
      tie: current.tie * 2,
      banker: current.banker * 2,
    }))
  }

  const dealPreviewRound = () => {
    if (!canDeal) return

    setDealing(true)
    window.setTimeout(() => {
      const nextId = road.length + 1
      const resolved = resolveRound(shoe, bets, nextId)

      setShoe(resolved.nextShoe)
      setStack((current) => current + resolved.returns)
      setLastBets(bets)
      setBets(EMPTY_BETS)
      setResult(resolved.result)
      setRoad((current) => [...current.slice(-41), {
        id: resolved.result.id,
        winner: resolved.result.winner,
        dealerTotal: resolved.result.dealerTotal,
        bankerTotal: resolved.result.bankerTotal,
        natural: resolved.result.natural,
      }])
      setDealing(false)
    }, 420)
  }

  const sendChat = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    setChatMessages((current) => [
      ...current.slice(-30),
      {
        playerId: myPlayerId,
        username,
        avatar: 'avatar_gm',
        text: trimmed,
        timestamp: new Date().toISOString(),
      },
    ])
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
              <strong>BACCARAT SALON</strong>
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
            <button type="button" className="table-status-button baccarat-tip-top-button" disabled={!canTipDealer} onClick={handleTip}>
              Tip Dealer
            </button>
            <button type="button" className="table-status-button" disabled>
              Stand
            </button>
            <button type="button" className="table-status-button" disabled>
              Sit
            </button>
            <TopbarLink href="/">Main Lobby</TopbarLink>
            <TopbarLink href="/gm">GM</TopbarLink>
            <Link
              href="/"
              className="table-status-button is-cashout"
              aria-label="Cash out and leave Baccarat table"
              title="Cash out"
            >
              <ExitIcon className="cashout-icon" />
            </Link>
          </nav>
        </header>

        <section className="table-frame baccarat-table-frame">
          <RoadPanel road={road} />

          <div className="wood-rail baccarat-wood-rail">
            <img
              id="dealerPortrait"
              className="dealer-portrait"
              src={DEALER_PORTRAITS[dealerPortrait]}
              alt=""
              aria-hidden="true"
            />
            <div className="dealer-speech" id="dealerSpeech" aria-live="polite">{dealerLine}</div>
            <DealerTipBoard total={dealerTipTotal} />
            <div className="round-countdown" id="roundCountdown" aria-live="polite">
              <span>SHOE</span>
              <strong>{shoe.length}</strong>
            </div>

            <div className="felt-table baccarat-felt-table">
              <img className="baccarat-table-image" src="/baccarat/Images/baccarat-table.png" alt="" aria-hidden="true" />
              <div className="tip-control table-tip-control baccarat-table-tip-control">
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
                  <img src="/blackjack/Images/Dealers/thank%20you.png" alt="" aria-hidden="true" />
                  <span>Thank you for the tip!</span>
                </div>
              </div>
              <div className="baccarat-result-ribbon" aria-live="polite">
                <span>{result?.natural ? 'NATURAL CHECKED' : 'TABLE CALL'}</span>
                <strong>{dealing ? 'No more bets' : resultLine}</strong>
              </div>
              <div className="baccarat-table-label baccarat-table-label-dealer" aria-hidden="true">
                <strong>DEALER</strong>
                <span>1 TO 1</span>
              </div>

              <HandArea
                label="Dealer"
                cards={result?.dealerCards ?? []}
                total={result?.dealerTotal ?? null}
                className="baccarat-dealer-hand"
              />
              <HandArea
                label="Banker"
                cards={result?.bankerCards ?? []}
                total={result?.bankerTotal ?? null}
                className="baccarat-banker-hand"
              />

              <TableBetZone label="Dealer" amount={bets.dealer} className="baccarat-zone-dealer" onClick={() => placeBet('dealer')} />
              <TableBetZone label="Tie" amount={bets.tie} className="baccarat-zone-tie" onClick={() => placeBet('tie')} />
              <TableBetZone label="Banker" amount={bets.banker} className="baccarat-zone-banker" onClick={() => placeBet('banker')} />
              <BaccaratSeatRail username={username} stake={currentStake} />
            </div>
          </div>
        </section>

        <div className="blackjack-chat-panel baccarat-chat-panel">
          <BaccaratTableChat
            messages={chatMessages}
            onSend={sendChat}
            myPlayerId={myPlayerId}
            hasVipEmojis={false}
          />
        </div>

        <section className="bottom-console baccarat-bottom-console">
          <div className="message" id="message">{displayMessage}</div>

          <aside className="round-info" aria-label="Round totals">
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
                disabled={dealing || stack < value}
                onClick={() => setSelectedChip(value)}
              >
                <span>{value}</span>
              </button>
            ))}
          </div>

          <div className="action-row baccarat-action-row" data-mode={currentStake > 0 ? 'betting' : 'idle'}>
            <button type="button" id="undoBtn" className="secondary action-button" disabled={lastStake <= 0 || dealing || stack + currentStake < lastStake} onClick={rebet} aria-label="Rebet">
              <b>Rebet</b>
              <span>REBET</span>
            </button>
            <button type="button" id="clearBtn" className="secondary action-button" disabled={currentStake <= 0 || dealing} onClick={clearBets} aria-label="Clear bet">
              <b>Clear</b>
              <span>CLEAR BET</span>
            </button>
            <button type="button" id="doubleBtn" className="action-button" disabled={currentStake <= 0 || dealing || stack < currentStake} onClick={doubleBets}>
              <b>Double</b>
              <span>DOUBLE</span>
            </button>
            <button type="button" id="dealBtn" className="action-button" disabled={!canDeal} onClick={dealPreviewRound}>
              <b>{dealing ? 'Dealing' : 'Deal'}</b>
              <span>DEAL</span>
            </button>
          </div>

        </section>
      </main>

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />

      <style jsx global>{`
        .baccarat-game-shell {
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
          gap: 14px;
          width: min(650px, 43vw);
          min-height: 74px;
          padding: 9px 18px 10px;
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

        .baccarat-tip-top-button {
          min-width: 104px;
          border-color: rgba(243,212,125,.72);
          color: #fff4c2;
        }

        .baccarat-game-shell .utility-button,
        .baccarat-game-shell .table-status-button.is-cashout {
          width: 42px;
          min-width: 42px;
          height: 42px;
          min-height: 42px;
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

        .baccarat-road__cell.is-dealer {
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
          width: min(100%, 1090px);
          max-height: calc(100svh - 144px);
          align-self: end;
          transform: translateY(6px);
        }

        .baccarat-wood-rail .dealer-portrait {
          top: -20%;
          width: clamp(192px, 12.2vw, 226px);
          z-index: 5;
        }

        .baccarat-wood-rail .dealer-speech {
          left: calc(50% + 142px);
          top: -8%;
        }

        .baccarat-tip-board {
          left: 6%;
          top: 12%;
          z-index: 24;
          width: 218px;
        }

        .baccarat-wood-rail .round-countdown {
          left: calc(50% - 328px);
          top: -7%;
        }

        .baccarat-felt-table {
          background: none;
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
          top: 17%;
          z-index: 18;
          min-width: min(420px, 48%);
          max-width: 560px;
          padding: 10px 18px 12px;
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
          overflow: hidden;
          color: #fff;
          font-family: var(--font-display);
          font-size: clamp(.92rem, 1.25vw, 1.18rem);
          font-weight: 900;
          line-height: 1.08;
          text-overflow: ellipsis;
          text-shadow: 0 1px 0 rgba(0,0,0,.75);
          white-space: nowrap;
        }

        .baccarat-table-tip-control {
          left: 25.8%;
          top: 36.5%;
          z-index: 25;
        }

        .baccarat-table-label {
          position: absolute;
          z-index: 12;
          display: grid;
          place-items: center;
          min-width: 156px;
          min-height: 72px;
          padding: 8px 18px;
          border-radius: 999px;
          background:
            radial-gradient(ellipse at 50% 55%, rgba(8,73,40,.96), rgba(8,73,40,.72) 48%, rgba(8,73,40,.18) 72%, transparent 100%);
          color: var(--gold-light);
          font-family: var(--font-display);
          text-align: center;
          pointer-events: none;
          text-shadow: 0 2px 0 rgba(0,0,0,.85);
        }

        .baccarat-table-label strong {
          display: block;
          font-size: 1.35rem;
          font-weight: 900;
          letter-spacing: .09em;
          line-height: 1;
        }

        .baccarat-table-label span {
          display: block;
          margin-top: 6px;
          color: #fff0af;
          font-size: .78rem;
          font-weight: 800;
          letter-spacing: .1em;
          line-height: 1;
        }

        .baccarat-table-label-dealer {
          left: 33%;
          top: 62%;
          transform: translate(-50%, -50%);
        }

        .baccarat-game-shell .baccarat-hand-area {
          z-index: 32;
          width: 24%;
          min-width: 205px;
          padding: 9px 10px 10px;
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
          font-size: .7rem;
          font-weight: 900;
          letter-spacing: .16em;
          line-height: 1;
          text-transform: uppercase;
        }

        .baccarat-game-shell .baccarat-hand-area .cards {
          min-height: 82px;
          gap: 8px;
        }

        .baccarat-game-shell .baccarat-hand-area .card {
          width: 50px;
          height: 75px;
          border-radius: 7px;
        }

        .baccarat-game-shell .baccarat-hand-area .score-pill {
          min-width: 44px;
          width: 44px;
          min-height: 28px;
          margin-top: 4px;
          padding: 4px 8px;
        }

        .baccarat-dealer-hand {
          left: 30%;
          top: 35.5%;
        }

        .baccarat-banker-hand {
          left: 70%;
          top: 35.5%;
        }

        .baccarat-bet-zone {
          position: absolute;
          z-index: 26;
          display: grid;
          place-items: center;
          border: 1px solid transparent;
          border-radius: 22px;
          background: rgba(255,255,255,0);
          color: transparent;
          cursor: pointer;
          transition: border-color .16s ease, background .16s ease, box-shadow .16s ease;
        }

        .baccarat-bet-zone span {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip: rect(0 0 0 0);
        }

        .baccarat-bet-zone:hover,
        .baccarat-bet-zone:focus-visible {
          border-color: rgba(243,212,125,.68);
          background: rgba(255,255,255,.035);
          outline: 0;
          box-shadow: inset 0 0 24px rgba(243,212,125,.08);
        }

        .baccarat-zone-dealer {
          left: 19.5%;
          top: 52%;
          width: 27%;
          height: 25%;
        }

        .baccarat-zone-tie {
          left: 43%;
          top: 52%;
          width: 14%;
          height: 25%;
        }

        .baccarat-zone-banker {
          right: 19.5%;
          top: 52%;
          width: 27%;
          height: 25%;
        }

        .baccarat-spot-chip-stack {
          width: 94px;
          height: 94px;
          z-index: 36;
          pointer-events: none;
        }

        .baccarat-spot-chip-stack .spot-chip {
          width: 48px;
          height: 48px;
        }

        .baccarat-spot-chip-stack strong {
          position: absolute;
          left: 50%;
          top: calc(100% - 12px);
          min-width: 68px;
          padding: 4px 10px;
          border: 1px solid rgba(214,173,72,.42);
          border-radius: 999px;
          background: rgba(3,6,5,.92);
          color: var(--gold-light);
          font-family: var(--font-number);
          font-size: .82rem;
          font-weight: 900;
          line-height: 1;
          text-align: center;
          transform: translateX(-50%);
          box-shadow: 0 8px 14px rgba(0,0,0,.32);
        }

        .baccarat-zone-amount {
          position: absolute;
          left: 50%;
          top: calc(50% + 56px);
          z-index: 38;
          min-width: 94px;
          padding: 5px 11px;
          border: 1px solid rgba(243,212,125,.64);
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(8,11,9,.96), rgba(2,5,4,.9));
          color: #fff4c2;
          font-family: var(--font-display);
          font-size: .68rem;
          font-style: normal;
          font-weight: 900;
          letter-spacing: .05em;
          line-height: 1;
          text-align: center;
          text-transform: uppercase;
          transform: translateX(-50%);
          box-shadow: 0 10px 18px rgba(0,0,0,.38);
        }

        .baccarat-seat-rail {
          position: absolute;
          left: 50%;
          bottom: 9.5%;
          z-index: 34;
          display: grid;
          width: min(760px, 74%);
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 7px;
          transform: translateX(-50%);
          pointer-events: none;
        }

        .baccarat-seat {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          grid-template-rows: auto auto;
          align-items: center;
          gap: 1px 7px;
          min-width: 0;
          min-height: 50px;
          padding: 6px 9px;
          border: 1px solid rgba(214,173,72,.18);
          border-radius: 12px;
          background: rgba(3,12,8,.78);
          color: rgba(247,240,215,.56);
          font-family: var(--font-display);
          text-align: left;
          box-shadow: inset 0 1px rgba(255,255,255,.04), 0 8px 14px rgba(0,0,0,.22);
        }

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
          display: block;
          width: 30px;
          height: 30px;
          border: 1px solid rgba(214,173,72,.2);
          border-radius: 999px;
          background: rgba(255,255,255,.04);
        }

        .baccarat-seat__name,
        .baccarat-seat strong {
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
          margin-top: 4px;
          color: #fff;
          font-family: var(--font-number);
          font-size: .72rem;
          font-weight: 900;
          line-height: 1;
        }

        .baccarat-chat-panel {
          right: 20px;
          top: 244px;
          width: 318px;
        }

        .baccarat-chat-panel .blackjack-chat {
          height: clamp(330px, 43vh, 438px);
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
          width: min(100%, 270px);
        }

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
            width: min(100%, 960px);
          }

          .baccarat-chat-panel {
            width: 300px;
          }

          .baccarat-bottom-console {
            grid-template-columns: minmax(330px, 1fr) auto minmax(210px, .7fr);
            gap: 8px 12px;
          }
        }

        @media (max-height: 780px) {
          .baccarat-game-shell {
            grid-template-rows: minmax(0, 1fr) 116px;
          }

          .baccarat-game-shell .topbar {
            top: 8px;
          }

          .baccarat-title-panel {
            min-height: 54px;
            padding: 6px 14px;
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
            top: -18%;
            width: clamp(176px, 11.5vw, 205px);
          }

          .baccarat-tip-board {
            top: -18%;
          }

          .baccarat-road {
            top: 86px;
          }

          .baccarat-chat-panel {
            top: 172px;
          }

          .baccarat-chat-panel .blackjack-chat {
            height: clamp(270px, 39vh, 330px);
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
      `}</style>
    </>
  )
}
