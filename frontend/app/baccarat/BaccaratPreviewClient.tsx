'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

type Suit = 'S' | 'H' | 'D' | 'C'
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
type BetKey = 'punto' | 'banco' | 'tie' | 'puntoPair' | 'bancoPair'
type Winner = 'punto' | 'banco' | 'tie'

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
  pair: boolean
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

const SUITS: Suit[] = ['S', 'H', 'D', 'C']
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const CHIP_VALUES = [10, 20, 50, 100, 500, 1000]
const CHIP_STACK_VALUES = [1000, 500, 100, 50, 20, 10]
const EMPTY_BETS: Bets = {
  punto: 0,
  banco: 0,
  tie: 0,
  puntoPair: 0,
  bancoPair: 0,
}
const INITIAL_PUNTO: BaccaratCard[] = [
  { rank: '4', suit: 'S' },
  { rank: '5', suit: 'H' },
]
const INITIAL_BANCO: BaccaratCard[] = [
  { rank: 'K', suit: 'D' },
  { rank: '8', suit: 'C' },
]
const STARTING_ROAD: RoadItem[] = [
  { id: 1, winner: 'banco', puntoTotal: 3, bancoTotal: 7, pair: false, natural: false },
  { id: 2, winner: 'banco', puntoTotal: 6, bancoTotal: 8, pair: false, natural: true },
  { id: 3, winner: 'punto', puntoTotal: 9, bancoTotal: 1, pair: true, natural: true },
  { id: 4, winner: 'tie', puntoTotal: 6, bancoTotal: 6, pair: false, natural: false },
  { id: 5, winner: 'banco', puntoTotal: 2, bancoTotal: 5, pair: false, natural: false },
  { id: 6, winner: 'punto', puntoTotal: 7, bancoTotal: 4, pair: false, natural: false },
  { id: 7, winner: 'punto', puntoTotal: 8, bancoTotal: 0, pair: false, natural: true },
  { id: 8, winner: 'banco', puntoTotal: 5, bancoTotal: 6, pair: true, natural: false },
  { id: 9, winner: 'tie', puntoTotal: 9, bancoTotal: 9, pair: false, natural: true },
  { id: 10, winner: 'banco', puntoTotal: 1, bancoTotal: 4, pair: false, natural: false },
  { id: 11, winner: 'punto', puntoTotal: 6, bancoTotal: 5, pair: false, natural: false },
  { id: 12, winner: 'banco', puntoTotal: 7, bancoTotal: 8, pair: false, natural: true },
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

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function createShoe() {
  const cards: BaccaratCard[] = []

  for (let deck = 0; deck < 8; deck++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ rank, suit })
      }
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

function isPair(cards: BaccaratCard[]) {
  return cards.length >= 2 && cards[0].rank === cards[1].rank
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
  return Object.values(bets).reduce((sum, value) => sum + value, 0)
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
  const puntoPair = isPair(puntoCards)
  const bancoPair = isPair(bancoCards)
  const pair = puntoPair || bancoPair
  const stake = totalBets(bets)
  let returns = 0

  if (winner === 'punto') returns += bets.punto * 2
  if (winner === 'banco') returns += bets.banco + Math.floor(bets.banco * 0.95)
  if (winner === 'tie') {
    returns += bets.tie * 9
    returns += bets.punto + bets.banco
  }
  if (puntoPair) returns += bets.puntoPair * 12
  if (bancoPair) returns += bets.bancoPair * 12

  const label = winner === 'punto' ? 'Punto wins' : winner === 'banco' ? 'Banco wins' : 'Tie hand'

  return {
    nextShoe: workingShoe,
    result: {
      id: roundId,
      winner,
      puntoCards,
      bancoCards,
      puntoTotal,
      bancoTotal,
      pair,
      natural,
      net: returns - stake,
      label,
    } satisfies RoundResult,
    returns,
  }
}

