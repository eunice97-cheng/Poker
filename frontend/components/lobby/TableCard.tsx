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
  const seatsLeft = Math.max(table.max_players - table.player_count, 0)

  return (
    <div className={`${theme.lobbyCardClass} group relative overflow-hidden rounded-[24px] border p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(0,0,0,0.45)]`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent opacity-70" />
      <div className="absolute -right-12 -top-12 h-28 w-28 rounded-full bg-white/10 blur-3xl transition-opacity duration-300 group-hover:opacity-80" />

      <div className="relative mb-4 flex items-start justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h3 className="text-lg font-bold text-white">{table.name}</h3>
            <span className={`${theme.lobbyPillClass} rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]`}>
              {theme.tier}
            </span>
          </div>
          <span className={`text-sm font-medium ${statusColors[table.status]}`}>
            {table.status === 'waiting' ? 'Waiting for players' : table.status === 'playing' ? 'In progress' : 'Finished'}
          </span>
        </div>
        <div className="text-right">
          <div className="font-bold text-yellow-300">
            {table.player_count}/{table.max_players}
          </div>
          <div className="text-xs uppercase tracking-[0.18em] text-white/45">seated</div>
        </div>
      </div>

      <div className="relative mb-4 grid grid-cols-2 gap-2 text-sm">
        <div className={`${theme.lobbyPanelClass} rounded-lg px-3 py-2`}>
          <div className="text-xs uppercase tracking-[0.14em] text-white/45">Blinds</div>
          <div className={`font-medium ${theme.lobbyAccentClass}`}>{table.small_blind}/{table.big_blind}</div>
        </div>
        <div className={`${theme.lobbyPanelClass} rounded-lg px-3 py-2`}>
          <div className="text-xs uppercase tracking-[0.14em] text-white/45">Buy-in</div>
          <div className="font-medium text-white">{table.min_buyin.toLocaleString()}-{table.max_buyin.toLocaleString()}</div>
        </div>
      </div>

      <div className="relative mb-4 flex items-center justify-between rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-xs uppercase tracking-[0.18em] text-white/55">
        <span>{seatsLeft} seats open</span>
        <span>{canJoin ? 'Joinable now' : 'Unavailable'}</span>
      </div>

      <Button
        variant={canJoin ? 'primary' : 'secondary'}
        size="sm"
        className="relative z-10 w-full"
        disabled={!canJoin}
        onClick={() => onJoin(table)}
      >
        {table.status === 'finished' ? 'Finished' : !canJoin ? 'Full' : 'Join Table'}
      </Button>
    </div>
  )
}
