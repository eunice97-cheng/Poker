'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { AudioControls } from '@/components/ui/AudioControls'
import { ChatMessageText } from '@/components/ui/ChatMessageText'

type Suit = 'S' | 'H' | 'D' | 'C'
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
type BetKey = 'punto' | 'tie' | 'banco'
type Winner = 'punto' | 'tie' | 'banco'

type BaccaratCard = {
  rank: Rank
  suit: Suit
}

type Bets = Record<BetKey, number>

type RoadItem = {
  id: number
  winner: Winner
  puntoTotal: number
  bancoTotal: number
  natural: boolean
}

type RoundResult = RoadItem & {
  puntoCards: BaccaratCard[]
  bancoCards: BaccaratCard[]
  net: number
  label: string
}

type BaccaratPreviewClientProps = {
  username: string
  chipBalance: number
}

type PreviewChatMessage = {
  id: number
  username: string
  text: string
  system?: boolean
}

const SUITS: Suit[] = ['S', 'H', 'D', 'C']
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const CHIP_VALUES = [10, 20, 50, 100, 500, 1000]
const CHIP_STACK_VALUES = [1000, 500, 100, 50, 20, 10]
const EMPTY_BETS: Bets = { punto: 0, tie: 0, banco: 0 }
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

function shouldBancoDraw(bancoTotal: number, puntoThirdCard: BaccaratCard | null) {
  if (!puntoThirdCard) return bancoTotal <= 5

  const puntoThirdValue = baccaratValue(puntoThirdCard)
  if (bancoTotal <= 2) return true
  if (bancoTotal === 3) return puntoThirdValue !== 8
  if (bancoTotal === 4) return puntoThirdValue >= 2 && puntoThirdValue <= 7
  if (bancoTotal === 5) return puntoThirdValue >= 4 && puntoThirdValue <= 7
  if (bancoTotal === 6) return puntoThirdValue === 6 || puntoThirdValue === 7
  return false
}

function totalBets(bets: Bets) {
  return bets.punto + bets.tie + bets.banco
}

