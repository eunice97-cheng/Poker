'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Socket } from 'socket.io-client'
import { TableList } from '@/components/lobby/TableList'
import { LobbyChat } from '@/components/lobby/LobbyChat'
import { CreateTableModal } from '@/components/lobby/CreateTableModal'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'
import { TableInfo, Profile } from '@/types/poker'
import { AvatarDisplay } from '@/components/ui/AvatarDisplay'
import { AudioControls } from '@/components/ui/AudioControls'
import { ExitIcon } from '@/components/ui/ExitIcon'
import { MailIcon } from '@/components/ui/MailIcon'
import { getTableTheme } from '@/lib/table-theme'
import { buildLobbyInvite, getDiscordUrl, shareInvite } from '@/lib/invite'
import { useAudio } from '@/hooks/useAudio'
import { useSocket } from '@/hooks/useSocket'
import { clearIntentionalTableExit } from '@/lib/table-exit'

interface LobbyClientProps {
  initialTables: TableInfo[]
  profile: Profile | null
  token: string
  unreadMailCount: number
  isAdmin: boolean
  hasVipEmojis: boolean
  isLocalAdmin?: boolean
}

type AckResponse = {
  error?: string
}

function emitWithAck<T>(
  socket: Socket,
  event: string,
  payload: unknown,
  timeoutMessage: string,
  timeoutMs: number = 60000
) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(timeoutMessage))
    }, timeoutMs)

    socket.emit(event, payload, (res: T & AckResponse) => {
      clearTimeout(timeout)
      if (res?.error) {
        reject(new Error(res.error))
        return
      }

      resolve(res)
    })
  })
}

