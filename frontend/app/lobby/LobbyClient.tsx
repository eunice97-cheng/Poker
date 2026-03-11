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
    <div className="relative min-h-screen overflow-hidden bg-[#08110f] text-white">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(3,8,7,0.42) 0%, rgba(3,8,7,0.78) 38%, rgba(3,8,7,0.96) 100%), radial-gradient(circle at top right, rgba(212,175,55,0.18), transparent 32%), url('/lobby-background/ASL%20Dungeon%20Poker.png')",
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.09),_transparent_24%),linear-gradient(135deg,_rgba(255,255,255,0.04)_0%,_transparent_40%)]" />
      <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-amber-200/10 to-transparent blur-3xl" />

      <div className="relative">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07100e]/72 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/10 text-2xl text-amber-100 shadow-[0_0_30px_rgba(250,204,21,0.12)]">
                &#9824;
              </span>
              <div>
                <h1 className="text-xl font-bold text-white">ASL Basement Poker</h1>
                <p className="text-xs uppercase tracking-[0.25em] text-white/45">Private lobby</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs">
                <span
                  className={`h-2 w-2 rounded-full ${
                    socketStatus === 'connected'
                      ? 'bg-green-400'
                      : socketStatus === 'error'
                        ? 'bg-red-400'
                        : 'animate-pulse bg-yellow-400'
                  }`}
                />
                <span className="text-white/60">
                  {socketStatus === 'connected'
                    ? 'Server online'
                    : socketStatus === 'error'
                      ? `Error: ${socketError || 'Server offline'}`
                      : 'Connecting...'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 md:justify-end">
              {profile && (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-left md:text-right">
                  <div className="font-semibold text-white">{profile.username}</div>
                  <div className="text-sm font-bold text-yellow-300">{profile.chip_balance.toLocaleString()} chips</div>
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
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-gray-600 bg-gray-800 text-xs font-medium text-gray-400 transition-colors hover:border-yellow-500 hover:text-white">
                    Profile
                  </div>
                )}
              </button>
              <AudioControls />
              <button
                onClick={handleInvite}
                className="flex items-center gap-1.5 rounded-xl border border-indigo-400/25 bg-indigo-500/85 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-400"
                title="Copy invite and open Discord"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" /></svg>
                {inviteLabel === 'done' ? 'Copied' : 'Invite'}
              </button>
              {isAdmin && (
                <Link
                  href="/gm"
                  className="rounded-xl border border-yellow-700/80 px-3 py-2 text-sm font-semibold text-yellow-300 transition-colors hover:border-yellow-500 hover:text-white"
                >
                  GM Chips
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={handleSignOut}>Sign Out</Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 md:py-8">
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
            <div className="overflow-hidden rounded-[32px] border border-white/10 bg-black/30 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.38)] backdrop-blur-md md:p-8">
              <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <div className="mb-3 inline-flex rounded-full border border-amber-300/20 bg-amber-200/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100">
                    Tonight's tables
                  </div>
                  <h2 className="max-w-xl text-4xl font-bold tracking-tight text-white md:text-5xl">
                    Take a seat before the next hand starts.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-white/68 md:text-base">
                    The lobby now treats the background as part of the room. Open tables stay in the foreground, and the live seat count updates as players come and go.
                  </p>
                </div>
                <Button variant="primary" size="lg" className="w-full sm:w-auto" onClick={() => setShowCreate(true)}>
                  + Create Table
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">Active tables</div>
                  <div className="mt-2 text-3xl font-bold text-white">{activeTables.length}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">Players seated</div>
                  <div className="mt-2 text-3xl font-bold text-white">{playersSeated}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">Open seats</div>
                  <div className="mt-2 text-3xl font-bold text-white">{openSeats}</div>
                </div>
              </div>
            </div>

            <aside className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(0,0,0,0.42),rgba(0,0,0,0.22))] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.32)] backdrop-blur-md">
              <div className="text-[11px] uppercase tracking-[0.28em] text-white/45">Featured action</div>
              <div className="mt-3 text-2xl font-bold text-white">{featuredTable ? featuredTable.name : 'No headline table yet'}</div>
              <p className="mt-3 text-sm leading-6 text-white/65">
                {featuredTable
                  ? `${featuredTable.small_blind}/${featuredTable.big_blind} blinds with ${featuredTable.player_count} of ${featuredTable.max_players} seats taken.`
                  : 'Create a table to put the first game on the board.'}
              </p>

              <div className="mt-6 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">Fast join</div>
                  <div className="mt-2 text-sm text-white/70">Pick any card below and buy in directly from the join modal.</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">Background slot</div>
                  <div className="mt-2 text-sm text-white/70">Lobby artwork is wired to <span className="font-mono text-white/90">frontend/public/lobby-background/ASL Dungeon Poker.png</span>.</div>
                </div>
              </div>
            </aside>
          </section>

          <section className="mt-8">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white">Open tables</h3>
                <p className="text-sm text-white/55">Join an active game or start a fresh table.</p>
              </div>
              <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/50">
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