function Card({ card, revealDelay = 0 }: { card: BaccaratCard; revealDelay?: number }) {
  const isRed = card.suit === 'H' || card.suit === 'D'

  return (
    <div
      className={classNames(
        'relative flex aspect-[5/7] w-14 shrink-0 flex-col justify-between rounded-lg border border-[#2b1b13]/20 bg-[#fff7e8] p-2 shadow-[0_18px_28px_rgba(0,0,0,0.42)] sm:w-16 lg:w-20',
        isRed ? 'text-[#b82032]' : 'text-[#151618]'
      )}
      style={{ animationDelay: `${revealDelay}ms` }}
    >
      <span className="text-sm font-black leading-none lg:text-base">{card.rank}</span>
      <span className="self-center text-2xl font-black leading-none lg:text-3xl">{SUIT_SYMBOLS[card.suit]}</span>
      <span className="self-end text-sm font-black leading-none lg:text-base">{card.rank}</span>
    </div>
  )
}

function HandZone({
  title,
  cards,
  total,
  tone,
}: {
  title: string
  cards: BaccaratCard[]
  total: number
  tone: 'punto' | 'banco'
}) {
  const toneClass = tone === 'punto'
    ? 'border-[#78bdff]/28 bg-[#062f45]/34 text-[#dff1ff]'
    : 'border-[#ff9f92]/28 bg-[#4b100d]/34 text-[#ffe1dd]'

  return (
    <section className={`rounded-2xl border px-4 py-3 text-center backdrop-blur-sm ${toneClass}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.32em] opacity-72">{title}</div>
      <div className="mt-3 flex min-h-[5.4rem] items-center justify-center gap-2">
        {cards.map((card, index) => <Card key={`${card.rank}-${card.suit}-${index}`} card={card} revealDelay={index * 110} />)}
      </div>
      <div className="mt-3 inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-white/45 bg-black/34 px-3 text-2xl font-black shadow-[0_10px_20px_rgba(0,0,0,0.34)]">
        {total}
      </div>
    </section>
  )
}

function BetSpot({
  label,
  payout,
  amount,
  tone,
  onClick,
}: {
  label: string
  payout: string
  amount: number
  tone: 'punto' | 'banco' | 'tie' | 'pair'
  onClick: () => void
}) {
  const toneClass = {
    punto: 'border-[#78bdff]/45 bg-[linear-gradient(145deg,rgba(16,77,119,0.78),rgba(6,36,58,0.9))] hover:border-[#b9ddff]',
    banco: 'border-[#ff9f92]/45 bg-[linear-gradient(145deg,rgba(119,28,23,0.84),rgba(58,8,7,0.92))] hover:border-[#ffd0c8]',
    tie: 'border-[#98ffc4]/40 bg-[linear-gradient(145deg,rgba(22,103,64,0.8),rgba(8,52,34,0.92))] hover:border-[#ceffdf]',
    pair: 'border-[#f1ce7a]/32 bg-[linear-gradient(145deg,rgba(90,68,26,0.72),rgba(31,24,11,0.9))] hover:border-[#ffe3a1]',
  }[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative min-h-[5.8rem] overflow-hidden rounded-2xl border px-3 py-3 text-center text-white shadow-[inset_0_0_32px_rgba(255,255,255,0.05),0_16px_38px_rgba(0,0,0,0.28)] transition ${toneClass}`}
    >
      <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-white/58">{label}</span>
      <strong className="mt-2 block text-xl font-black text-[#fff8de]">{payout}</strong>
      {amount > 0 && (
        <span className="absolute inset-x-0 bottom-2 flex items-end justify-center">
          {chipFacesForBet(amount).map((chip, index) => (
            <img
              key={`${chip}-${index}`}
              src={`/blackjack/Images/Chips/${chip}.png`}
              alt=""
              aria-hidden="true"
              className="-mx-2 h-10 w-10 object-contain drop-shadow-[0_8px_8px_rgba(0,0,0,0.45)]"
              style={{ transform: `translateY(${-index * 3}px) rotate(${index % 2 === 0 ? -8 : 8}deg)` }}
            />
          ))}
        </span>
      )}
    </button>
  )
}

