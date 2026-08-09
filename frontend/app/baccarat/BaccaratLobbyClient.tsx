'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Socket } from 'socket.io-client'
import { AvatarDisplay } from '@/components/ui/AvatarDisplay'
import { AudioControls } from '@/components/ui/AudioControls'
import { Button } from '@/components/ui/Button'
import { ExitIcon } from '@/components/ui/ExitIcon'
import { MailIcon } from '@/components/ui/MailIcon'
import { Modal } from '@/components/ui/Modal'
import { LobbyChat } from '@/components/lobby/LobbyChat'
import { createClient } from '@/lib/supabase/client'
import { useAudio } from '@/hooks/useAudio'
import { useSocket } from '@/hooks/useSocket'
import type { BaccaratTableInfo } from '@/types/baccarat'
import type { Profile } from '@/types/poker'

const BACCARAT_MIN_BET = 100
const BACCARAT_MAX_BET = 10000
const BACCARAT_MIN_BUYIN = 100
const BACCARAT_DEFAULT_BUYIN = 1000

interface BaccaratLobbyClientProps {
  initialTables: BaccaratTableInfo[]
  profile: Profile
  token: string
  hasVipEmojis: boolean
  unreadMailCount: number
  isAdmin: boolean
  isLocalAdmin?: boolean
}

type LiveBaccaratTable = {
  id: string
  name: string
  hostId: string | null
  tableKind?: 'house' | 'custom'
  houseSeat?: number
  maxPlayers: number
  minBet: number
  maxBet: number
  minBuyin: number
  maxBuyin: number
  status: BaccaratTableInfo['status']
  playerCount: number
  gameType: 'baccarat'
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

function normalizeTable(table: BaccaratTableInfo | LiveBaccaratTable): BaccaratTableInfo {
  if ('playerCount' in table) {
    return {
      id: table.id,
      name: table.name,
      host_id: table.hostId,
      game_type: 'baccarat',
      table_kind: table.tableKind ?? 'custom',
      house_seat: table.houseSeat,
      max_players: table.maxPlayers,
      small_blind: table.minBet,
      big_blind: table.maxBet,
      min_buyin: table.minBuyin,
      max_buyin: table.maxBuyin,
      status: table.status,
      player_count: table.playerCount,
    }
  }

  return {
    ...table,
    table_kind: table.table_kind ?? 'custom',
  }
}

function formatChips(value: number) {
  return value.toLocaleString()
}

function tableLimitLabel(table: BaccaratTableInfo) {
  return `${formatChips(table.small_blind)}-${formatChips(table.big_blind)}`
}

function sortTables(tables: BaccaratTableInfo[]) {
  return [...tables].sort((a, b) => {
    const kindScore = (b.table_kind === 'house' ? 1 : 0) - (a.table_kind === 'house' ? 1 : 0)
    return kindScore || (a.house_seat ?? 999) - (b.house_seat ?? 999) || b.player_count - a.player_count
  })
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#d7b35f]/16 bg-black/30 p-4 backdrop-blur-sm">
      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#d7b35f]/58">{label}</div>
      <div className="mt-2 text-2xl font-black text-[#fff8df]">{value}</div>
    </div>
  )
}

