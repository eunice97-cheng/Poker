'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AvatarDisplay } from '@/components/ui/AvatarDisplay'
import { AudioControls } from '@/components/ui/AudioControls'
import { MailIcon } from '@/components/ui/MailIcon'
import { useAudio } from '@/hooks/useAudio'
import type { Profile } from '@/types/poker'

export interface CasinoGameStats {
  tableCount: number
  playerCount: number
  openSeats: number
  featuredLimit: string
}

interface CasinoLobbyClientProps {
  profile: Profile | null
  pokerStats: CasinoGameStats
  blackjackStats: CasinoGameStats
  unreadMailCount: number
  isLocalAdmin?: boolean
}

type CasinoGameCard = {
  id: 'poker' | 'blackjack'
  title: string
  roomLabel: string
  href: string
  image: string
  mark: string
  tone: 'gold' | 'teal'
  stats: CasinoGameStats
}

const games: Omit<CasinoGameCard, 'stats'>[] = [
  {
    id: 'poker',
    title: 'Basement Poker',
    roomLabel: 'Texas Holdem',
    href: '/lobby',
    image: '/lobby-background/ASL Dungeon Poker.png',
    mark: 'P',
    tone: 'gold',
  },
  {
    id: 'blackjack',
    title: 'BlackJack Lounge',
    roomLabel: 'House Dealer',
    href: '/blackjack',
    image: '/blackjack/Images/Promote ASL Blackjack.png',
    mark: 'B',
    tone: 'teal',
  },
]

function formatChips(value: number | undefined) {
  return (value ?? 0).toLocaleString()
}

function GameCard({ game }: { game: CasinoGameCard }) {
  const { playSfx } = useAudio()
  const accent =
    game.tone === 'gold'
      ? 'from-[#f8d86a] via-[#d1902e] to-[#823d1d]'
      : 'from-[#76f4dc] via-[#1da58e] to-[#183e73]'
  const badge =
    game.tone === 'gold'
      ? 'border-[#f8d86a]/45 bg-[#f8d86a]/14 text-[#fff0be]'
      : 'border-[#76f4dc]/42 bg-[#1da58e]/15 text-[#c8fff4]'

  return (
    <Link
      href={game.href}
      onClick={() => playSfx('click')}
      className="group relative flex min-h-[28rem] overflow-hidden rounded-[24px] border border-white/10 bg-black/34 shadow-[0_30px_90px_rgba(0,0,0,0.36)] outline-none transition-transform duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-[#f8d86a]/70"
      aria-label={`Enter ${game.title}`}
    >
      <img
        src={game.image}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.035]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.12)_0%,rgba(0,0,0,0.28)_34%,rgba(4,7,10,0.86)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.54),transparent_52%,rgba(0,0,0,0.2))]" />

      <div className="relative z-10 flex w-full flex-col justify-between p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] ${badge}`}>
            {game.roomLabel}
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${accent} text-lg font-black text-black shadow-[0_18px_36px_rgba(0,0,0,0.32)]`}>
            {game.mark}
          </div>
        </div>

        <div>
          <h2 className="font-serif text-4xl font-bold leading-none text-[#fff8df] sm:text-5xl">
            {game.title}
          </h2>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-white/10 bg-black/38 px-2 py-3 backdrop-blur-sm">
              <div className="text-2xl font-bold text-white">{game.stats.tableCount}</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/48">Tables</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/38 px-2 py-3 backdrop-blur-sm">
              <div className="text-2xl font-bold text-white">{game.stats.playerCount}</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/48">Players</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/38 px-2 py-3 backdrop-blur-sm">
              <div className="text-2xl font-bold text-white">{game.stats.openSeats}</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/48">Seats</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/42 px-4 py-3 text-sm backdrop-blur-sm">
            <span className="font-semibold text-white/72">{game.stats.featuredLimit}</span>
            <span className="font-bold text-[#fff2bf]">Enter Room</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export function CasinoLobbyClient({
  profile,
  pokerStats,
  blackjackStats,
  unreadMailCount,
  isLocalAdmin = false,
}: CasinoLobbyClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const { playSfx } = useAudio()
  const unreadMailLabel = unreadMailCount > 99 ? '99+' : unreadMailCount.toString()
  const playerName = profile?.username ?? 'Player'
  const gameCards: CasinoGameCard[] = games.map((game) => ({
    ...game,
    stats: game.id === 'poker' ? pokerStats : blackjackStats,
  }))

  const handleSignOut = async () => {
    playSfx('click')
    if (isLocalAdmin) {
      await fetch('/api/dev/local-admin-logout', { method: 'POST' })
    } else {
      await supabase.auth.signOut()
    }
    router.push('/auth/login')
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080b0d] text-white">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/lobby-background/ASL Dungeon Poker.png')" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(5,8,10,0.94)_0%,rgba(18,7,8,0.72)_42%,rgba(5,26,26,0.76)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-[linear-gradient(180deg,transparent,rgba(8,11,13,0.98))]" />
      </div>

      <div className="relative z-10">
        <header className="border-b border-white/10 bg-black/42 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.34em] text-[#78f4df]/70">Arcana Casino</div>
              <h1 className="mt-1 font-serif text-3xl font-bold text-[#fff8df] sm:text-4xl">Game Lobby</h1>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <AvatarDisplay avatarId={profile?.avatar ?? 'avatar_m1'} size="sm" className="border-[#f8d86a]/35" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white">{playerName}</div>
                  <div className="text-xs font-semibold text-[#f8d86a]">{formatChips(profile?.chip_balance)} chips</div>
                </div>
              </div>
              <Link
                href="/profile"
                onClick={() => playSfx('click')}
                className="rounded-xl border border-white/10 bg-black/24 px-4 py-3 text-sm font-semibold text-white/78 transition-colors hover:border-[#f8d86a]/34 hover:text-white"
              >
                Profile
              </Link>
              <Link
                href="/profile?tab=mail"
                onClick={() => playSfx('click')}
                className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-black/24 text-white/78 transition-colors hover:border-[#78f4df]/34 hover:text-white"
                aria-label="Open player mail"
                title="Player mail"
              >
                <MailIcon />
                {unreadMailCount > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#f8d86a] px-1.5 py-0.5 text-center text-[10px] font-black text-black">
                    {unreadMailLabel}
                  </span>
                )}
              </Link>
              <AudioControls />
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/64 transition-colors hover:border-red-300/34 hover:text-red-100"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/28 p-4 backdrop-blur-md">
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/42">Casino Balance</div>
              <div className="mt-2 text-2xl font-black text-[#fff8df]">{formatChips(profile?.chip_balance)}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/28 p-4 backdrop-blur-md">
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/42">Live Tables</div>
              <div className="mt-2 text-2xl font-black text-[#fff8df]">{pokerStats.tableCount + blackjackStats.tableCount}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/28 p-4 backdrop-blur-md">
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/42">Players Seated</div>
              <div className="mt-2 text-2xl font-black text-[#fff8df]">{pokerStats.playerCount + blackjackStats.playerCount}</div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {gameCards.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-dashed border-white/14 bg-black/20 px-4 py-4 text-sm text-white/58 backdrop-blur-md">
            More casino rooms can be added here as they come online.
          </div>
        </section>
      </div>
    </main>
  )
}
