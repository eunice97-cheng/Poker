'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AvatarDisplay } from '@/components/ui/AvatarDisplay'
import { AudioControls } from '@/components/ui/AudioControls'
import { ExitIcon } from '@/components/ui/ExitIcon'
import { MailIcon } from '@/components/ui/MailIcon'
import { LobbyChat } from '@/components/lobby/LobbyChat'
import { createClient } from '@/lib/supabase/client'
import { useAudio } from '@/hooks/useAudio'
import { useSocket } from '@/hooks/useSocket'
import type { Profile } from '@/types/poker'

const BACCARAT_TABLE_ID = 'punto-banco-main'
const BACCARAT_MIN_BET = 100
const BACCARAT_MAX_BET = 10000
const BACCARAT_SEATS = 6
const BACCARAT_CHIPS = [100, 500, 1000, 5000]

interface BaccaratLobbyClientProps {
  profile: Profile
  token: string
  hasVipEmojis: boolean
  unreadMailCount: number
  isAdmin: boolean
  isLocalAdmin?: boolean
}

function formatChips(value: number) {
  return value.toLocaleString()
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#d7b35f]/16 bg-black/30 p-4 backdrop-blur-sm">
      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#d7b35f]/58">{label}</div>
      <div className="mt-2 text-2xl font-black text-[#fff8df]">{value}</div>
    </div>
  )
}

function ChipFace({ value }: { value: number }) {
  if (value === 5000) {
    return (
      <img
        src="/baccarat/Images/Chips/5000.png"
        alt="5,000 chip"
        className="-mx-1.5 -my-1.5 h-[60px] w-[60px] rounded-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.42)]"
      />
    )
  }

  return (
    <span
      className="grid h-12 w-12 place-items-center rounded-full border border-[#ffe8a3]/50 bg-[radial-gradient(circle_at_35%_28%,#fff5cf_0%,#d8ad44_18%,#4b230e_52%,#120805_100%)] text-[10px] font-black text-[#1b0d05] shadow-[0_12px_24px_rgba(0,0,0,0.38),inset_0_0_0_3px_rgba(255,255,255,0.16)]"
      aria-label={`${value.toLocaleString()} chip`}
    >
      {value >= 1000 ? '1K' : value}
    </span>
  )
}

