'use client'

import { TableInfo } from '@/types/poker'
import { Button } from '@/components/ui/Button'

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

  return (
    <div className="bg-gray-800/60 border border-gray-700 hover:border-gray-500 rounded-xl p-5 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-white font-bold text-lg">{table.name}</h3>
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
        <div className="bg-gray-900/50 rounded-lg px-3 py-2">
          <div className="text-gray-500 text-xs">Blinds</div>
          <div className="text-white font-medium">{table.small_blind}/{table.big_blind}</div>
        </div>
        <div className="bg-gray-900/50 rounded-lg px-3 py-2">
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
