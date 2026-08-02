'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AvatarDisplay } from '@/components/ui/AvatarDisplay'
import { AudioControls } from '@/components/ui/AudioControls'
import { MailIcon } from '@/components/ui/MailIcon'
import { LobbyChat } from '@/components/lobby/LobbyChat'
import { useAudio } from '@/hooks/useAudio'
import { useSocket } from '@/hooks/useSocket'
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
  token: string | null
  hasVipEmojis: boolean
  isLocalAdmin?: boolean
}

type CasinoGameCard = {
  id: 'poker' | 'blackjack'
  title: string
  roomLabel: string
  href: string
  image: string
  aspectRatio: string
  tone: 'gold' | 'teal'
  stats: CasinoGameStats
}

const games: Omit<CasinoGameCard, 'stats'>[] = [
  {
    id: 'poker',
    title: 'Basement Poker',
    roomLabel: 'Texas Holdem',
    href: '/lobby',
    image: '/casino-lobby/poker-poster.png',
    aspectRatio: '941 / 1672',
    tone: 'gold',
  },
  {
    id: 'blackjack',
    title: 'BlackJack Lounge',
    roomLabel: 'House Dealer',
    href: '/blackjack',
    image: '/casino-lobby/blackjack-poster.png',
    aspectRatio: '992 / 1586',
    tone: 'teal',
  },
]

function formatChips(value: number | undefined) {
  return (value ?? 0).toLocaleString()
}

function GameCard({ game }: { game: CasinoGameCard }) {
  const { playSfx } = useAudio()
  const badge =
    game.tone === 'gold'
      ? 'border-[#f8d86a]/45 bg-[#f8d86a]/14 text-[#fff0be]'
      : 'border-[#76f4dc]/42 bg-[#1da58e]/15 text-[#c8fff4]'

  return (
    <Link
      href={game.href}
      onClick={() => playSfx('click')}
      className="group relative flex min-h-[34rem] max-h-[44rem] overflow-hidden rounded-[22px] border border-[#d9ad5a]/26 bg-black/74 shadow-[0_30px_90px_rgba(0,0,0,0.42)] outline-none transition-transform duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-[#f8d86a]/70"
      style={{ aspectRatio: game.aspectRatio }}
      aria-label={`Enter ${game.title}`}
    >
      <img
        src={game.image}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.018]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04)_0%,transparent_34%,rgba(0,0,0,0.18)_64%,rgba(0,0,0,0.74)_100%)]" />
      <div className="pointer-events-none absolute inset-[10px] rounded-[16px] border border-[#f5d07c]/18" />

      <div className="relative z-10 flex w-full flex-col justify-between p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] backdrop-blur-md ${badge}`}>
            {game.roomLabel}
          </div>
        </div>

        <div className="rounded-[18px] border border-[#f5d07c]/18 bg-black/68 p-3 shadow-[0_18px_44px_rgba(0,0,0,0.36)] backdrop-blur-md">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2.5">
              <div className="text-xl font-bold text-white">{game.stats.tableCount}</div>
              <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/48">Tables</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2.5">
              <div className="text-xl font-bold text-white">{game.stats.playerCount}</div>
              <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/48">Players</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2.5">
              <div className="text-xl font-bold text-white">{game.stats.openSeats}</div>
              <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/48">Seats</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1 text-sm">
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
  token,
  hasVipEmojis,
  isLocalAdmin = false,
}: CasinoLobbyClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const { playSfx } = useAudio()
  const { socket, connected, error: socketError } = useSocket(token)
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
          style={{ backgroundImage: "url('/casino-lobby/lobby-background.png')" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,5,6,0.82)_0%,rgba(5,8,10,0.38)_28%,rgba(9,7,6,0.28)_58%,rgba(4,5,6,0.86)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.34)_0%,rgba(0,0,0,0.16)_30%,rgba(3,5,6,0.78)_78%,rgba(3,5,6,0.98)_100%)]" />
      </div>

      <div className="relative z-10">
        <header className="border-b border-[#d9ad5a]/16 bg-black/36 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.34em] text-[#d9ad5a]/82">Arcana Casino</div>
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
              <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-black/24 px-3 py-3 text-xs font-semibold text-white/62 xl:flex">
                <span
                  className={`h-2 w-2 rounded-full ${
                    connected
                      ? 'bg-emerald-400'
                      : socketError
                        ? 'bg-red-400'
                        : 'animate-pulse bg-amber-300'
                  }`}
                />
                <span>{connected ? 'Chat live' : socketError ? 'Chat waking' : 'Connecting'}</span>
              </div>
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

        <section className="mx-auto max-w-6xl px-4 pb-36 pt-8 sm:px-6 lg:pb-40 lg:pt-10">
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

          <div className="grid gap-3 sm:grid-cols-3">
            <GameCard game={gameCards[0]} />
            <div className="hidden sm:block" aria-hidden="true" />
            <GameCard game={gameCards[1]} />
          </div>

          <div className="mt-5 rounded-xl border border-dashed border-[#d9ad5a]/22 bg-black/28 px-4 py-4 text-sm text-[#f7dfae]/70 backdrop-blur-md">
            More casino rooms can be added here as they come online.
          </div>
        </section>

        <LobbyChat socket={socket} profile={profile} hasVipEmojis={hasVipEmojis} />
      </div>
    </main>
  )
}