export function LobbyClient({ initialTables, profile, token, unreadMailCount, isAdmin, hasVipEmojis, isLocalAdmin = false }: LobbyClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const { playSfx } = useAudio()
  const [liveTables, setLiveTables] = useState<TableInfo[]>(initialTables)
  const [showCreate, setShowCreate] = useState(false)
  const [joinModal, setJoinModal] = useState<TableInfo | null>(null)
  const [buyIn, setBuyIn] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inviteLabel, setInviteLabel] = useState<'idle' | 'done'>('idle')
  const { socket, connected, error: socketError, socketUrl } = useSocket(token)
  const joinTheme = getTableTheme(joinModal?.big_blind ?? 10)
  const activeTables = liveTables.filter((table) => table.status !== 'finished')
  const playersSeated = liveTables.reduce((sum, table) => sum + table.player_count, 0)
  const openSeats = liveTables.reduce((sum, table) => sum + Math.max(table.max_players - table.player_count, 0), 0)
  const featuredTable = [...liveTables].sort((a, b) => b.player_count - a.player_count || b.big_blind - a.big_blind)[0]
  const featuredStakes = featuredTable ? `${featuredTable.small_blind}/${featuredTable.big_blind}` : 'House warming up'
  const unreadMailLabel = unreadMailCount > 99 ? '99+' : unreadMailCount.toString()

  const handleCreateTable = (params: {
    name: string
    maxPlayers: number
    smallBlind: number
    bigBlind: number
    minBuyin: number
    maxBuyin: number
    buyIn: number
  }) => {
    return new Promise<void>((resolve, reject) => {
      if (!socket || !connected) {
        reject(new Error('Game server is still waking up. Give it a few seconds and try again.'))
        return
      }

      emitWithAck<{ tableId: string }>(
        socket,
        'create_table',
        params,
        'The game server is still waking up. Wait a moment, then try creating the table again.'
      )
        .then((res) => {
          clearIntentionalTableExit(res.tableId)
          playSfx('joinLeave')
          router.push(`/table/${res.tableId}`)
          resolve()
        })
        .catch(reject)
    })
  }

  const handleJoinTable = (table: TableInfo) => {
    setBuyIn(table.min_buyin)
    setJoinModal(table)
    setError('')
  }

  const confirmJoin = async () => {
    if (!joinModal) return

    if (!socket || !connected) {
      setError('Game server is still waking up. Give it a few seconds and try again.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await emitWithAck<{ seat?: number; observer?: boolean }>(
        socket,
        'join_table',
        { tableId: joinModal.id, buyIn },
        'The table is not responding yet. Render may still be waking the server up.'
      )
      clearIntentionalTableExit(joinModal.id)
      playSfx('joinLeave')
      router.push(`/table/${joinModal.id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join table'
      setError(
        message === 'Table not found'
          ? 'That table went cold while the server was waking up. Refresh the lobby or start a new one.'
          : message
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    playSfx('click')
    if (isLocalAdmin) {
      await fetch('/api/dev/local-admin-logout', { method: 'POST' })
    } else {
      await supabase.auth.signOut()
    }
    router.push('/auth/login')
  }

  const handleInvite = async () => {
    try {
      await shareInvite(buildLobbyInvite(), getDiscordUrl())
      setInviteLabel('done')
      setTimeout(() => setInviteLabel('idle'), 2000)
    } catch {
      alert('Could not copy the invite. Please try again.')
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#120907] text-white">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-no-repeat"
          style={{
            backgroundImage: "url('/lobby-background/ASL%20Dungeon%20Poker.png')",
            backgroundPosition: 'center top',
            backgroundSize: 'cover',
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,6,5,0.2)_0%,rgba(12,6,5,0.35)_24%,rgba(12,6,5,0.72)_58%,rgba(12,6,5,0.92)_82%,rgba(18,9,7,1)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,9,7,0.78)_0%,transparent_18%,transparent_82%,rgba(18,9,7,0.82)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/20 to-transparent" />
        <div className="absolute inset-x-0 top-[24rem] h-64 bg-[radial-gradient(circle,rgba(250,204,21,0.14),transparent_72%)] blur-3xl" />
      </div>

      <div className="relative z-10">
        <header className="casino-room-header sticky top-0 z-20 border-b border-[#f3d2a2]/10 bg-[#110907]/68 backdrop-blur-xl">
          <div className="casino-room-header__inner mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:py-4">
            <div className="casino-room-header__brand flex flex-wrap items-center gap-2.5 md:gap-3">
              <span className="casino-room-header__poker-logo relative flex h-11 w-11 items-center justify-center rounded-full border border-[#f3d2a2]/26 bg-[radial-gradient(circle_at_35%_30%,rgba(255,247,214,0.34),rgba(241,180,91,0.22)_32%,rgba(113,63,18,0.14)_72%,rgba(0,0,0,0.18)_100%)] shadow-[0_0_24px_rgba(241,180,91,0.22)]">
                <span className="absolute inset-[2px] rounded-full border border-[#fff1ba]/16" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#fff7cf] shadow-[0_0_12px_rgba(255,247,207,0.95)]" />
                <span className="absolute left-2 top-2 h-px w-4 rotate-[-18deg] bg-gradient-to-r from-transparent via-[#fff4bf] to-transparent opacity-85" />
                <span className="bg-[linear-gradient(180deg,#fff3bd_0%,#f3cf73_26%,#cc8c27_62%,#8f5b12_100%)] bg-clip-text text-xl text-transparent [text-shadow:0_2px_14px_rgba(243,207,115,0.34)]">
                  &#9824;
                </span>
              </span>
              <div className="casino-room-header__copy">
                <div className="casino-room-header__title font-serif text-xl tracking-wide text-[#fff3e2] sm:text-2xl">ASL Basement Poker</div>
                <p className="casino-room-header__subtitle text-[11px] uppercase tracking-[0.34em] text-[#f3d2a2]/42">Drinks first. Cards after.</p>
              </div>
              <div className="casino-room-header__status flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] text-white/62 md:text-xs">
                <span
                  className={`h-2 w-2 rounded-full ${
                    connected
                      ? 'bg-emerald-400'
                      : socketError
                        ? 'bg-red-400'
                        : 'animate-pulse bg-amber-300'
                  }`}
                />
                <span>
                  {connected
                    ? 'Bar open'
                    : socketError
                      ? `Connection issue: ${socketError}`
                      : 'Pouring the room...' }
                </span>
              </div>
              {socketError && socketUrl && (
                <div className="w-full text-[10px] uppercase tracking-[0.18em] text-white/35">
                  Socket {socketUrl}
                </div>
              )}
            </div>

            <div className="casino-room-header__actions flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              {profile && (
                <Link
                  href="/profile"
                  onClick={() => playSfx('click')}
                  className="casino-room-header__profile flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left transition-colors hover:border-[#f8d86a]/34 hover:bg-black/40"
                >
                  <AvatarDisplay avatarId={profile.avatar ?? 'avatar_m1'} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-white">{profile.username}</span>
                    <span className="block text-xs font-semibold text-[#f8d86a]">{profile.chip_balance.toLocaleString()} chips</span>
                  </span>
                </Link>
              )}
              <Link
                href="/"
                onClick={() => playSfx('click')}
                className="casino-room-header__main rounded-xl border border-white/10 bg-black/24 px-4 py-3 text-sm font-semibold text-white/78 transition-colors hover:border-[#f8d86a]/34 hover:text-white"
              >
                <span className="casino-room-header__main-full">Main Lobby</span>
                <span className="casino-room-header__main-short hidden">Main</span>
              </Link>
              <button
                onClick={handleInvite}
                className="casino-room-header__invite rounded-xl border border-[#f8d86a]/20 bg-[#f1b45b] px-4 py-3 text-sm font-semibold text-[#20110a] transition-colors hover:bg-[#f4c272]"
                title="Copy invite and open Discord"
              >
                {inviteLabel === 'done' ? 'Copied' : 'Invite'}
              </button>
              {isAdmin && (
                <Link
                  href="/gm"
                  className="casino-room-header__gm rounded-xl border border-white/10 bg-black/24 px-4 py-3 text-sm font-semibold text-white/78 transition-colors hover:border-[#f8d86a]/34 hover:text-white"
                >
                  GM
                </Link>
              )}
              <Link
                href="/profile?tab=mail"
                className="casino-room-header__icon relative flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-black/24 text-white/78 transition-colors hover:border-[#78f4df]/34 hover:text-white"
                title="Open mailbox"
                aria-label="Open mailbox"
              >
                <MailIcon className="h-5 w-5" />
                <span className="sr-only">Mailbox</span>
                {unreadMailCount > 0 && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-[#ef4444] px-2 py-0.5 text-[10px] font-bold text-white shadow-[0_0_18px_rgba(239,68,68,0.35)]">
                    {unreadMailLabel}
                  </span>
                )}
              </Link>
              <AudioControls buttonClassName="casino-room-header__icon flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-black/24 text-white/78 transition-colors hover:border-[#f8d86a]/34 hover:text-white" />
              <button
                type="button"
                onClick={handleSignOut}
                className="casino-room-header__icon flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/64 transition-colors hover:border-red-300/34 hover:bg-red-500/10 hover:text-red-100"
                title="Sign out"
                aria-label="Sign out"
              >
                <ExitIcon />
              </button>
            </div>
          </div>
        </header>

        <main className="casino-poker-lobby mx-auto max-w-7xl px-4 pb-24 pt-5 md:pb-8 md:pt-10">
          <section className="casino-poker-lobby__grid grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="casino-poker-lobby__card casino-poker-lobby__summary rounded-[30px] border border-[#f3d2a2]/12 bg-[linear-gradient(180deg,rgba(18,9,7,0.68),rgba(18,9,7,0.26))] p-5 shadow-[0_40px_120px_rgba(0,0,0,0.44)] backdrop-blur-md md:rounded-[38px] md:p-8">
              <div className="casino-poker-lobby__summary-content flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <div className="casino-poker-lobby__eyebrow inline-flex rounded-full border border-[#f3d2a2]/18 bg-[#f1b45b]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#f7dfba]">
                    Pre-game lounge
                  </div>
                  <h1 className="casino-poker-lobby__headline mt-5 max-w-xl font-serif text-[2.15rem] leading-[1.02] text-[#fff3e2] sm:text-4xl md:text-[3.35rem] xl:text-[3.65rem]">
                    Hang out by the drinks before the cards hit the felt.
                  </h1>
                  <p className="casino-poker-lobby__copy mt-4 max-w-xl text-sm leading-7 text-[#ffe8ca]/76 sm:text-base">
                    This is the spot to idle, talk, and see who is ready to play. When a table feels right, step out of the lounge and sit down with the room already warm.
                  </p>
                </div>

                <div className="casino-poker-lobby__cta flex flex-col items-stretch gap-3">
                  <Button
                    variant="primary"
                    size="lg"
                    className="casino-poker-lobby__primary-action w-full max-w-[176px] rounded-full px-7 shadow-[0_18px_48px_rgba(241,180,91,0.24)]"
                    onClick={() => setShowCreate(true)}
                  >
                    Start a table
                  </Button>
                  <button
                    onClick={handleInvite}
                    className="casino-poker-lobby__secondary-action w-full max-w-[176px] rounded-full border border-white/15 bg-black/18 px-6 py-3 text-sm font-semibold text-white/80 transition-colors hover:border-[#f3d2a2]/28 hover:text-white"
                  >
                    {inviteLabel === 'done' ? 'Copied to clipboard' : 'Text the crew'}
                  </button>
                </div>
              </div>

              <div className="casino-poker-lobby__stats mt-8 grid grid-cols-2 gap-3 md:mt-10 md:grid-cols-2">
                <div className="casino-poker-lobby__stat-card col-span-2 rounded-[24px] border border-[#f3d2a2]/14 bg-black/18 p-4 md:rounded-[28px] md:p-5">
                  <div className="casino-poker-lobby__stat-label text-[11px] uppercase tracking-[0.32em] text-[#f3d2a2]/46">Tonight&apos;s main table</div>
                  <div className="casino-poker-lobby__stat-value mt-3 font-serif text-3xl text-[#fff3e2]">{featuredStakes}</div>
                  <p className="casino-poker-lobby__stat-note mt-2 text-sm text-white/58">{featuredTable ? featuredTable.name : 'No table has the room talking yet.'}</p>
                </div>
                <div className="casino-poker-lobby__stat-card rounded-[24px] border border-white/10 bg-black/18 p-4 md:rounded-[28px] md:p-5">
                  <div className="casino-poker-lobby__stat-label text-[11px] uppercase tracking-[0.32em] text-white/42">Tables open</div>
                  <div className="casino-poker-lobby__stat-value mt-3 text-3xl font-bold text-white md:text-4xl">{activeTables.length}</div>
                </div>
                <div className="casino-poker-lobby__stat-card rounded-[24px] border border-white/10 bg-black/18 p-4 md:rounded-[28px] md:p-5">
                  <div className="casino-poker-lobby__stat-label text-[11px] uppercase tracking-[0.32em] text-white/42">People inside</div>
                  <div className="casino-poker-lobby__stat-value mt-3 text-3xl font-bold text-white md:text-4xl">{playersSeated}</div>
                </div>
                <div className="casino-poker-lobby__stat-card rounded-[24px] border border-white/10 bg-black/18 p-4 md:rounded-[28px] md:p-5">
                  <div className="casino-poker-lobby__stat-label text-[11px] uppercase tracking-[0.32em] text-white/42">Empty stools</div>
                  <div className="casino-poker-lobby__stat-value mt-3 text-3xl font-bold text-white md:text-4xl">{openSeats}</div>
                </div>
              </div>
            </div>

            <div className="casino-poker-lobby__card casino-poker-lobby__tables rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(16,8,7,0.82),rgba(16,8,7,0.56))] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-md md:rounded-[38px] md:p-6">
              <div className="casino-poker-lobby__tables-header mb-5 flex flex-col gap-3 border-b border-white/8 pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="casino-poker-lobby__tables-eyebrow text-[11px] uppercase tracking-[0.34em] text-[#f3d2a2]/42">Tables</div>
                  <h2 className="casino-poker-lobby__tables-title mt-2 font-serif text-3xl text-[#fff3e2] md:text-4xl">Pick where the night goes next</h2>
                  <p className="casino-poker-lobby__tables-copy mt-2 text-sm text-white/58">Watch the room, join a warm table, or open one that turns the lounge into a game.</p>
                </div>
                <div className="casino-poker-lobby__live-pill rounded-full border border-white/10 bg-black/22 px-4 py-2 text-xs uppercase tracking-[0.28em] text-white/48">
                  Live updates enabled
                </div>
              </div>

              <div className="casino-poker-lobby__table-list">
                <TableList
                  initialTables={initialTables}
                  onJoin={handleJoinTable}
                  onTablesChange={setLiveTables}
                  connected={connected}
                  socketUrl={socketUrl}
                />
              </div>
            </div>
          </section>
        
          <LobbyChat socket={socket} profile={profile} hasVipEmojis={hasVipEmojis} />
        </main>

        <CreateTableModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          chipBalance={profile?.chip_balance ?? 0}
          onCreate={handleCreateTable}
        />

        <Modal
          open={!!joinModal}
          onClose={() => setJoinModal(null)}
          title={`Join ${joinModal?.name ?? 'Table'}`}
        >
          {joinModal && (
            <div className={`space-y-4 rounded-xl border p-1 ${joinTheme.lobbyCardClass}`}>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className={`${joinTheme.lobbyPanelClass} rounded-lg p-3`}>
                  <div className="text-gray-500">Blinds</div>
                  <div className={`font-bold ${joinTheme.lobbyAccentClass}`}>{joinModal.small_blind}/{joinModal.big_blind}</div>
                </div>
                <div className={`${joinTheme.lobbyPanelClass} rounded-lg p-3`}>
                  <div className="text-gray-500">Buy-in Range</div>
                  <div className="font-bold text-white">{joinModal.min_buyin.toLocaleString()}-{joinModal.max_buyin.toLocaleString()}</div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-400">Your Buy-in</label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white outline-none focus:border-yellow-500"
                  value={buyIn}
                  onChange={(e) => setBuyIn(Number(e.target.value))}
                  min={joinModal.min_buyin}
                  max={Math.min(joinModal.max_buyin, profile?.chip_balance ?? 0)}
                />
                <p className="mt-1 text-xs text-gray-600">Your balance: {(profile?.chip_balance ?? 0).toLocaleString()}</p>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="ghost" className="flex-1" onClick={() => setJoinModal(null)}>Cancel</Button>
                <Button variant="primary" className="flex-1" loading={loading} onClick={confirmJoin}>
                  Take a Seat
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  )
}


