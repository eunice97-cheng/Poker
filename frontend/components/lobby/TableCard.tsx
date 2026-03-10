'use client'

import { TableInfo } from '@/types/poker'
import { Button } from '@/components/ui/Button'
import { getTableTheme } from '@/lib/table-theme'

interface TableCardProps {
  table: TableInfo
  onJoin: (table: TableInfo) => void
}

const statusColors = {
  waiting: 'text-green-400',
  playing: 'text-yellow-400',
  finished: 'text-gray-500',
}

export function TableCard({ table, onJoin }: TableCardProps) {
  const canJoin = table.status !== 'finished' && table.player_count < table.max_players
  const theme = getTableTheme(table.big_blind)

  return (
    <div className={`${theme.lobbyCardClass} rounded-xl border p-5 transition-all shadow-[0_18px_40px_rgba(0,0,0,0.28)]`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h3 className="text-white font-bold text-lg">{table.name}</h3>
            <span className={`${theme.lobbyPillClass} rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]`}>
              {theme.tier}
            </span>
          </div>
          <span className={`text-sm font-medium ${statusColors[table.status]}`}>
            {table.status === 'waiting' ? 'Waiting for players' : table.status === 'playing' ? 'In progress' : 'Finished'}
          </span>
        </div>
        <div className="text-right">
          <div className="text-yellow-400 font-bold">
            {table.player_count}/{table.max_players}
          </div>
          <div className="text-gray-500 text-xs">players</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
        <div className={`${theme.lobbyPanelClass} rounded-lg px-3 py-2`}>
          <div className="text-gray-500 text-xs">Blinds</div>
          <div className={`font-medium ${theme.lobbyAccentClass}`}>{table.small_blind}/{table.big_blind}</div>
        </div>
        <div className={`${theme.lobbyPanelClass} rounded-lg px-3 py-2`}>
          <div className="text-gray-500 text-xs">Buy-in</div>
          <div className="text-white font-medium">{table.min_buyin.toLocaleString()}–{table.max_buyin.toLocaleString()}</div>
        </div>
      </div>

      <Button
        variant={canJoin ? 'primary' : 'secondary'}
        size="sm"
        className="w-full"
        disabled={!canJoin}
        onClick={() => onJoin(table)}
      >
        {table.status === 'finished' ? 'Finished' : !canJoin ? 'Full' : 'Join Table'}
      </Button>
    </div>
  )
}