function RoadPanel({ road }: { road: RoadItem[] }) {
  const recent = road.slice(-42)
  const columns = Array.from({ length: 7 }, (_, columnIndex) => recent.slice(columnIndex * 6, columnIndex * 6 + 6))

  return (
    <section className="rounded-2xl border border-[#efc979]/18 bg-black/42 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.34)] backdrop-blur-md">
      <div className="flex items-end justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#efc979]/62">Road</div>
          <h2 className="mt-1 font-serif text-2xl text-[#fff4d5]">Bead Plate</h2>
        </div>
        <div className="text-right text-xs font-bold text-white/50">{road.length} rounds</div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {columns.map((column, columnIndex) => (
          <div key={columnIndex} className="grid grid-rows-6 gap-1.5">
            {Array.from({ length: 6 }, (_, rowIndex) => {
              const item = column[rowIndex]
              if (!item) return <span key={rowIndex} className="h-7 rounded-full border border-white/7 bg-white/[0.03]" />

              const beadClass = item.winner === 'punto'
                ? 'border-[#9bd3ff]/45 bg-[#287bc5] text-[#eaf6ff]'
                : item.winner === 'banco'
                  ? 'border-[#ffaaa0]/45 bg-[#b7352a] text-[#fff0ed]'
                  : 'border-[#b4ffd2]/45 bg-[#27a765] text-[#edfff4]'

              return (
                <span key={rowIndex} className={`relative flex h-7 items-center justify-center rounded-full border text-[10px] font-black shadow-[0_8px_16px_rgba(0,0,0,0.28)] ${beadClass}`}>
                  {item.winner === 'punto' ? 'P' : item.winner === 'banco' ? 'B' : 'T'}
                  {item.pair && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-black/40 bg-[#ffd56d]" />}
                </span>
              )
            })}
          </div>
        ))}
      </div>
    </section>
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
        'relative flex h-14 w-14 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd56d]/80 disabled:opacity-45',
        selected && 'scale-110'
      )}
      title={`${value} chip`}
    >
      <img
        src={`/blackjack/Images/Chips/${value}.png`}
        alt={`${value} chip`}
        className="h-full w-full object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.55)]"
      />
      {selected && <span className="absolute inset-0 rounded-full ring-2 ring-[#fff2bf] ring-offset-2 ring-offset-[#100706]" />}
    </button>
  )
}

function ActionButton({
  children,
  disabled,
  onClick,
  primary = false,
}: {
  children: React.ReactNode
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
        'rounded-xl border px-4 py-3 text-sm font-black uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-45',
        primary
          ? 'border-[#ffd56d]/55 bg-[#f0bb3c] text-[#1b0e05] hover:bg-[#ffdc72]'
          : 'border-white/12 bg-black/36 text-white/72 hover:border-[#ffd56d]/34 hover:text-white'
      )}
    >
      {children}
    </button>
  )
}

