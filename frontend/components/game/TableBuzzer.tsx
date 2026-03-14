'use client'

import { Modal } from '@/components/ui/Modal'
import { AvatarDisplay } from '@/components/ui/AvatarDisplay'
import type { BuzzerHousePlayer, BuzzerRoom } from '@/lib/buzzer'

interface TableBuzzerProps {
  open: boolean
  onClose: () => void
  room: BuzzerRoom | null
  housePlayers: BuzzerHousePlayer[]
  loading: boolean
  error: string
  message: string
  actionPlayerId: string
  onRefresh: () => void
  onSummon: (housePlayerId: string) => void
  onDismiss: (housePlayerId: string) => void
}

function formatAvailability(player: BuzzerHousePlayer, room: BuzzerRoom | null) {
  if (player.assignedTableId) {
    if (player.assignedTableId === room?.tableId) {
      return 'At this table'
    }
    return 'Busy at another table'
  }

  if (!player.isReady) {
    return `Resting until ${new Date(player.availableAt).toLocaleTimeString()}`
  }

  return 'Ready for your buzzer'
}

export function TableBuzzer({
  open,
  onClose,
  room,
  housePlayers,
  loading,
  error,
  message,
  actionPlayerId,
  onRefresh,
  onSummon,
  onDismiss,
}: TableBuzzerProps) {
  const currentHousePlayers = room?.currentHousePlayers ?? []
  const availableHousePlayers = housePlayers.filter(
    (player) => !player.assignedTableId && player.isReady && player.bankroll >= (room?.minBuyin ?? 0)
  )
  const canSummonNow = Boolean(room?.canSummon)

  return (
    <Modal open={open} onClose={onClose} title="GM Buzzer" maxWidth="max-w-3xl">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-yellow-100">Manual house call</div>
            <p className="mt-1 text-sm text-yellow-50/85">
              Pick which AI girl answers this table. Buzzed-in girls stay until you dismiss them or they fall to 50%.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg border border-yellow-200/30 px-3 py-2 text-sm font-semibold text-yellow-100 transition-colors hover:border-yellow-100/60 hover:text-white"
          >
            Refresh
          </button>
        </div>

        {room && (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300">
            <div className="font-semibold text-white">{room.tableName}</div>
            <div className="mt-1 text-xs text-gray-400">
              {room.smallBlind}/{room.bigBlind} · {room.realPlayerCount} human · {room.botPlayerCount} AI · {room.phase}
            </div>
            {!room.canSummon && (
              <div className="mt-2 text-xs text-orange-300">
                You can only summon during waiting/showdown, with at least one real player seated and an open seat available.
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
        {message && <p className="text-sm text-green-400">{message}</p>}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">Girls At This Table</h3>
            <span className="text-xs text-gray-500">{currentHousePlayers.length} seated</span>
          </div>

          {currentHousePlayers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-900/40 px-4 py-6 text-sm text-gray-500">
              No AI girls are currently seated here.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {currentHousePlayers.map((player) => (
                <div key={player.playerId} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-800 bg-gray-950/70 p-3">
                  <div className="flex items-center gap-3">
                    <AvatarDisplay avatarId={player.avatar} size="md" />
                    <div>
                      <div className="font-semibold text-white">{player.username}</div>
                      <div className="text-xs text-gray-500">
                        {player.botTitle ?? 'House AI'}
                        {player.leaveAfterHand ? ' · leaving after hand' : ''}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDismiss(player.playerId)}
                    disabled={actionPlayerId === player.playerId}
                    className="rounded-lg border border-red-700 px-3 py-2 text-sm font-semibold text-red-300 transition-colors hover:border-red-500 hover:text-white disabled:cursor-not-allowed disabled:border-gray-700 disabled:text-gray-600"
                  >
                    {actionPlayerId === player.playerId ? 'Working...' : 'Dismiss'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">House Roster</h3>
            <span className="text-xs text-gray-500">{availableHousePlayers.length} ready</span>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-900/40 px-4 py-6 text-sm text-gray-500">
              Loading buzzer roster...
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {housePlayers.map((player) => {
                const seatedHere = player.assignedTableId === room?.tableId
                const canSummonPlayer =
                  !seatedHere
                  && !player.assignedTableId
                  && player.isReady
                  && player.bankroll >= (room?.minBuyin ?? 0)
                  && canSummonNow

                return (
                  <div key={player.id} className="rounded-2xl border border-gray-800 bg-gray-950/70 p-3">
                    <div className="flex items-center gap-3">
                      <AvatarDisplay avatarId={player.avatar} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-white">{player.name}</div>
                        <div className="truncate text-xs text-gray-500">{player.title}</div>
                        <div className="mt-1 text-xs text-yellow-400">{player.bankroll.toLocaleString()} bankroll</div>
                        <div className="mt-1 text-[11px] text-gray-400">{formatAvailability(player, room)}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-[11px] text-gray-600">
                        {seatedHere
                          ? 'Already here'
                          : player.bankroll < (room?.minBuyin ?? 0)
                            ? 'Below table minimum'
                            : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSummon(player.id)}
                        disabled={!canSummonPlayer || actionPlayerId === player.id}
                        className="rounded-lg border border-yellow-700 px-3 py-2 text-sm font-semibold text-yellow-300 transition-colors hover:border-yellow-500 hover:text-white disabled:cursor-not-allowed disabled:border-gray-700 disabled:text-gray-600"
                      >
                        {actionPlayerId === player.id ? 'Working...' : 'Buzz In'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
