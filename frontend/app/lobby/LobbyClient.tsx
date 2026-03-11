'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TableList } from '@/components/lobby/TableList'
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
  const featuredTable = [...liveTables].sort((a, b) => b.big_blind - a.big_blind)[0]
  const hottestAction = featuredTable ? `${featuredTable.small_blind}/${featuredTable.big_blind}` : 'Waiting on the opener'

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
    <div className="relative min-h-screen overflow-hidden bg-[#080403] text-white">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(11,6,5,0.2) 0%, rgba(11,6,5,0.64) 34%, rgba(8,4,3,0.94) 72%, rgba(8,4,3,1) 100%), radial-gradient(circle at top, rgba(254,214,122,0.18), transparent 26%), url('/lobby-background/ASL%20Dungeon%20Poker.png')",
          backgroundPosition: 'center top',
          backgroundSize: 'cover',
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,4,3,0.78)_0%,transparent_26%,transparent_74%,rgba(8,4,3,0.85)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/35 to-transparent" />
      <div className="absolute inset-x-0 top-[26rem] h-40 bg-[radial-gradient(circle,rgba(245,158,11,0.16),transparent_68%)] blur-3xl" />

      <div className="relative">
        <header className="sticky top-0 z-20 border-b border-amber-200/10 bg-[#0a0606]/72 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-200/25 bg-amber-300/10 text-xl text-amber-100 shadow-[0_0_24px_rgba(245,158,11,0.2)]">
                &#9824;
              </span>
              <div>
                <div className="font-serif text-2xl tracking-wide text-amber-50">ASL Basement Poker</div>
                <p className="text-[11px] uppercase tracking-[0.36em] text-amber-100/45">Private room. Cash on the felt.</p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-white/65">
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
                    ? 'Table server live'
                    : socketStatus === 'error'
                      ? `Connection issue: ${socketError || 'offline'}`
                      : 'Connecting dealer...' }
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 md:justify-end">
              {profile && (
                <div className="rounded-full border border-amber-200/12 bg-black/25 px-4 py-2 text-left md:text-right">
                  <div className="text-sm font-semibold text-amber-50">{profile.username}</div>
                  <div className="text-xs uppercase tracking-[0.22em] text-amber-200/65">Bankroll {profile.chip_balance.toLocaleString()}</div>
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
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/30 text-xs font-medium text-white/60">
                    Profile
                  </div>
                )}
              </button>
              <AudioControls />
              <button
                onClick={handleInvite}
                className="rounded-full border border-amber-200/20 bg-amber-500/90 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-amber-400"
                title="Copy invite and open Discord"
              >
                {inviteLabel === 'done' ? 'Invite copied' : 'Bring players in'}
              </button>
              {isAdmin && (
                <Link
                  href="/gm"
                  className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/75 transition-colors hover:border-amber-200/35 hover:text-white"
                >
                  GM Chips
                </Link>
              )}
              <Button variant="ghost" size="sm" className="rounded-full" onClick={handleSignOut}>Sign Out</Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-8 pt-6 md:pt-10">
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px]">
            <div className="rounded-[36px] border border-amber-200/12 bg-[linear-gradient(180deg,rgba(8,4,3,0.72),rgba(8,4,3,0.3))] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.45)] backdrop-blur-md md:p-8">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex rounded-full border border-amber-300/20 bg-amber-200/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-100">
                    Underground action
                  </div>
                  <h1 className="mt-5 max-w-xl font-serif text-5xl leading-[0.94] text-amber-50 md:text-7xl">
                    The room is warm. The table is not.
                  </h1>
                  <p className="mt-5 max-w-xl text-base leading-7 text-amber-50/74">
                    Pick a live table, sit down with chips, and let the dealer handle the rest. This lobby should feel like walking into the game, not opening a spreadsheet.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
                  <Button
                    variant="primary"
                    size="lg"
                    className="rounded-full px-7 shadow-[0_18px_48px_rgba(245,158,11,0.28)]"
                    onClick={() => setShowCreate(true)}
                  >
                    Host a table
                  </Button>
                  <button
                    onClick={handleInvite}
                    className="rounded-full border border-white/15 bg-black/20 px-6 py-3 text-sm font-semibold text-white/80 transition-colors hover:border-amber-200/35 hover:text-white"
                  >
                    {inviteLabel === 'done' ? 'Copied to clipboard' : 'Share the room'}
                  </button>
                </div>
              </div>

              <div className="mt-10 grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
                <div className="rounded-[28px] border border-amber-200/14 bg-black/22 p-5">
                  <div className="text-[11px] uppercase tracking-[0.32em] text-amber-200/46">Featured stakes</div>
                  <div className="mt-3 font-serif text-3xl text-amber-50">{hottestAction}</div>
                  <p className="mt-2 text-sm text-white/58">{featuredTable ? featuredTable.name : 'Open the first table and set the tone.'}</p>
                </div>
                <div className="rounded-[28px] border border-white/10 bg-black/22 p-5">
                  <div className="text-[11px] uppercase tracking-[0.32em] text-white/42">Tables open</div>
                  <div className="mt-3 text-4xl font-bold text-white">{activeTables.length}</div>
                </div>
                <div className="rounded-[28px] border border-white/10 bg-black/22 p-5">
                  <div className="text-[11px] uppercase tracking-[0.32em] text-white/42">Players seated</div>
                  <div className="mt-3 text-4xl font-bold text-white">{playersSeated}</div>
                </div>
                <div className="rounded-[28px] border border-white/10 bg-black/22 p-5">
                  <div className="text-[11px] uppercase tracking-[0.32em] text-white/42">Seats open</div>
                  <div className="mt-3 text-4xl font-bold text-white">{openSeats}</div>
                </div>
              </div>
            </div>

            <aside className="flex flex-col gap-4 rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,6,6,0.82),rgba(10,6,6,0.44))] p-6 shadow-[0_34px_90px_rgba(0,0,0,0.42)] backdrop-blur-md">
              <div>
                <div className="text-[11px] uppercase tracking-[0.34em] text-amber-100/45">Floor notes</div>
                <div className="mt-3 font-serif text-3xl text-amber-50">{featuredTable ? 'High attention table' : 'No hands on the felt yet'}</div>
                <p className="mt-3 text-sm leading-7 text-white/68">
                  {featuredTable
                    ? `${featuredTable.name} is carrying the room right now with ${featuredTable.player_count} of ${featuredTable.max_players} seats occupied.`
                    : 'Start a table and the room will switch from quiet lounge to active floor.'}
                </p>
              </div>

              <div className="rounded-[28px] border border-amber-200/12 bg-black/18 p-5">
                <div className="text-[11px] uppercase tracking-[0.28em] text-amber-100/42">House read</div>
                <div className="mt-3 space-y-3 text-sm text-white/70">
                  <p>Warm low-stakes tables move fastest when the first player hosts instead of waiting for a full room.</p>
                  <p>Use the invite button once the first table exists. Empty lobbies do not convert.</p>
                </div>
              </div>

              <div className="mt-auto rounded-[28px] border border-white/10 bg-black/20 p-5">
                <div className="text-[11px] uppercase tracking-[0.28em] text-white/42">Live status</div>
                <div className="mt-3 flex items-center justify-between text-sm text-white/72">
                  <span>Realtime lobby sync</span>
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-emerald-200">
                    On
                  </span>
                </div>
              </div>
            </aside>
          </section>

          <section className="mt-8 rounded-[36px] border border-white/8 bg-[linear-gradient(180deg,rgba(9,5,4,0.82),rgba(9,5,4,0.58))] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-md md:p-6">
            <div className="mb-5 flex flex-col gap-3 border-b border-white/8 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.34em] text-amber-100/42">Table board</div>
                <h2 className="mt-2 font-serif text-4xl text-amber-50">Choose your seat</h2>
                <p className="mt-2 text-sm text-white/58">The board updates live. Full tables stay visible so the room still feels occupied.</p>
              </div>
              <div className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs uppercase tracking-[0.28em] text-white/48">
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