export function BaccaratPreviewClient({ username, chipBalance }: BaccaratPreviewClientProps) {
  const [shoe, setShoe] = useState(() => createShoe())
  const [selectedChip, setSelectedChip] = useState(100)
  const [stack, setStack] = useState(() => Math.max(1000, Math.floor(chipBalance)))
  const [bets, setBets] = useState<Bets>(EMPTY_BETS)
  const [lastBets, setLastBets] = useState<Bets>(EMPTY_BETS)
  const [road, setRoad] = useState<RoadItem[]>(STARTING_ROAD)
  const [result, setResult] = useState<RoundResult>({
    id: 0,
    winner: 'punto',
    puntoCards: INITIAL_PUNTO,
    bancoCards: INITIAL_BANCO,
    puntoTotal: 9,
    bancoTotal: 8,
    pair: false,
    natural: true,
    net: 0,
    label: 'Punto natural nine',
  })
  const [dealing, setDealing] = useState(false)

  const currentStake = totalBets(bets)
  const lastStake = totalBets(lastBets)
  const canDeal = currentStake > 0 && !dealing
  const lastThree = road.slice(-3).reverse()
  const commissionPreview = bets.banco > 0 ? Math.ceil(bets.banco * 0.05) : 0

  const message = useMemo(() => {
    if (dealing) return 'Cards are in motion.'
    if (currentStake > 0) return `${money(currentStake)} on the layout.`
    return 'Place your preview bets.'
  }, [currentStake, dealing])

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
      banco: current.banco * 2,
      tie: current.tie * 2,
      puntoPair: current.puntoPair * 2,
      bancoPair: current.bancoPair * 2,
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
        puntoTotal: resolved.result.puntoTotal,
        bancoTotal: resolved.result.bancoTotal,
        pair: resolved.result.pair,
        natural: resolved.result.natural,
      }])
      setDealing(false)
    }, 520)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050403] text-white">
      <div className="pointer-events-none fixed inset-0">
        <img
          src="/casino-lobby/lobby-background.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,2,2,0.94)_0%,rgba(16,5,5,0.72)_24%,rgba(8,12,9,0.48)_60%,rgba(0,0,0,0.92)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,211,109,0.16),transparent_34%),linear-gradient(180deg,rgba(0,0,0,0.18),rgba(0,0,0,0.72))]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-4 pb-8 pt-24 sm:px-6 lg:px-8 xl:pt-6">
        <header className="mb-5 flex flex-col gap-4 pl-0 xl:pl-56">
          <div className="flex flex-col gap-4 rounded-2xl border border-[#efc979]/18 bg-black/28 px-4 py-4 shadow-[0_22px_70px_rgba(0,0,0,0.32)] backdrop-blur-md md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <img src="/casino-lobby/logo.png" alt="" aria-hidden="true" className="h-16 w-20 shrink-0 object-contain drop-shadow-[0_12px_30px_rgba(0,0,0,0.55)]" />
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.34em] text-[#efc979]/72">GM Design Sandbox</div>
                <h1 className="mt-1 truncate font-serif text-3xl font-black uppercase tracking-[0.08em] text-[#fff2c8] sm:text-4xl">
                  Punto Banco Salon
                </h1>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-2">
              <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white/68">
                {username} / {money(stack)} preview chips
              </div>
              <Link href="/" className="rounded-xl border border-white/12 bg-black/30 px-4 py-3 text-sm font-bold text-white/76 transition hover:border-[#efc979]/40 hover:text-white">
                Main Lobby
              </Link>
              <Link href="/gm" className="rounded-xl border border-[#efc979]/35 bg-[#efc979]/12 px-4 py-3 text-sm font-bold text-[#fff2c8] transition hover:border-[#efc979]/60 hover:bg-[#efc979]/18">
                GM
              </Link>
            </nav>
          </div>
        </header>

        <section className="grid flex-1 gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="relative min-h-[44rem] overflow-hidden rounded-[30px] border border-[#efc979]/20 bg-black/32 shadow-[0_38px_130px_rgba(0,0,0,0.55)] backdrop-blur-sm">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(239,201,121,0.16),transparent_36%),linear-gradient(180deg,rgba(13,8,5,0.16),rgba(10,3,3,0.7))]" />
            <div className="relative mx-auto flex h-full max-w-[1080px] flex-col px-3 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-2xl border border-[#efc979]/20 bg-black/40 px-4 py-3 backdrop-blur-md">
                  <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#efc979]/62">Dealer</div>
                  <div className="mt-1 text-lg font-black text-[#fff4d5]">Eunice</div>
                </div>
                <div className="rounded-2xl border border-[#efc979]/20 bg-black/44 px-5 py-3 text-center backdrop-blur-md">
                  <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#efc979]/62">Table Call</div>
                  <div className="mt-1 text-lg font-black text-[#fff4d5]">{message}</div>
                </div>
                <div className="rounded-2xl border border-[#efc979]/20 bg-black/40 px-4 py-3 text-right backdrop-blur-md">
                  <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#efc979]/62">Shoe</div>
                  <div className="mt-1 text-lg font-black text-[#fff4d5]">{shoe.length}</div>
                </div>
              </div>

              <div className="relative mt-3 flex-1">
                <img
                  src="/blackjack/Images/Table/Table.png"
                  alt=""
                  aria-hidden="true"
                  className="absolute left-1/2 top-[47%] w-[1120px] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-95 drop-shadow-[0_38px_60px_rgba(0,0,0,0.58)]"
                />
                <img
                  src="/blackjack/Images/Dealers/Eunice4.png"
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-[-2rem] h-56 -translate-x-1/2 object-contain opacity-95 drop-shadow-[0_26px_28px_rgba(0,0,0,0.55)]"
                />

                <div className="absolute left-1/2 top-[10.5rem] w-[min(48rem,82%)] -translate-x-1/2 rounded-full border border-[#efc979]/24 bg-black/44 px-5 py-3 text-center shadow-[0_20px_46px_rgba(0,0,0,0.42)] backdrop-blur-md">
                  <div className="text-[10px] font-black uppercase tracking-[0.32em] text-[#efc979]/62">
                    {result.natural ? 'Natural Checked' : result.pair ? 'Pair Marked' : 'Punto Banco Rules'}
                  </div>
                  <div className="mt-1 text-2xl font-black text-[#fff4d5]">
                    {dealing ? 'No more bets' : `${result.label} / ${result.puntoTotal}-${result.bancoTotal} / ${signedMoney(result.net)}`}
                  </div>
                </div>

                <div className="absolute left-[7%] right-[7%] top-[17.5rem] grid gap-4 lg:grid-cols-2">
                  <HandZone title="Punto" cards={result.puntoCards} total={result.puntoTotal} tone="punto" />
                  <HandZone title="Banco" cards={result.bancoCards} total={result.bancoTotal} tone="banco" />
                </div>

                <div className="absolute inset-x-[6%] bottom-[8.6rem] grid grid-cols-3 gap-3">
                  <BetSpot label="Punto" payout="1:1" amount={bets.punto} tone="punto" onClick={() => placeBet('punto')} />
                  <BetSpot label="Tie" payout="8:1" amount={bets.tie} tone="tie" onClick={() => placeBet('tie')} />
                  <BetSpot label="Banco" payout="0.95:1" amount={bets.banco} tone="banco" onClick={() => placeBet('banco')} />
                </div>

                <div className="absolute bottom-[1.6rem] left-[16%] right-[16%] grid grid-cols-2 gap-3">
                  <BetSpot label="Punto Pair" payout="11:1" amount={bets.puntoPair} tone="pair" onClick={() => placeBet('puntoPair')} />
                  <BetSpot label="Banco Pair" payout="11:1" amount={bets.bancoPair} tone="pair" onClick={() => placeBet('bancoPair')} />
                </div>
              </div>
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <section className="rounded-2xl border border-[#efc979]/18 bg-black/42 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.34)] backdrop-blur-md">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#efc979]/62">Wager Rail</div>
                  <h2 className="mt-1 font-serif text-2xl text-[#fff4d5]">Preview Chips</h2>
                </div>
                <strong className="text-lg text-[#fff4d5]">{money(currentStake)}</strong>
              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-3">
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

              <div className="mt-4 grid grid-cols-2 gap-2">
                <ActionButton onClick={clearBets} disabled={currentStake <= 0 || dealing}>Clear</ActionButton>
                <ActionButton onClick={rebet} disabled={lastStake <= 0 || dealing || stack + currentStake < lastStake}>Rebet</ActionButton>
                <ActionButton onClick={doubleBets} disabled={currentStake <= 0 || dealing || stack < currentStake}>Double</ActionButton>
                <ActionButton onClick={dealPreviewRound} disabled={!canDeal} primary>{dealing ? 'Dealing' : 'Deal'}</ActionButton>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-xs text-white/58">
                Banco commission preview: {money(commissionPreview)}
              </div>
            </section>

            <RoadPanel road={road} />

            <section className="rounded-2xl border border-[#efc979]/18 bg-black/42 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.34)] backdrop-blur-md">
              <div className="border-b border-white/10 pb-3">
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#efc979]/62">Last Hands</div>
                <h2 className="mt-1 font-serif text-2xl text-[#fff4d5]">Salon Tape</h2>
              </div>
              <div className="mt-3 space-y-2">
                {lastThree.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                    <span className="text-sm font-bold text-white/72">#{item.id}</span>
                    <span className="text-sm font-black uppercase tracking-[0.12em] text-[#fff4d5]">{item.winner}</span>
                    <span className="text-sm text-white/58">{item.puntoTotal}-{item.bancoTotal}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  )
}
