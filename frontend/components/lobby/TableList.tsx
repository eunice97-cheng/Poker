'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TableInfo } from '@/types/poker'
import { TableCard } from './TableCard'

interface TableListProps {
  onJoin: (table: TableInfo) => void
  initialTables: TableInfo[]
}

export function TableList({ onJoin, initialTables }: TableListProps) {
  const [tables, setTables] = useState<TableInfo[]>(initialTables)
  const supabase = createClient()

  useEffect(() => {
    // Subscribe to real-time table updates via Supabase Realtime
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

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  if (tables.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <div className="text-5xl mb-4">♠</div>
        <p className="text-lg">No tables yet. Create one to get started!</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tables.map((table) => (
        <TableCard key={table.id} table={table} onJoin={onJoin} />
      ))}
    </div>
  )
}