function chipFacesForBet(value: number) {
  const faces: number[] = []
  let remaining = value

  for (const chipValue of CHIP_STACK_VALUES) {
    while (remaining >= chipValue && faces.length < 5) {
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

  const puntoCards = [draw(), draw()]
  const bancoCards = [draw(), draw()]
  let puntoTotal = handTotal(puntoCards)
  let bancoTotal = handTotal(bancoCards)
  const natural = puntoTotal >= 8 || bancoTotal >= 8
  let puntoThirdCard: BaccaratCard | null = null

  if (!natural) {
    if (puntoTotal <= 5) {
      puntoThirdCard = draw()
      puntoCards.push(puntoThirdCard)
      puntoTotal = handTotal(puntoCards)
    }

    if (shouldBancoDraw(bancoTotal, puntoThirdCard)) {
      bancoCards.push(draw())
      bancoTotal = handTotal(bancoCards)
    }
  }

  const winner: Winner = puntoTotal > bancoTotal ? 'punto' : bancoTotal > puntoTotal ? 'banco' : 'tie'
  const stake = totalBets(bets)
  let returns = 0

  if (winner === 'punto') returns += bets.punto * 2
  if (winner === 'banco') returns += bets.banco + Math.floor(bets.banco * 0.95)
  if (winner === 'tie') {
    returns += bets.tie * 9
    returns += bets.punto + bets.banco
  }

  const label = winner === 'punto' ? 'Punto wins' : winner === 'banco' ? 'Banco wins' : 'Tie hand'

  return {
    nextShoe: workingShoe,
    returns,
    result: {
      id: roundId,
      winner,
      puntoCards,
      bancoCards,
      puntoTotal,
      bancoTotal,
      natural,
      net: returns - stake,
      label,
    } satisfies RoundResult,
  }
}

function Card({ card }: { card: BaccaratCard }) {
  const isRed = card.suit === 'H' || card.suit === 'D'

  return (
    <div
      className={classNames(
        'flex aspect-[5/7] w-[3.4rem] shrink-0 flex-col justify-between rounded-md border border-[#2b1b13]/20 bg-[#fff7e8] p-1.5 shadow-[0_12px_20px_rgba(0,0,0,0.42)] 2xl:w-16',
        isRed ? 'text-[#b82032]' : 'text-[#151618]'
      )}
    >
      <span className="text-xs font-black leading-none 2xl:text-sm">{card.rank}</span>
      <span className="self-center text-xl font-black leading-none 2xl:text-2xl">{SUIT_SYMBOLS[card.suit]}</span>
      <span className="self-end text-xs font-black leading-none 2xl:text-sm">{card.rank}</span>
    </div>
  )
}

function CardBack() {
  return (
    <div className="flex aspect-[5/7] w-[3.4rem] shrink-0 items-center justify-center rounded-md border border-[#d9ad5a]/25 bg-[linear-gradient(135deg,#15100a,#3b210d)] p-1.5 shadow-[0_12px_20px_rgba(0,0,0,0.42)] 2xl:w-16">
      <span className="h-full w-full rounded border border-[#d9ad5a]/28 bg-[radial-gradient(circle,#6d4215,transparent_58%)]" />
    </div>
  )
}

function HandDisplay({
  label,
  cards,
  total,
  side,
}: {
  label: string
  cards: BaccaratCard[]
  total: number | null
  side: 'punto' | 'banco'
}) {
  const tone = side === 'punto' ? 'text-[#dbefff] border-[#85c8ff]/26' : 'text-[#ffe2dd] border-[#ffad9f]/26'

  return (
    <section className={`min-w-[12rem] rounded-2xl border bg-black/38 px-4 py-3 text-center shadow-[0_18px_36px_rgba(0,0,0,0.35)] backdrop-blur-md ${tone}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.28em] opacity-75">{label}</div>
      <div className="mt-2 flex min-h-[4.8rem] items-center justify-center gap-2">
        {cards.length > 0 ? cards.map((card, index) => <Card key={`${card.rank}-${card.suit}-${index}`} card={card} />) : (
          <>
            <CardBack />
            <CardBack />
          </>
        )}
      </div>
      <div className="mt-2 inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-white/35 bg-black/42 px-2 text-xl font-black text-white">
        {total ?? '-'}
      </div>
    </section>
  )
}

function ChipStack({ amount }: { amount: number }) {
  if (amount <= 0) return null

  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {chipFacesForBet(amount).map((chip, index) => (
        <img
          key={`${chip}-${index}`}
          src={`/blackjack/Images/Chips/${chip}.png`}
          alt=""
          aria-hidden="true"
          className="-mx-2 h-12 w-12 object-contain drop-shadow-[0_9px_9px_rgba(0,0,0,0.46)] 2xl:h-14 2xl:w-14"
          style={{ transform: `translateY(${-index * 4}px) rotate(${index % 2 === 0 ? -7 : 8}deg)` }}
        />
      ))}
      <span className="absolute mt-16 rounded-full border border-black/40 bg-[#fff3c4] px-3 py-1 text-xs font-black text-[#221205] shadow-[0_8px_18px_rgba(0,0,0,0.34)]">
        {money(amount)}
      </span>
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
      aria-label={`Bet on ${label}`}
      title={`Bet on ${label}`}
      onClick={onClick}
      className={`absolute rounded-[30px] border border-transparent transition hover:border-[#ffe2a2]/55 hover:bg-white/[0.035] focus:outline-none focus-visible:border-[#ffe2a2] ${className}`}
    >
      <ChipStack amount={amount} />
    </button>
  )
}

function ChipButton({
  value,
  selected,
  disabled,
  onClick,
}: {
  value: number
  selected: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={classNames(
        'relative flex h-11 w-11 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd56d]/80 disabled:opacity-45 2xl:h-12 2xl:w-12',
        selected && 'scale-110'
      )}
      title={`${value} chip`}
    >
      <img src={`/blackjack/Images/Chips/${value}.png`} alt={`${value} chip`} className="h-full w-full object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.52)]" />
      {selected && <span className="absolute inset-0 rounded-full ring-2 ring-[#fff2bf] ring-offset-2 ring-offset-[#120807]" />}
    </button>
  )
}

function ActionButton({
  children,
  disabled,
  onClick,
  primary = false,
}: {
  children: ReactNode
  disabled?: boolean
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={classNames(
        'h-10 rounded-xl border px-3 text-xs font-black uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-38 2xl:h-11',
        primary
          ? 'border-[#ffd56d]/55 bg-[#d2a135] text-[#160b04] hover:bg-[#ffd56d]'
          : 'border-white/14 bg-black/38 text-white/72 hover:border-[#ffd56d]/38 hover:text-white'
      )}
    >
      {children}
    </button>
  )
}

function RoadPanel({ road }: { road: RoadItem[] }) {
  const recent = road.slice(-36)
  const cells = Array.from({ length: 36 }, (_, index) => recent[index] ?? null)

  return (
    <section className="min-h-0 rounded-2xl border border-[#efc979]/18 bg-black/50 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.34)] backdrop-blur-md">
      <div className="flex items-end justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#efc979]/62">Road</div>
          <h2 className="mt-1 font-serif text-xl text-[#fff4d5]">Bead Plate</h2>
        </div>
        <div className="text-right text-xs font-bold text-white/50">{road.length} rounds</div>
      </div>

      <div className="mt-3 grid grid-cols-6 gap-1.5">
        {cells.map((item, index) => {
          if (!item) return <span key={index} className="h-8 rounded-full border border-white/12 bg-white/[0.025]" />

          const beadClass = item.winner === 'punto'
            ? 'border-[#9bd3ff]/45 bg-[#287bc5] text-[#eaf6ff]'
            : item.winner === 'banco'
              ? 'border-[#ffaaa0]/45 bg-[#b7352a] text-[#fff0ed]'
              : 'border-[#b4ffd2]/45 bg-[#27a765] text-[#edfff4]'

          return (
            <span key={index} className={`flex h-8 items-center justify-center rounded-full border text-[10px] font-black shadow-[0_8px_16px_rgba(0,0,0,0.28)] ${beadClass}`}>
              {item.winner === 'punto' ? 'P' : item.winner === 'banco' ? 'B' : 'T'}
            </span>
          )
        })}
      </div>
    </section>
  )
}

function TableChat({
  username,
  messages,
  input,
  onInputChange,
  onSend,
}: {
  username: string
  messages: PreviewChatMessage[]
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-[#efc979]/18 bg-black/50 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.34)] backdrop-blur-md">
      <div className="flex items-end justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#efc979]/62">Table</div>
          <h2 className="mt-1 font-serif text-xl text-[#fff4d5]">Chat</h2>
        </div>
        <div className="text-right text-xs font-bold text-white/50">Preview</div>
      </div>

      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {messages.map((message) => (
          <div
            key={message.id}
            className={classNames(
              'rounded-xl border px-3 py-2 text-sm leading-snug',
              message.system
                ? 'border-[#efc979]/16 bg-[#efc979]/8 text-[#fff4d5]/72'
                : 'border-white/10 bg-white/[0.045] text-white/76'
            )}
          >
            {!message.system && (
              <div className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#efc979]/62">
                {message.username}
              </div>
            )}
            <ChatMessageText text={message.text} size="sm" />
          </div>
        ))}
      </div>

      <form
        className="mt-3 flex shrink-0 gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          onSend()
        }}
      >
        <input
          value={input}
          maxLength={140}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder={`Message as ${username}`}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/44 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/34 focus:border-[#efc979]/40"
        />
        <button
          type="submit"
          className="rounded-xl border border-[#efc979]/30 bg-[#efc979]/12 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#fff2c8] transition hover:border-[#efc979]/55 hover:bg-[#efc979]/18"
        >
          Send
        </button>
      </form>
    </section>
  )
}

export function BaccaratPreviewClient({ username, chipBalance }: BaccaratPreviewClientProps) {
  const [shoe, setShoe] = useState(() => createShoe())
  const [selectedChip, setSelectedChip] = useState(100)
  const [stack, setStack] = useState(() => Math.max(1000, Math.floor(chipBalance)))
  const [bets, setBets] = useState<Bets>(EMPTY_BETS)
  const [lastBets, setLastBets] = useState<Bets>(EMPTY_BETS)
  const [road, setRoad] = useState<RoadItem[]>([])
  const [result, setResult] = useState<RoundResult | null>(null)
  const [dealing, setDealing] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<PreviewChatMessage[]>([
    { id: 1, username: 'Dealer', text: 'Baccarat preview room is open.', system: true },
  ])

  const currentStake = totalBets(bets)
  const lastStake = totalBets(lastBets)
  const canDeal = currentStake > 0 && !dealing
  const commissionPreview = bets.banco > 0 ? Math.ceil(bets.banco * 0.05) : 0

  const message = useMemo(() => {
    if (dealing) return 'Cards are in motion.'
    if (currentStake > 0) return `${money(currentStake)} on the layout.`
    return 'Place preview bets.'
  }, [currentStake, dealing])

  const resultLine = result
    ? `${result.label} / ${result.puntoTotal}-${result.bancoTotal} / ${signedMoney(result.net)}`
    : 'No result yet'

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
      punto: current.punto * 2,
      tie: current.tie * 2,
      banco: current.banco * 2,
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
      setRoad((current) => [...current.slice(-35), {
        id: resolved.result.id,
        winner: resolved.result.winner,
        puntoTotal: resolved.result.puntoTotal,
        bancoTotal: resolved.result.bancoTotal,
        natural: resolved.result.natural,
      }])
      setDealing(false)
    }, 420)
  }

  const sendChat = () => {
    const text = chatInput.trim()
    if (!text) return

    setChatMessages((current) => [
      ...current.slice(-5),
      {
        id: Date.now(),
        username,
        text,
      },
    ])
    setChatInput('')
  }

  return (
    <main className="relative h-[100svh] overflow-hidden bg-[#050403] text-white">
      <div className="pointer-events-none fixed inset-0">
        <img src="/baccarat/Images/baccarat-lobby.png" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,1,1,0.92)_0%,rgba(9,5,3,0.54)_35%,rgba(5,7,5,0.5)_65%,rgba(0,0,0,0.92)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18),rgba(0,0,0,0.76))]" />
      </div>

      <div className="relative z-10 mx-auto flex h-full w-full max-w-[1500px] flex-col px-5 pb-4 pt-5">
        <header className="mb-3 ml-[220px] flex h-[78px] shrink-0 items-center justify-between gap-4 rounded-2xl border border-[#efc979]/22 bg-black/46 px-5 shadow-[0_18px_70px_rgba(0,0,0,0.42)] backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-4">
            <img src="/baccarat/Images/baccarat-logo.png" alt="" aria-hidden="true" className="h-[62px] w-[82px] shrink-0 object-contain drop-shadow-[0_12px_30px_rgba(0,0,0,0.58)]" />
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.34em] text-[#efc979]/72">GM Design Sandbox</div>
              <h1 className="truncate font-serif text-[1.8rem] font-black uppercase leading-tight tracking-[0.08em] text-[#fff2c8] 2xl:text-[2.2rem]">
                Punto Banco Salon
              </h1>
            </div>
          </div>

          <nav className="flex shrink-0 items-center gap-2">
            <div className="rounded-xl border border-white/10 bg-black/34 px-4 py-3 text-sm font-semibold text-white/72">
              {username} / {money(stack)}
            </div>
            <AudioControls buttonClassName="flex h-11 w-11 items-center justify-center rounded-xl border border-white/16 bg-black/38 text-white/78 transition hover:border-[#efc979]/45 hover:text-white" />
            <Link href="/" className="rounded-xl border border-white/16 bg-black/38 px-4 py-3 text-sm font-bold text-white/78 transition hover:border-[#efc979]/45 hover:text-white">
              Main Lobby
            </Link>
            <Link href="/gm" className="rounded-xl border border-[#efc979]/35 bg-[#efc979]/12 px-4 py-3 text-sm font-bold text-[#fff2c8] transition hover:border-[#efc979]/60 hover:bg-[#efc979]/18">
              GM
            </Link>
          </nav>
        </header>

        <section className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)_320px] grid-rows-[minmax(0,1fr)_118px] gap-3">
          <aside className="min-h-0">
            <RoadPanel road={road} />
          </aside>

          <section className="relative min-h-0 overflow-hidden rounded-[28px] border border-[#efc979]/18 bg-black/34 shadow-[0_34px_120px_rgba(0,0,0,0.55)] backdrop-blur-sm">
            <img
              src="/blackjack/Images/Dealers/Eunice4.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-[2.2rem] z-[9] h-[19rem] -translate-x-1/2 object-contain drop-shadow-[0_24px_30px_rgba(0,0,0,0.7)] 2xl:top-[1.6rem] 2xl:h-[21rem]"
            />

            <div className="pointer-events-none absolute left-[calc(50%+9.5rem)] top-[6.9rem] z-30 max-w-[16rem] rounded-xl border border-[#d9ad5a]/48 bg-[linear-gradient(180deg,rgba(8,11,9,0.94),rgba(2,5,4,0.9))] px-4 py-3 text-center text-sm font-bold leading-snug text-[#fff4d5] shadow-[inset_0_1px_rgba(255,255,255,0.06),0_14px_24px_rgba(0,0,0,0.45)]">
              {message}
            </div>

            <div className="absolute inset-x-5 top-4 z-20 flex items-start justify-between gap-3">
              <div className="rounded-2xl border border-[#efc979]/20 bg-black/46 px-4 py-3 backdrop-blur-md">
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#efc979]/62">Dealer</div>
                <div className="mt-1 text-base font-black text-[#fff4d5]">Eunice</div>
              </div>
              <div className="max-w-[32rem] rounded-full border border-[#efc979]/22 bg-black/50 px-5 py-3 text-center shadow-[0_18px_48px_rgba(0,0,0,0.42)] backdrop-blur-md">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#efc979]/62">
                  {result?.natural ? 'Natural Checked' : 'Punto Banco'}
                </div>
                <div className="mt-1 truncate text-xl font-black text-[#fff4d5]">{dealing ? 'No more bets' : resultLine}</div>
              </div>
              <div className="rounded-2xl border border-[#efc979]/20 bg-black/46 px-4 py-3 text-right backdrop-blur-md">
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#efc979]/62">Shoe</div>
                <div className="mt-1 text-base font-black text-[#fff4d5]">{shoe.length}</div>
              </div>
            </div>

            <div className="absolute left-1/2 top-[35%] z-20 grid w-[68%] -translate-x-1/2 grid-cols-2 gap-4">
              <HandDisplay label="Punto" cards={result?.puntoCards ?? []} total={result?.puntoTotal ?? null} side="punto" />
              <HandDisplay label="Banco" cards={result?.bancoCards ?? []} total={result?.bancoTotal ?? null} side="banco" />
            </div>

            <div className="absolute inset-0 z-10">
              <img
                src="/baccarat/Images/baccarat-table.png"
                alt=""
                aria-hidden="true"
                className="absolute bottom-[-7%] left-1/2 w-[99%] max-w-[1050px] -translate-x-1/2 object-contain drop-shadow-[0_40px_62px_rgba(0,0,0,0.62)]"
              />
              <TableBetZone label="Punto" amount={bets.punto} className="bottom-[20%] left-[16%] h-[25%] w-[27%]" onClick={() => placeBet('punto')} />
              <TableBetZone label="Tie" amount={bets.tie} className="bottom-[20%] left-[43%] h-[25%] w-[14%]" onClick={() => placeBet('tie')} />
              <TableBetZone label="Banco" amount={bets.banco} className="bottom-[20%] right-[16%] h-[25%] w-[27%]" onClick={() => placeBet('banco')} />
            </div>
          </section>

          <aside className="min-h-0">
            <TableChat
              username={username}
              messages={chatMessages}
              input={chatInput}
              onInputChange={setChatInput}
              onSend={sendChat}
            />
          </aside>

          <section className="col-span-3 grid min-h-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-[#efc979]/18 bg-black/52 px-4 py-3 shadow-[0_20px_70px_rgba(0,0,0,0.34)] backdrop-blur-md">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.26em] text-[#efc979]/62">Table Message</div>
              <div className="mt-1 truncate text-lg font-black text-[#fff4d5]">{dealing ? 'Cards are in motion.' : resultLine}</div>
            </div>

            <div className="flex items-center justify-center gap-3">
              {CHIP_VALUES.map((value) => (
                <ChipButton
                  key={value}
                  value={value}
                  selected={selectedChip === value}
                  disabled={dealing || stack < value}
                  onClick={() => setSelectedChip(value)}
                />
              ))}
            </div>

            <div className="grid min-w-[26rem] grid-cols-[1fr_1fr_1fr_1fr] gap-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/42">Bet</div>
                <div className="text-base font-black text-[#fff4d5]">{money(currentStake)}</div>
              </div>
              <ActionButton onClick={clearBets} disabled={currentStake <= 0 || dealing}>Clear</ActionButton>
              <ActionButton onClick={rebet} disabled={lastStake <= 0 || dealing || stack + currentStake < lastStake}>Rebet</ActionButton>
              <ActionButton onClick={doubleBets} disabled={currentStake <= 0 || dealing || stack < currentStake}>Double</ActionButton>
              <div className="col-span-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/58">
                Banco commission preview: {money(commissionPreview)}
              </div>
              <ActionButton onClick={dealPreviewRound} disabled={!canDeal} primary>{dealing ? 'Dealing' : 'Deal'}</ActionButton>
            </div>
          </section>
        </section>
      </div>
    </main>
  )
}