export function BaccaratLobbyClient({
  initialTables,
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
  const { socket, connected, error: socketError, socketUrl } = useSocket(token)
  const [tables, setTables] = useState(() => initialTables.map(normalizeTable))
  const [showCreate, setShowCreate] = useState(false)
  const [joinModal, setJoinModal] = useState<BaccaratTableInfo | null>(null)
  const [buyIn, setBuyIn] = useState(BACCARAT_DEFAULT_BUYIN)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const unreadMailLabel = unreadMailCount > 99 ? '99+' : unreadMailCount.toString()
  const connectionLabel = connected ? 'Tables live' : socketError ? `Connection issue: ${socketError}` : 'Opening lounge'
  const activeTables = useMemo(() => sortTables(tables.filter((table) => table.status !== 'finished')), [tables])
  const playersSeated = activeTables.reduce((sum, table) => sum + table.player_count, 0)
  const openSeats = activeTables.reduce((sum, table) => sum + Math.max(table.max_players - table.player_count, 0), 0)
  const featuredTable = activeTables[0]
  const featuredLimits = featuredTable ? tableLimitLabel(featuredTable) : '100-10,000'

  useEffect(() => {
    if (!socket) return

    const upsertTable = (incoming: BaccaratTableInfo | LiveBaccaratTable) => {
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

    socket.on('baccarat_table_created', upsertTable)
    socket.on('baccarat_table_updated', upsertTable)
    socket.on('baccarat_table_deleted', deleteTable)

    return () => {
      socket.off('baccarat_table_created', upsertTable)
      socket.off('baccarat_table_updated', upsertTable)
      socket.off('baccarat_table_deleted', deleteTable)
    }
  }, [socket])

  useEffect(() => {
    if (!connected || !socketUrl) return

    const controller = new AbortController()

    const syncLiveRooms = async () => {
      try {
        const res = await fetch(`${socketUrl}/baccarat/tables`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) return
        const liveTables = (await res.json()) as BaccaratTableInfo[]
        setTables(liveTables.map(normalizeTable))
      } catch (err) {
        if (!controller.signal.aborted) console.warn('Failed to sync Baccarat tables:', err)
      }
    }

    void syncLiveRooms()

    return () => controller.abort()
  }, [connected, socketUrl])

  const handleSignOut = async () => {
    playSfx('click')
    if (isLocalAdmin) {
      await fetch('/api/dev/local-admin-logout', { method: 'POST' })
    } else {
      await supabase.auth.signOut()
    }
    router.push('/auth/login')
  }

  const createTable = async (params: {
    name: string
    maxPlayers: number
    maxBet: number
    maxBuyin: number
    buyIn: number
  }) => {
    if (!socket || !connected) {
      throw new Error('Game server is still waking up. Give it a few seconds and try again.')
    }

    const res = await emitWithAck<{ tableId: string }>(
      socket,
      'baccarat_create_table',
      {
        name: params.name,
        maxPlayers: params.maxPlayers,
        maxBet: params.maxBet,
        minBuyin: BACCARAT_MIN_BUYIN,
        maxBuyin: params.maxBuyin,
        buyIn: params.buyIn,
      },
      'The Baccarat server is still waking up. Wait a moment, then try again.'
    )
    router.push(`/baccarat/table/${res.tableId}`)
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
      const res = await emitWithAck<{ tableId?: string }>(
        socket,
        'baccarat_join_table',
        { tableId: joinModal.id, buyIn },
        'The Baccarat table is not responding yet.'
      )
      router.push(`/baccarat/table/${res.tableId ?? joinModal.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join Baccarat table')
    } finally {
      setLoading(false)
    }
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
              Fast house tables plus custom rooms for clean Baccarat stakes.
            </h2>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <Stat label="Tables" value={activeTables.length.toString()} />
              <Stat label="Seats open" value={openSeats.toString()} />
              <Stat label="Players" value={playersSeated.toString()} />
              <Stat label="Hot limits" value={featuredLimits} />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                variant="primary"
                size="lg"
                className="rounded-full bg-[linear-gradient(135deg,#f1cf72,#b9822e)] px-7 text-[#160b04] hover:brightness-110"
                onClick={() => setShowCreate(true)}
              >
                Open Custom Table
              </Button>
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

            {activeTables.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-black/36 px-6 py-14 text-center">
                <p className="text-lg font-bold text-white">The Baccarat lounge is opening its first table.</p>
                <p className="mt-2 text-sm text-white/58">Wait for the house table to appear or open a custom room.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {activeTables.map((table) => (
                  <BaccaratTableCard
                    key={table.id}
                    table={table}
                    balance={profile.chip_balance}
                    onJoin={() => {
                      setJoinModal(table)
                      setBuyIn(Math.min(Math.max(table.min_buyin, BACCARAT_DEFAULT_BUYIN), table.max_buyin, profile.chip_balance))
                      setError('')
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </section>

        <LobbyChat socket={socket} profile={profile} hasVipEmojis={hasVipEmojis} />

        <CreateBaccaratModal
          open={showCreate}
          chipBalance={profile.chip_balance}
          onClose={() => setShowCreate(false)}
          onCreate={createTable}
        />

        <Modal open={!!joinModal} onClose={() => setJoinModal(null)} title={`Join ${joinModal?.name ?? 'Baccarat Table'}`}>
          {joinModal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-[#d7b35f]/16 bg-[#d7b35f]/08 p-3">
                  <div className="text-[#d7b35f]/58">Limits</div>
                  <div className="font-bold text-[#ffe6a7]">{tableLimitLabel(joinModal)}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-white/50">Buy-in</div>
                  <div className="font-bold text-white">{formatChips(joinModal.min_buyin)}-{formatChips(joinModal.max_buyin)}</div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-400">Your Buy-in</label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white outline-none focus:border-[#d7b35f]"
                  value={buyIn}
                  min={joinModal.min_buyin}
                  max={Math.min(joinModal.max_buyin, profile.chip_balance)}
                  onChange={(event) => setBuyIn(Number(event.target.value))}
                />
                <p className="mt-1 text-xs text-gray-500">Balance: {formatChips(profile.chip_balance)} chips</p>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => setJoinModal(null)}>Cancel</Button>
                <Button
                  variant="primary"
                  className="flex-1 bg-[#d7b35f] text-[#160b04] hover:bg-[#f1cf72]"
                  loading={loading}
                  disabled={profile.chip_balance < joinModal.min_buyin}
                  onClick={confirmJoin}
                >
                  Take Seat
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </main>
  )
}

function BaccaratTableCard({ table, balance, onJoin }: { table: BaccaratTableInfo; balance: number; onJoin: () => void }) {
  const isHouseTable = table.table_kind === 'house'
  const seatsLeft = Math.max(table.max_players - table.player_count, 0)
  const canJoin = table.status !== 'finished' && balance >= table.min_buyin && (seatsLeft > 0 || isHouseTable)

  return (
    <article className="relative overflow-hidden rounded-lg border border-[#d7b35f]/22 bg-black/48 shadow-[0_26px_68px_rgba(0,0,0,0.44)]">
      <img src="/baccarat/Images/baccarat-table.png" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-35" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,8,5,0.94)_0%,rgba(3,8,5,0.82)_46%,rgba(3,8,5,0.44)_100%)]" />
      <div className="relative z-10 grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:p-6">
        <div>
          <div className="mb-3 inline-flex rounded-full border border-emerald-200/18 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-100">
            {isHouseTable ? 'ASL House Table' : 'Custom Table'}
          </div>
          <h3 className="font-serif text-3xl text-[#fff7df]">{table.name}</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/66">
            {isHouseTable ? 'Always open. If this table fills, the lounge opens the next house table automatically.' : 'Player-created Baccarat room with shared ASL account chips.'}
          </p>
          <div className="mt-5 grid max-w-xl grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div className="rounded-lg border border-[#d7b35f]/16 bg-black/34 px-3 py-2">
              <span className="block text-[10px] uppercase tracking-[0.16em] text-[#d7b35f]/58">Min</span>
              <strong className="text-[#ffe6a7]">{formatChips(table.small_blind)}</strong>
            </div>
            <div className="rounded-lg border border-[#d7b35f]/16 bg-black/34 px-3 py-2">
              <span className="block text-[10px] uppercase tracking-[0.16em] text-[#d7b35f]/58">Max</span>
              <strong className="text-[#ffe6a7]">{formatChips(table.big_blind)}</strong>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/34 px-3 py-2">
              <span className="block text-[10px] uppercase tracking-[0.16em] text-white/46">Seats</span>
              <strong>{table.player_count}/{table.max_players}</strong>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/34 px-3 py-2">
              <span className="block text-[10px] uppercase tracking-[0.16em] text-white/46">Shoe</span>
              <strong>8 Deck</strong>
            </div>
          </div>
        </div>

        <div className="flex min-w-[190px] flex-col justify-end gap-3">
          <button
            type="button"
            disabled={!canJoin}
            onClick={onJoin}
            className="rounded-lg bg-[linear-gradient(135deg,#f1cf72,#b9822e)] px-5 py-4 text-center text-sm font-black uppercase tracking-[0.16em] text-[#160b04] shadow-[0_18px_42px_rgba(0,0,0,0.36)] transition-transform hover:-translate-y-0.5 disabled:border disabled:border-white/10 disabled:bg-none disabled:bg-white/[0.04] disabled:text-white/38 disabled:shadow-none disabled:hover:translate-y-0"
          >
            {canJoin ? seatsLeft > 0 ? 'Enter Table' : 'Open Next House' : balance < table.min_buyin ? `Need ${formatChips(table.min_buyin)} Chips` : 'Table Full'}
          </button>
          <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-center text-xs text-white/56">
            {seatsLeft > 0 ? `${seatsLeft} seats open` : isHouseTable ? 'Overflow ready' : 'No seats open'}
          </div>
        </div>
      </div>
    </article>
  )
}

function CreateBaccaratModal({
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
    maxBet: number
    maxBuyin: number
    buyIn: number
  }) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(6)
  const [maxBet, setMaxBet] = useState(BACCARAT_MAX_BET)
  const [buyIn, setBuyIn] = useState(BACCARAT_DEFAULT_BUYIN)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const maxBuyin = Math.max(10000, maxBet * 10)
  const actualBuyIn = Math.max(BACCARAT_MIN_BUYIN, Math.min(maxBuyin, buyIn))
  const canAfford = chipBalance >= actualBuyIn

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canAfford) return

    setLoading(true)
    setError('')

    try {
      await onCreate({
        name: name.trim() || 'Baccarat Table',
        maxPlayers,
        maxBet,
        maxBuyin,
        buyIn: actualBuyIn,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create Baccarat table')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Start Baccarat Table" maxWidth="max-w-3xl">
      <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
        <section className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-400" htmlFor="baccarat-table-name">Table name</label>
            <input
              id="baccarat-table-name"
              className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white outline-none focus:border-[#d7b35f]"
              placeholder="Baccarat Table"
              value={name}
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm text-gray-400">Seats</legend>
            <div className="grid grid-cols-5 gap-2">
              {[2, 3, 4, 5, 6].map((count) => (
                <button
                  key={count}
                  type="button"
                  className={`rounded-lg border px-3 py-2 font-bold ${maxPlayers === count ? 'border-[#d7b35f] bg-[#d7b35f]/20 text-[#ffe6a7]' : 'border-white/10 bg-white/5 text-white/70'}`}
                  onClick={() => setMaxPlayers(count)}
                >
                  {count}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm text-gray-400">Max bet</legend>
            <div className="grid grid-cols-3 gap-2">
              {[1000, 5000, 10000].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`rounded-lg border px-3 py-2 font-bold ${maxBet === value ? 'border-[#d7b35f] bg-[#d7b35f]/20 text-[#ffe6a7]' : 'border-white/10 bg-white/5 text-white/70'}`}
                  onClick={() => {
                    setMaxBet(value)
                    setBuyIn((current) => Math.min(Math.max(current, BACCARAT_MIN_BUYIN), Math.max(10000, value * 10)))
                  }}
                >
                  {value >= 1000 ? `${value / 1000}k` : value}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="mb-1 block text-sm text-gray-400" htmlFor="baccarat-buy-in">Buy-in</label>
            <input
              id="baccarat-buy-in"
              type="number"
              className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white outline-none focus:border-[#d7b35f]"
              value={buyIn}
              min={BACCARAT_MIN_BUYIN}
              max={maxBuyin}
              onChange={(event) => setBuyIn(Number(event.target.value))}
            />
            <p className="mt-1 text-xs text-gray-500">Range: {formatChips(BACCARAT_MIN_BUYIN)}-{formatChips(maxBuyin)}</p>
          </div>
        </section>

        <aside className="rounded-lg border border-[#d7b35f]/16 bg-black/30 p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#d7b35f]/58">Punto Banco</div>
          <h3 className="mt-2 text-xl font-black text-white">{name.trim() || 'Baccarat Table'}</h3>
          <div className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between border-b border-white/10 pb-2"><span>Min bet</span><strong>{formatChips(BACCARAT_MIN_BET)}</strong></div>
            <div className="flex justify-between border-b border-white/10 pb-2"><span>Max bet</span><strong>{formatChips(maxBet)}</strong></div>
            <div className="flex justify-between border-b border-white/10 pb-2"><span>Seats</span><strong>{maxPlayers}</strong></div>
            <div className="flex justify-between"><span>Buy-in</span><strong>{formatChips(actualBuyIn)}</strong></div>
          </div>
          <p className={`mt-4 text-sm ${canAfford ? 'text-white/60' : 'text-red-300'}`}>
            {canAfford ? `Balance: ${formatChips(chipBalance)} chips` : `Insufficient chips. Balance: ${formatChips(chipBalance)}`}
          </p>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <div className="mt-5 flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" className="flex-1 bg-[#d7b35f] text-[#160b04] hover:bg-[#f1cf72]" loading={loading} disabled={!canAfford}>
              Open
            </Button>
          </div>
        </aside>
      </form>
    </Modal>
  )
}