export function BaccaratLobbyClient({
  profile,
  token,
  hasVipEmojis,
  unreadMailCount,
  isAdmin,
  isLocalAdmin = false,
}: BaccaratLobbyClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const { playSfx } = useAudio()
  const { socket, connected, error: socketError } = useSocket(token)
  const unreadMailLabel = unreadMailCount > 99 ? '99+' : unreadMailCount.toString()
  const canEnterTable = profile.chip_balance >= BACCARAT_MIN_BET
  const connectionLabel = connected ? 'Lounge chat live' : socketError ? 'Chat waking' : 'Opening lounge'

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
    <main className="relative min-h-screen overflow-hidden bg-[#050705] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/baccarat/Images/baccarat-lobby.png')" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,5,4,0.88)_0%,rgba(3,10,7,0.5)_28%,rgba(8,7,5,0.22)_58%,rgba(3,5,4,0.84)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.44)_0%,rgba(0,0,0,0.12)_34%,rgba(2,5,4,0.76)_78%,rgba(2,5,4,0.96)_100%)]" />
      </div>

      <div className="relative z-10">
        <header className="sticky top-0 z-20 border-b border-[#d7b35f]/18 bg-black/48 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <img
                src="/baccarat/Images/baccarat-logo.png"
                alt="ASL Baccarat Lounge"
                className="h-14 w-20 object-contain drop-shadow-[0_0_18px_rgba(215,179,95,0.26)]"
              />
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.34em] text-[#d7b35f]/66">ASL Gaming Casino</div>
                <h1 className="truncate font-serif text-3xl font-black uppercase tracking-[0.12em] text-[#fff3c8]">Baccarat Lounge</h1>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[#d7b35f]/18 bg-black/32 px-3 py-1.5 text-xs text-white/72">
                <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-300' : socketError ? 'bg-red-400' : 'animate-pulse bg-amber-300'}`} />
                <span>{connectionLabel}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                href="/profile"
                onClick={() => playSfx('click')}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-left transition-colors hover:border-[#d7b35f]/40 hover:bg-black/44"
              >
                <AvatarDisplay avatarId={profile.avatar} size="sm" className="border-[#d7b35f]/35" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-white">{profile.username}</span>
                  <span className="block text-xs font-semibold text-[#f8d86a]">{formatChips(profile.chip_balance)} chips</span>
                </span>
              </Link>
              <Link
                href="/"
                onClick={() => playSfx('click')}
                className="rounded-lg border border-white/10 bg-black/24 px-4 py-3 text-sm font-semibold text-white/78 transition-colors hover:border-[#d7b35f]/40 hover:text-white"
              >
                Main Lobby
              </Link>
              {isAdmin && (
                <Link
                  href="/gm"
                  onClick={() => playSfx('click')}
                  className="rounded-lg border border-white/10 bg-black/24 px-4 py-3 text-sm font-semibold text-white/78 transition-colors hover:border-[#d7b35f]/40 hover:text-white"
                >
                  GM
                </Link>
              )}
              <Link
                href="/profile?tab=mail"
                onClick={() => playSfx('click')}
                className="relative flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-black/24 text-white/78 transition-colors hover:border-[#78f4df]/34 hover:text-white"
                aria-label="Open player mail"
                title="Player mail"
              >
                <MailIcon className="h-5 w-5" />
                {unreadMailCount > 0 && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-[#ef4444] px-2 py-0.5 text-[10px] font-bold text-white">
                    {unreadMailLabel}
                  </span>
                )}
              </Link>
              <AudioControls buttonClassName="flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-black/24 text-white/78 transition-colors hover:border-[#d7b35f]/40 hover:text-white" />
              <button
                type="button"
                onClick={handleSignOut}
                className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/64 transition-colors hover:border-red-300/34 hover:bg-red-500/10 hover:text-red-100"
                title="Sign out"
                aria-label="Sign out"
              >
                <ExitIcon />
              </button>
            </div>
          </div>
        </header>

        <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-36 pt-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:pt-10 lg:pb-40">
          <section className="rounded-lg border border-[#d7b35f]/18 bg-black/36 p-5 shadow-[0_34px_90px_rgba(0,0,0,0.42)] backdrop-blur-sm md:p-7" aria-label="Baccarat lounge summary">
            <div className="inline-flex rounded-full border border-[#d7b35f]/24 bg-[#d7b35f]/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.28em] text-[#ffe6a7]">
              Punto Banco
            </div>
            <h2 className="mt-5 max-w-3xl font-serif text-4xl leading-[0.95] text-[#fff7df] sm:text-5xl">
              Fast house table, shared shoe, clean Baccarat stakes.
            </h2>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <Stat label="Tables" value="1" />
              <Stat label="Seats" value={BACCARAT_SEATS.toString()} />
              <Stat label="Min bet" value={formatChips(BACCARAT_MIN_BET)} />
              <Stat label="Max bet" value={formatChips(BACCARAT_MAX_BET)} />
            </div>

            <div className="mt-6 rounded-lg border border-[#d7b35f]/16 bg-[linear-gradient(180deg,rgba(12,18,12,0.76),rgba(3,7,5,0.62))] p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#d7b35f]/62">Baccarat chips</div>
              <div className="mt-3 flex flex-wrap gap-3">
                {BACCARAT_CHIPS.map((value) => <ChipFace key={value} value={value} />)}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-[linear-gradient(180deg,rgba(13,18,12,0.82),rgba(4,7,5,0.68))] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-md md:p-6" aria-label="Baccarat tables">
            <div className="mb-5 flex flex-col gap-3 border-b border-white/8 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.34em] text-[#d7b35f]/48">Tables</div>
                <h2 className="mt-2 font-serif text-3xl text-[#fff3e2] md:text-4xl">Choose a Baccarat table</h2>
              </div>
              <div className="rounded-full border border-white/10 bg-black/22 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/52">
                ASL Casino Room
              </div>
            </div>

            <article className="relative overflow-hidden rounded-lg border border-[#d7b35f]/22 bg-black/48 shadow-[0_26px_68px_rgba(0,0,0,0.44)]">
              <img src="/baccarat/Images/baccarat-table.png" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-40" />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,8,5,0.94)_0%,rgba(3,8,5,0.82)_46%,rgba(3,8,5,0.44)_100%)]" />
              <div className="relative z-10 grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:p-6">
                <div>
                  <div className="mb-3 inline-flex rounded-full border border-emerald-200/18 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-100">
                    Open
                  </div>
                  <h3 className="font-serif text-3xl text-[#fff7df]">Punto Banco Main Salon</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/66">
                    Banker, Player, and Tie betting with standard third-card rules.
                  </p>
                  <div className="mt-5 grid max-w-xl grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div className="rounded-lg border border-[#d7b35f]/16 bg-black/34 px-3 py-2">
                      <span className="block text-[10px] uppercase tracking-[0.16em] text-[#d7b35f]/58">Min</span>
                      <strong className="text-[#ffe6a7]">{formatChips(BACCARAT_MIN_BET)}</strong>
                    </div>
                    <div className="rounded-lg border border-[#d7b35f]/16 bg-black/34 px-3 py-2">
                      <span className="block text-[10px] uppercase tracking-[0.16em] text-[#d7b35f]/58">Max</span>
                      <strong className="text-[#ffe6a7]">{formatChips(BACCARAT_MAX_BET)}</strong>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/34 px-3 py-2">
                      <span className="block text-[10px] uppercase tracking-[0.16em] text-white/46">Seats</span>
                      <strong>{BACCARAT_SEATS}</strong>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/34 px-3 py-2">
                      <span className="block text-[10px] uppercase tracking-[0.16em] text-white/46">Shoe</span>
                      <strong>8 Deck</strong>
                    </div>
                  </div>
                </div>

                <div className="flex min-w-[190px] flex-col justify-end gap-3">
                  {canEnterTable ? (
                    <Link
                      href={`/baccarat/table/${BACCARAT_TABLE_ID}`}
                      onClick={() => playSfx('click')}
                      className="rounded-lg bg-[linear-gradient(135deg,#f1cf72,#b9822e)] px-5 py-4 text-center text-sm font-black uppercase tracking-[0.16em] text-[#160b04] shadow-[0_18px_42px_rgba(0,0,0,0.36)] transition-transform hover:-translate-y-0.5"
                    >
                      Enter Table
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-5 py-4 text-center text-sm font-black uppercase tracking-[0.16em] text-white/38"
                    >
                      Need 100 Chips
                    </button>
                  )}
                  <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-center text-xs text-white/56">
                    Balance: <span className="font-bold text-[#ffe6a7]">{formatChips(profile.chip_balance)}</span>
                  </div>
                </div>
              </div>
            </article>
          </section>
        </section>

        <LobbyChat socket={socket} profile={profile} hasVipEmojis={hasVipEmojis} />
      </div>
    </main>
  )
}
