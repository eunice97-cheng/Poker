'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Socket } from 'socket.io-client'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { AvatarDisplay } from '@/components/ui/AvatarDisplay'
import { AudioControls } from '@/components/ui/AudioControls'
import { ExitIcon } from '@/components/ui/ExitIcon'
import { MailIcon } from '@/components/ui/MailIcon'
import { LobbyChat } from '@/components/lobby/LobbyChat'
import { createClient } from '@/lib/supabase/client'
import { buildBlackjackLobbyInvite, getDiscordUrl, shareInvite } from '@/lib/invite'
import { useSocket } from '@/hooks/useSocket'
import type { BlackjackTableInfo } from '@/types/blackjack'
import type { Profile } from '@/types/poker'

interface BlackjackLobbyClientProps {
  initialTables: BlackjackTableInfo[]
  profile: Profile
  token: string
  hasVipEmojis: boolean
  unreadMailCount: number
  isAdmin: boolean
  isLocalAdmin?: boolean
}

type LiveBlackjackTable = {
  id: string
  name: string
  hostId: string | null
  maxPlayers: number
  minBet: number
  maxBet: number
  minBuyin: number
  maxBuyin: number
  status: BlackjackTableInfo['status']
  playerCount: number
  gameType: 'blackjack'
}

type AckResponse = {
  tableId?: string
  balance?: number
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

function normalizeTable(table: BlackjackTableInfo | LiveBlackjackTable): BlackjackTableInfo {
  if ('playerCount' in table) {
    return {
      id: table.id,
      name: table.name,
      host_id: table.hostId,
      game_type: 'blackjack',
      max_players: table.maxPlayers,
      small_blind: table.minBet,
      big_blind: table.maxBet,
      min_buyin: table.minBuyin,
      max_buyin: table.maxBuyin,
      status: table.status,
      player_count: table.playerCount,
    }
  }

  return table
}

function tableLimitLabel(table: BlackjackTableInfo) {
  return `${table.small_blind.toLocaleString()}-${table.big_blind.toLocaleString()}`
}

export function BlackjackLobbyClient({ initialTables, profile, token, hasVipEmojis, unreadMailCount, isAdmin, isLocalAdmin = false }: BlackjackLobbyClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const { socket, connected, error: socketError, socketUrl } = useSocket(token)
  const [tables, setTables] = useState(initialTables)
  const [showCreate, setShowCreate] = useState(false)
  const [joinModal, setJoinModal] = useState<BlackjackTableInfo | null>(null)
  const [buyIn, setBuyIn] = useState(1000)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inviteLabel, setInviteLabel] = useState<'idle' | 'done'>('idle')

  const activeTables = tables.filter((table) => table.status !== 'finished')
  const playersSeated = activeTables.reduce((sum, table) => sum + table.player_count, 0)
  const openSeats = activeTables.reduce((sum, table) => sum + Math.max(table.max_players - table.player_count, 0), 0)
  const featuredTable = [...activeTables].sort((a, b) => b.player_count - a.player_count || b.big_blind - a.big_blind)[0]
  const featuredLimits = featuredTable ? tableLimitLabel(featuredTable) : '10-5,000'
  const unreadMailLabel = unreadMailCount > 99 ? '99+' : unreadMailCount.toString()

  useEffect(() => {
    if (!socket) return

    const upsertTable = (incoming: BlackjackTableInfo | LiveBlackjackTable) => {
      const nextTable = normalizeTable(incoming)
      setTables((prev) => {
        const exists = prev.some((table) => table.id === nextTable.id)
        if (exists) return prev.map((table) => (table.id === nextTable.id ? nextTable : table))
        return [nextTable, ...prev]
      })
    }

    const deleteTable = (data: { tableId: string }) => {
      setTables((prev) => prev.filter((table) => table.id !== data.tableId))
    }

    socket.on('blackjack_table_created', upsertTable)
    socket.on('blackjack_table_updated', upsertTable)
    socket.on('blackjack_table_deleted', deleteTable)

    return () => {
      socket.off('blackjack_table_created', upsertTable)
      socket.off('blackjack_table_updated', upsertTable)
      socket.off('blackjack_table_deleted', deleteTable)
    }
  }, [socket])

  useEffect(() => {
    if (!connected || !socketUrl) return

    const controller = new AbortController()

    const syncLiveRooms = async () => {
      try {
        const res = await fetch(`${socketUrl}/blackjack/tables`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) return
        const liveTables = (await res.json()) as BlackjackTableInfo[]
        setTables(liveTables.map(normalizeTable))
      } catch (err) {
        if (!controller.signal.aborted) console.warn('Failed to sync blackjack tables:', err)
      }
    }

    void syncLiveRooms()

    return () => controller.abort()
  }, [connected, socketUrl])

  const handleSignOut = async () => {
    if (isLocalAdmin) {
      router.push('/api/dev/local-admin-logout')
      return
    }

    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const handleInvite = async () => {
    try {
      await shareInvite(buildBlackjackLobbyInvite(), getDiscordUrl())
      setInviteLabel('done')
      window.setTimeout(() => setInviteLabel('idle'), 1800)
    } catch {
      alert('Could not copy the invite. Please try again.')
    }
  }

  const createTable = async (params: {
    name: string
    maxPlayers: number
    minBet: number
    maxBet: number
    minBuyin: number
    maxBuyin: number
    buyIn: number
  }) => {
    if (!socket || !connected) {
      throw new Error('Game server is still waking up. Give it a few seconds and try again.')
    }

    const res = await emitWithAck<{ tableId: string }>(
      socket,
      'blackjack_create_table',
      params,
      'The blackjack server is still waking up. Wait a moment, then try again.'
    )
    router.push(`/blackjack/table/${res.tableId}`)
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
      await emitWithAck(
        socket,
        'blackjack_join_table',
        { tableId: joinModal.id, buyIn },
        'The blackjack table is not responding yet.'
      )
      router.push(`/blackjack/table/${joinModal.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join blackjack table')
    } finally {
      setLoading(false)
    }
  }

  const connectionLabel = connected
    ? 'Tables live'
    : socketError
      ? `Connection issue: ${socketError}`
      : 'Opening room...'

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#080403] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/blackjack/Images/Background/Blackjack%20Lobby.png')" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,4,3,0.22)_0%,rgba(8,4,3,0.48)_50%,rgba(8,4,3,0.9)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,4,3,0.52),transparent_28%,transparent_72%,rgba(8,4,3,0.56))]" />
      </div>

      <div className="relative z-10">
        <header className="casino-room-header sticky top-0 z-20 border-b border-[#f5c76d]/[0.16] bg-[#100806]/[0.64] backdrop-blur-xl">
          <div className="casino-room-header__inner mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:py-4">
            <div className="casino-room-header__brand flex flex-wrap items-center gap-3">
              <img
                src="/blackjack/Images/header%20logo%201.png"
                alt="ASL BlackJack Lounge"
                className="casino-room-header__blackjack-logo h-12 w-12 object-contain drop-shadow-[0_0_14px_rgba(245,199,109,0.2)]"
              />
              <div className="casino-room-header__copy">
                <div className="casino-room-header__title font-serif text-xl tracking-wide text-[#fff0c7] sm:text-2xl">ASL BlackJack Lounge</div>
                <p className="casino-room-header__subtitle text-[11px] uppercase tracking-[0.3em] text-[#f5c76d]/[0.58]">Same tab. New table.</p>
              </div>
              <div className="casino-room-header__status flex items-center gap-2 rounded-full border border-[#f5c76d]/[0.18] bg-black/[0.32] px-3 py-1.5 text-xs text-white/[0.72]">
                <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-300' : socketError ? 'bg-red-400' : 'animate-pulse bg-amber-300'}`} />
                <span>{connectionLabel}</span>
              </div>
            </div>

            <div className="casino-room-header__actions flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <Link
                href="/profile"
                className="casino-room-header__profile flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left transition-colors hover:border-[#f8d86a]/34 hover:bg-black/40"
                title="My Profile"
              >
                <AvatarDisplay avatarId={profile.avatar} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-white">{profile.username}</span>
                  <span className="block text-xs font-semibold text-[#f8d86a]">{profile.chip_balance.toLocaleString()} chips</span>
                </span>
              </Link>
              <Link
                href="/"
                className="casino-room-header__main rounded-xl border border-white/10 bg-black/24 px-4 py-3 text-sm font-semibold text-white/78 transition-colors hover:border-[#f8d86a]/34 hover:text-white"
              >
                <span className="casino-room-header__main-full">Main Lobby</span>
                <span className="casino-room-header__main-short hidden">Main</span>
              </Link>
              <button
                onClick={handleInvite}
                className="casino-room-header__invite rounded-xl border border-[#f8d86a]/20 bg-[#f1b45b] px-4 py-3 text-sm font-semibold text-[#20110a] transition-colors hover:bg-[#f4c272]"
                title="Copy blackjack invite and open Discord"
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

        <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 md:pt-10">
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_360px]">
            <div className="rounded-[20px] border border-[#f5c76d]/[0.18] bg-black/[0.34] p-5 shadow-[0_36px_100px_rgba(0,0,0,0.42)] backdrop-blur-sm md:p-8">
              <div className="max-w-3xl">
                <div className="inline-flex rounded-full border border-[#f5c76d]/[0.24] bg-[#f5c76d]/[0.12] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#ffe6a7]">
                  Blackjack tables
                </div>
                <h1 className="mt-5 max-w-3xl font-serif text-[2.4rem] leading-[0.95] text-[#fff7df] sm:text-5xl md:text-6xl">
                  Sit with the same profile, play against the house dealer.
                </h1>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Tables" value={activeTables.length.toString()} />
                <Stat label="Players" value={playersSeated.toString()} />
                <Stat label="Open seats" value={openSeats.toString()} />
                <Stat label="Hot limits" value={featuredLimits} />
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="primary"
                  size="lg"
                  className="rounded-full bg-[#f0b92f] px-7 text-[#160b04] hover:bg-[#ffd76b]"
                  onClick={() => setShowCreate(true)}
                >
                  Open Blackjack Table
                </Button>
              </div>
            </div>

            <aside className="blackjack-promo-panel rounded-[20px] bg-black/[0.38] backdrop-blur-sm">
              <div className="blackjack-promo-panel__surface h-full min-h-[430px]">
                <img
                  src="/blackjack/Images/Promo.png"
                  alt="ASL BlackJack Lounge promotion"
                  className="block h-full w-full object-cover"
                />
              </div>
            </aside>
          </section>

          <section className="mt-8 rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(16,8,7,0.82),rgba(16,8,7,0.56))] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-md md:rounded-[38px] md:p-6">
            <div className="mb-5 flex flex-col gap-3 border-b border-white/8 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.34em] text-[#f3d2a2]/42">Tables</div>
                <h2 className="mt-2 font-serif text-3xl text-[#fff3e2] md:text-4xl">Choose a dealer table</h2>
                <p className="mt-2 text-sm text-white/58">Watch the lounge, join a warm blackjack table, or open one for the next hand.</p>
              </div>
              <div className="rounded-full border border-white/10 bg-black/22 px-4 py-2 text-xs uppercase tracking-[0.28em] text-white/48">
                Live updates enabled
              </div>
            </div>

            {activeTables.length === 0 ? (
              <div className="rounded-[30px] border border-white/10 bg-black/28 px-6 py-16 text-center shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-md">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#f3d2a2]/25 bg-[#f1b45b]/10 text-3xl text-[#f7dfba]">
                  &#9824;
                </div>
                <p className="text-lg font-semibold text-white">The blackjack lounge is open, but no table is drawing a crowd yet.</p>
                <p className="mt-2 text-sm text-white/60">Open the first table, send an invite, and give players somewhere to gather.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-3">
                {activeTables.map((table) => (
                  <BlackjackTableCard
                    key={table.id}
                    table={table}
                    onJoin={() => {
                      setJoinModal(table)
                      setBuyIn(table.min_buyin)
                      setError('')
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          <LobbyChat socket={socket} profile={profile} hasVipEmojis={hasVipEmojis} />
        </main>

        <CreateBlackjackModal
          open={showCreate}
          chipBalance={profile.chip_balance}
          onClose={() => setShowCreate(false)}
          onCreate={createTable}
        />

        <Modal open={!!joinModal} onClose={() => setJoinModal(null)} title={`Join ${joinModal?.name ?? 'Blackjack Table'}`}>
          {joinModal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-[#f5c76d]/[0.16] bg-[#f5c76d]/[0.08] p-3">
                  <div className="text-[#f5c76d]/[0.58]">Limits</div>
                  <div className="font-bold text-[#ffe6a7]">{tableLimitLabel(joinModal)}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-white/50">Buy-in</div>
                  <div className="font-bold text-white">{joinModal.min_buyin.toLocaleString()}-{joinModal.max_buyin.toLocaleString()}</div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-400">Your Buy-in</label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white outline-none focus:border-[#f0b92f]"
                  value={buyIn}
                  min={joinModal.min_buyin}
                  max={Math.min(joinModal.max_buyin, profile.chip_balance)}
                  onChange={(event) => setBuyIn(Number(event.target.value))}
                />
                <p className="mt-1 text-xs text-gray-500">Balance: {profile.chip_balance.toLocaleString()} chips</p>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => setJoinModal(null)}>Cancel</Button>
                <Button variant="primary" className="flex-1 bg-[#f0b92f] text-[#160b04] hover:bg-[#ffd76b]" loading={loading} onClick={confirmJoin}>
                  Take Seat
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#f5c76d]/[0.16] bg-black/[0.26] p-4">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[#f5c76d]/[0.58]">{label}</div>
      <div className="mt-2 text-2xl font-bold text-[#fff7df]">{value}</div>
    </div>
  )
}

function BlackjackTableCard({ table, onJoin }: { table: BlackjackTableInfo; onJoin: () => void }) {
  const canJoin = table.status !== 'finished' && table.player_count < table.max_players
  const seatsLeft = Math.max(table.max_players - table.player_count, 0)

  return (
    <article className="relative overflow-hidden rounded-2xl border border-[#f5c76d]/[0.18] bg-[linear-gradient(145deg,rgba(42,24,10,0.78),rgba(8,4,3,0.9))] p-5 shadow-[0_22px_56px_rgba(0,0,0,0.38)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f5c76d]/[0.6] to-transparent" />
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-[#fff7df]">{table.name}</h3>
          <p className="mt-1 text-sm text-[#f5c76d]/[0.62]">{table.status === 'playing' ? 'Round in progress' : 'Bets open'}</p>
        </div>
        <div className="rounded-full border border-[#f5c76d]/[0.18] bg-black/[0.24] px-3 py-1 text-sm font-semibold text-[#ffe6a7]">
          {table.player_count}/{table.max_players}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg border border-[#f5c76d]/[0.14] bg-black/[0.2] px-3 py-2">
          <div className="text-xs uppercase tracking-[0.14em] text-[#f5c76d]/[0.58]">Limits</div>
          <div className="font-semibold text-[#ffe6a7]">{tableLimitLabel(table)}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/[0.2] px-3 py-2">
          <div className="text-xs uppercase tracking-[0.14em] text-white/[0.48]">Buy-in</div>
          <div className="font-semibold text-white">{table.min_buyin.toLocaleString()}-{table.max_buyin.toLocaleString()}</div>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-white/[0.1] bg-black/20 px-3 py-2 text-xs uppercase tracking-[0.18em] text-white/[0.52]">
        {seatsLeft} seats open
      </div>

      <Button
        variant={canJoin ? 'primary' : 'secondary'}
        size="sm"
        className="w-full bg-[#f0b92f] text-[#160b04] hover:bg-[#ffd76b]"
        disabled={!canJoin}
        onClick={onJoin}
      >
        {canJoin ? 'Join Table' : 'Table Full'}
      </Button>
    </article>
  )
}

function CreateBlackjackModal({
  open,
  chipBalance,
  onClose,
  onCreate,
}: {
  open: boolean
  chipBalance: number
  onClose: () => void
  onCreate: (params: {
    name: string
    maxPlayers: number
    minBet: number
    maxBet: number
    minBuyin: number
    maxBuyin: number
    buyIn: number
  }) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(7)
  const [minBet, setMinBet] = useState(10)
  const [maxBet, setMaxBet] = useState(5000)
  const [buyIn, setBuyIn] = useState(1000)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const minBuyin = useMemo(() => minBet * 100, [minBet])
  const maxBuyin = useMemo(() => Math.max(minBuyin, maxBet * 4), [maxBet, minBuyin])
  const actualBuyIn = Math.max(minBuyin, Math.min(maxBuyin, buyIn))
  const canAfford = chipBalance >= actualBuyIn

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canAfford) return

    setLoading(true)
    setError('')

    try {
      await onCreate({
        name: name || 'Blackjack Table',
        maxPlayers,
        minBet,
        maxBet,
        minBuyin,
        maxBuyin,
        buyIn: actualBuyIn,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create blackjack table')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Open Blackjack Table">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-gray-400">Table Name</label>
          <input
            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white outline-none focus:border-emerald-400"
            placeholder="Blackjack Table"
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm text-gray-400">Seats</label>
            <select
              className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white outline-none"
              value={maxPlayers}
              onChange={(event) => setMaxPlayers(Number(event.target.value))}
            >
              {[2, 3, 4, 5, 6, 7].map((count) => (
                <option key={count} value={count}>{count} seats</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400">Min Bet</label>
            <select
              className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white outline-none"
              value={minBet}
              onChange={(event) => {
                const next = Number(event.target.value)
                setMinBet(next)
                setBuyIn(Math.max(next * 100, buyIn))
              }}
            >
              {[10, 25, 50, 100, 250, 500].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-400">Max Bet</label>
          <select
            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white outline-none"
            value={maxBet}
            onChange={(event) => setMaxBet(Number(event.target.value))}
          >
            {[1000, 2500, 5000, 10000, 20000, 50000].map((value) => (
              <option key={value} value={value}>{value.toLocaleString()}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-400">
            Your Buy-in ({minBuyin.toLocaleString()}-{maxBuyin.toLocaleString()})
          </label>
          <input
            type="number"
            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white outline-none focus:border-emerald-400"
            value={buyIn}
            min={minBuyin}
            max={maxBuyin}
            onChange={(event) => setBuyIn(Number(event.target.value))}
          />
          {!canAfford && (
            <p className="mt-1 text-xs text-red-400">Insufficient chips. Balance: {chipBalance.toLocaleString()}</p>
          )}
        </div>

        <div className="rounded-lg border border-[#f5c76d]/[0.16] bg-[#f5c76d]/[0.08] p-3 text-sm text-[#fff0c7]/[0.74]">
          Bets are drawn from the table stack after buy-in. Cash out returns remaining table chips to your account.
        </div>

        {error && <p className="text-center text-sm text-red-400">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" className="flex-1 bg-[#f0b92f] text-[#160b04] hover:bg-[#ffd76b]" loading={loading} disabled={!canAfford}>
            Open Table
          </Button>
        </div>
      </form>
    </Modal>
  )
}
