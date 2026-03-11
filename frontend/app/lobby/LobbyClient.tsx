'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TableList } from '@/components/lobby/TableList'
import { LobbyChat } from '@/components/lobby/LobbyChat'
import { CreateTableModal } from '@/components/lobby/CreateTableModal'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { getSocket } from '@/lib/socket'
import { createClient } from '@/lib/supabase/client'
import { TableInfo, Profile } from '@/types/poker'
import { AvatarDisplay } from '@/components/ui/AvatarDisplay'
import { AudioControls } from '@/components/ui/AudioControls'
import { getTableTheme } from '@/lib/table-theme'
import { buildLobbyInvite, shareInvite } from '@/lib/invite'
import { useAudio } from '@/hooks/useAudio'

interface LobbyClientProps {
  initialTables: TableInfo[]
  profile: Profile | null
  token: string
  isAdmin: boolean
}

export function LobbyClient({ initialTables, profile, token, isAdmin }: LobbyClientProps) {
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
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [socketError, setSocketError] = useState('')

  const socket = getSocket(token)
  const joinTheme = getTableTheme(joinModal?.big_blind ?? 10)
  const activeTables = liveTables.filter((table) => table.status !== 'finished')
  const playersSeated = liveTables.reduce((sum, table) => sum + table.player_count, 0)
  const openSeats = liveTables.reduce((sum, table) => sum + Math.max(table.max_players - table.player_count, 0), 0)
  const featuredTable = [...liveTables].sort((a, b) => b.player_count - a.player_count || b.big_blind - a.big_blind)[0]
  const featuredStakes = featuredTable ? `${featuredTable.small_blind}/${featuredTable.big_blind}` : 'House warming up'

  useEffect(() => {
    if (socket.connected) setSocketStatus('connected')

    socket.on('connect', () => {
      setSocketStatus('connected')
      setSocketError('')
    })
    socket.on('connect_error', (err) => {
      setSocketStatus('error')
      setSocketError(err.message)
    })
    socket.on('disconnect', () => setSocketStatus('connecting'))

    return () => {
      socket.off('connect')
      socket.off('connect_error')
      socket.off('disconnect')
    }
  }, [socket])

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
      const timeout = setTimeout(() => {
        reject(new Error('Server not responding. It may be waking up - wait 30s and try again.'))
      }, 60000)

      socket.emit('create_table', params, (res: { tableId?: string; error?: string }) => {
        clearTimeout(timeout)
        if (res.error) {
          reject(new Error(res.error))
        } else {
          playSfx('joinLeave')
          router.push(`/table/${res.tableId}`)
          resolve()
        }
      })
    })
  }

  const handleJoinTable = (table: TableInfo) => {
    setBuyIn(table.min_buyin)
    setJoinModal(table)
    setError('')
  }

  const confirmJoin = async () => {
    if (!joinModal) return

    setLoading(true)
    setError('')
    socket.emit('join_table', { tableId: joinModal.id, buyIn }, (res: { seat?: number; error?: string }) => {
      setLoading(false)
      if (res.error) {
        setError(res.error)
      } else {
        playSfx('joinLeave')
        router.push(`/table/${joinModal.id}`)
      }
    })
  }

  const handleSignOut = async () => {
    playSfx('click')
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const handleInvite = async () => {
    try {
      await shareInvite(buildLobbyInvite(), process.env.NEXT_PUBLIC_DISCORD_URL)
      setInviteLabel('done')
      setTimeout(() => setInviteLabel('idle'), 2000)
    } catch {
      alert('Could not copy the invite. Please try again.')
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#120907] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(249,180,79,0.14),transparent_22%),linear-gradient(180deg,#120907_0%,#160a08_46%,#120907_100%)]" />
      <div
        className="absolute inset-x-0 top-0 h-[34rem] bg-no-repeat"
        style={{
          backgroundImage: "url('/lobby-background/ASL%20Dungeon%20Poker.png')",
          backgroundPosition: 'center top',
          backgroundSize: 'contain',
        }}
      />
      <div className="absolute inset-x-0 top-0 h-[36rem] bg-[linear-gradient(180deg,rgba(18,9,7,0.08)_0%,rgba(18,9,7,0.18)_32%,rgba(18,9,7,0.76)_78%,rgba(18,9,7,1)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,9,7,0.84)_0%,transparent_16%,transparent_84%,rgba(18,9,7,0.9)_100%)]" />
      <div className="absolute inset-x-0 top-[24rem] h-56 bg-[radial-gradient(circle,rgba(250,204,21,0.12),transparent_70%)] blur-3xl" />

      <div className="relative">
        <header className="sticky top-0 z-20 border-b border-[#f3d2a2]/10 bg-[#110907]/68 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#f3d2a2]/20 bg-[#f1b45b]/10 text-xl text-[#f7e7ce] shadow-[0_0_24px_rgba(241,180,91,0.18)]">
                &#9824;
              </span>
              <div>
                <div className="font-serif text-2xl tracking-wide text-[#fff3e2]">ASL Basement Poker</div>
                <p className="text-[11px] uppercase tracking-[0.34em] text-[#f3d2a2]/42">Drinks first. Cards after.</p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/62">
                <span
                  className={`h-2 w-2 rounded-full ${
                    socketStatus === 'connected'
                      ? 'bg-emerald-400'
                      : socketStatus === 'error'
                        ? 'bg-red-400'
                        : 'animate-pulse bg-amber-300'
                  }`}
                />
                <span>
                  {socketStatus === 'connected'
                    ? 'Bar open'
                    : socketStatus === 'error'
                      ? `Connection issue: ${socketError || 'offline'}`
                      : 'Pouring the room...' }
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 md:justify-end">
              {profile && (
                <div className="rounded-full border border-[#f3d2a2]/10 bg-black/20 px-4 py-2 text-left md:text-right">
                  <div className="text-sm font-semibold text-[#fff3e2]">{profile.username}</div>
                  <div className="text-xs uppercase tracking-[0.22em] text-[#f3d2a2]/64">Tab {profile.chip_balance.toLocaleString()} chips</div>
                </div>
              )}
              <button
                onClick={() => router.push('/profile')}
                className="flex-shrink-0 transition-all hover:scale-105"
                title="My Profile"
              >
                {profile?.avatar ? (
                  <AvatarDisplay avatarId={profile.avatar} size="md" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/28 text-xs font-medium text-white/62">
                    Profile
                  </div>
                )}
              </button>
              <AudioControls />
              <button
                onClick={handleInvite}
                className="rounded-full border border-[#f3d2a2]/14 bg-[#f1b45b] px-4 py-2 text-sm font-semibold text-[#20110a] transition-colors hover:bg-[#f4c272]"
                title="Copy invite and open Discord"
              >
                {inviteLabel === 'done' ? 'Invite copied' : 'Invite to the bar'}
              </button>
              {isAdmin && (
                <Link
                  href="/gm"
                  className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/76 transition-colors hover:border-[#f3d2a2]/28 hover:text-white"
                >
                  GM Chips
                </Link>
              )}
              <Button variant="ghost" size="sm" className="rounded-full" onClick={handleSignOut}>Sign Out</Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-8 pt-6 md:pt-10">
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
            <div className="rounded-[38px] border border-[#f3d2a2]/12 bg-[linear-gradient(180deg,rgba(18,9,7,0.68),rgba(18,9,7,0.26))] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.44)] backdrop-blur-md md:p-8">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex rounded-full border border-[#f3d2a2]/18 bg-[#f1b45b]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#f7dfba]">
                    Pre-game lounge
                  </div>
                  <h1 className="mt-5 max-w-xl font-serif text-5xl leading-[0.94] text-[#fff3e2] md:text-7xl">
                    Hang out by the drinks before the cards hit the felt.
                  </h1>
                  <p className="mt-5 max-w-xl text-base leading-7 text-[#ffe8ca]/76">
                    This is the spot to idle, talk, and see who is ready to play. When a table feels right, step out of the lounge and sit down with the room already warm.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
                  <Button
                    variant="primary"
                    size="lg"
                    className="rounded-full px-7 shadow-[0_18px_48px_rgba(241,180,91,0.24)]"
                    onClick={() => setShowCreate(true)}
                  >
                    Start a table
                  </Button>
                  <button
                    onClick={handleInvite}
                    className="rounded-full border border-white/15 bg-black/18 px-6 py-3 text-sm font-semibold text-white/80 transition-colors hover:border-[#f3d2a2]/28 hover:text-white"
                  >
                    {inviteLabel === 'done' ? 'Copied to clipboard' : 'Text the crew'}
                  </button>
                </div>
              </div>

              <div className="mt-10 grid gap-3 md:grid-cols-[1.15fr_1fr_1fr_1fr]">
                <div className="rounded-[28px] border border-[#f3d2a2]/14 bg-black/18 p-5">
                  <div className="text-[11px] uppercase tracking-[0.32em] text-[#f3d2a2]/46">Tonight&apos;s main table</div>
                  <div className="mt-3 font-serif text-3xl text-[#fff3e2]">{featuredStakes}</div>
                  <p className="mt-2 text-sm text-white/58">{featuredTable ? featuredTable.name : 'No table has the room talking yet.'}</p>
                </div>
                <div className="rounded-[28px] border border-white/10 bg-black/18 p-5">
                  <div className="text-[11px] uppercase tracking-[0.32em] text-white/42">Tables open</div>
                  <div className="mt-3 text-4xl font-bold text-white">{activeTables.length}</div>
                </div>
                <div className="rounded-[28px] border border-white/10 bg-black/18 p-5">
                  <div className="text-[11px] uppercase tracking-[0.32em] text-white/42">People inside</div>
                  <div className="mt-3 text-4xl font-bold text-white">{playersSeated}</div>
                </div>
                <div className="rounded-[28px] border border-white/10 bg-black/18 p-5">
                  <div className="text-[11px] uppercase tracking-[0.32em] text-white/42">Empty stools</div>
                  <div className="mt-3 text-4xl font-bold text-white">{openSeats}</div>
                </div>
              </div>
            </div>

            <aside className="flex flex-col gap-4 rounded-[38px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,10,8,0.82),rgba(20,10,8,0.46))] p-6 shadow-[0_34px_90px_rgba(0,0,0,0.42)] backdrop-blur-md">
              <div>
                <div className="text-[11px] uppercase tracking-[0.34em] text-[#f3d2a2]/45">By the bar</div>
                <div className="mt-3 font-serif text-3xl text-[#fff3e2]">{featuredTable ? 'People are already drifting toward a game.' : 'The room is open, but nobody has called first deal yet.'}</div>
                <p className="mt-3 text-sm leading-7 text-white/68">
                  {featuredTable
                    ? `${featuredTable.name} has ${featuredTable.player_count} out of ${featuredTable.max_players} seats taken. Good table if you want to step in without the awkward wait.`
                    : 'Start one soft table and the rest of the room usually follows. Empty lobbies die when nobody wants to be first.'}
                </p>
              </div>

              <div className="rounded-[28px] border border-[#f3d2a2]/12 bg-black/18 p-5">
                <div className="text-[11px] uppercase tracking-[0.28em] text-[#f3d2a2]/42">House chatter</div>
                <div className="mt-3 space-y-3 text-sm text-white/70">
                  <p>Use this page like a drinking spot. Linger, watch who joins, then move when the energy feels right.</p>
                  <p>The invite button works better once there is already one live table on the board.</p>
                </div>
              </div>

              <LobbyChat socket={socket} profile={profile} />

              <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                <div className="text-[11px] uppercase tracking-[0.28em] text-white/42">Tonight&apos;s pour</div>
                <div className="mt-3 flex items-center justify-between text-sm text-white/72">
                  <span>Realtime room sync</span>
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-emerald-200">
                    Fresh
                  </span>
                </div>
              </div>
            </aside>
          </section>

          <section className="mt-8 rounded-[38px] border border-white/8 bg-[linear-gradient(180deg,rgba(16,8,7,0.82),rgba(16,8,7,0.56))] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-md md:p-6">
            <div className="mb-5 flex flex-col gap-3 border-b border-white/8 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.34em] text-[#f3d2a2]/42">Tables</div>
                <h2 className="mt-2 font-serif text-4xl text-[#fff3e2]">Pick where the night goes next</h2>
                <p className="mt-2 text-sm text-white/58">Watch the room, join a warm table, or open one that turns the lounge into a game.</p>
              </div>
              <div className="rounded-full border border-white/10 bg-black/22 px-4 py-2 text-xs uppercase tracking-[0.28em] text-white/48">
                Live updates enabled
              </div>
            </div>

            <TableList initialTables={initialTables} onJoin={handleJoinTable} onTablesChange={setLiveTables} />
          </section>
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

