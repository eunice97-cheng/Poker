'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TableInfo } from '@/types/poker'
import { TableCard } from './TableCard'

interface TableListProps {
  onJoin: (table: TableInfo) => void
  initialTables: TableInfo[]
  onTablesChange?: (tables: TableInfo[]) => void
}

export function TableList({ onJoin, initialTables, onTablesChange }: TableListProps) {
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
            if (newTable.name?.toLowerCase().includes('dev table')) return
            setTables((prev) => [newTable, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setTables((prev) =>
              prev.map((t) => (t.id === (payload.new as TableInfo).id ? (payload.new as TableInfo) : t))
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

  if (tables.length === 0) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-black/35 px-6 py-16 text-center shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-md">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/25 bg-amber-200/10 text-3xl text-amber-100">
          &#9824;
        </div>
        <p className="text-lg font-semibold text-white">No tables are open yet.</p>
        <p className="mt-2 text-sm text-white/60">Start the first game and the lobby will populate in real time.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-3">
      {tables.map((table) => (
        <TableCard key={table.id} table={table} onJoin={onJoin} />
      ))}
    </div>
  )
}
