'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TableInfo } from '@/types/poker'
import { TableCard } from './TableCard'

interface TableListProps {
  onJoin: (table: TableInfo) => void
  initialTables: TableInfo[]
  onTablesChange?: (tables: TableInfo[]) => void
  connected?: boolean
  socketUrl?: string
}

type LiveTableSnapshot = {
  id: string
  name?: string
  game_type?: TableInfo['game_type']
  host_id?: string | null
  player_count?: number
  playerCount?: number
  max_players?: number
  maxPlayers?: number
  small_blind?: number
  smallBlind?: number
  big_blind?: number
  bigBlind?: number
  min_buyin?: number
  minBuyin?: number
  max_buyin?: number
  maxBuyin?: number
  status: TableInfo['status']
  created_at?: string
}

export function TableList({
  onJoin,
  initialTables,
  onTablesChange,
  connected = false,
  socketUrl = '',
}: TableListProps) {
  const [tables, setTables] = useState<TableInfo[]>(initialTables)
  const supabase = createClient()

  useEffect(() => {
    onTablesChange?.(tables)
  }, [onTablesChange, tables])

  useEffect(() => {
    const channel = supabase
      .channel('tables_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTable = payload.new as TableInfo
            if (newTable.game_type && newTable.game_type !== 'poker') return
            if (newTable.name?.toLowerCase().includes('dev table')) return
            setTables((prev) => [newTable, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            const updatedTable = payload.new as TableInfo
            if (updatedTable.game_type && updatedTable.game_type !== 'poker') {
              setTables((prev) => prev.filter((t) => t.id !== updatedTable.id))
              return
            }
            setTables((prev) =>
              prev.map((t) => (t.id === updatedTable.id ? updatedTable : t))
            )
          } else if (payload.eventType === 'DELETE') {
            setTables((prev) => prev.filter((t) => t.id !== (payload.old as { id: string }).id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  useEffect(() => {
    if (!connected || !socketUrl) return

    const controller = new AbortController()

    const syncWithLiveRooms = async () => {
      try {
        const res = await fetch(`${socketUrl}/tables`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) return

        const liveTables = (await res.json()) as LiveTableSnapshot[]

        setTables((prev) =>
          liveTables.map((liveTable) => {
            const existing = prev.find((table) => table.id === liveTable.id)
            return {
              ...existing,
              id: liveTable.id,
              name: liveTable.name ?? existing?.name ?? 'Poker Table',
              game_type: liveTable.game_type ?? existing?.game_type ?? 'poker',
              host_id: liveTable.host_id ?? existing?.host_id ?? null,
              player_count: liveTable.player_count ?? liveTable.playerCount ?? existing?.player_count ?? 0,
              max_players: liveTable.max_players ?? liveTable.maxPlayers ?? existing?.max_players ?? 6,
              small_blind: liveTable.small_blind ?? liveTable.smallBlind ?? existing?.small_blind ?? 25,
              big_blind: liveTable.big_blind ?? liveTable.bigBlind ?? existing?.big_blind ?? 50,
              min_buyin: liveTable.min_buyin ?? liveTable.minBuyin ?? existing?.min_buyin ?? 1000,
              max_buyin: liveTable.max_buyin ?? liveTable.maxBuyin ?? existing?.max_buyin ?? 5000,
              status: liveTable.status,
              created_at: liveTable.created_at ?? existing?.created_at ?? new Date().toISOString(),
            }
          })
        )
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn('Failed to sync live tables:', error)
        }
      }
    }

    void syncWithLiveRooms()
    const interval = window.setInterval(() => {
      void syncWithLiveRooms()
    }, 5000)

    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [connected, socketUrl])

  if (tables.length === 0) {
    return (
      <div className="casino-table-list__empty rounded-[30px] border border-white/10 bg-black/28 px-6 py-16 text-center shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-md">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#f3d2a2]/25 bg-[#f1b45b]/10 text-3xl text-[#f7dfba]">
          &#9824;
        </div>
        <p className="text-lg font-semibold text-white">The lounge is open, but no table is drawing a crowd yet.</p>
        <p className="mt-2 text-sm text-white/60">Start the first game, send an invite, and give people somewhere to gather.</p>
      </div>
    )
  }

  return (
    <div className="casino-table-list grid gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-3">
      {tables.map((table) => (
        <TableCard key={table.id} table={table} onJoin={onJoin} />
      ))}
    </div>
  )
}
