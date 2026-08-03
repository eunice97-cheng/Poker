'use client'

import { ClientPlayer } from '@/types/poker'
import { CardComponent } from './CardComponent'
import { AvatarDisplay } from '@/components/ui/AvatarDisplay'

interface PlayerSeatProps {
  player: ClientPlayer
  timeLeft?: number
  actionTimeLimit?: number
  backImage?: string
}

export function PlayerSeat({ player, timeLeft, actionTimeLimit, backImage }: PlayerSeatProps) {
  const timerPct = actionTimeLimit && timeLeft !== undefined ? (timeLeft / actionTimeLimit) * 100 : 100
  const timerColor = timerPct > 50 ? 'bg-green-500' : timerPct > 20 ? 'bg-yellow-500' : 'bg-red-500'
  const statusLabel = player.folded
    ? 'Fold'
    : player.allIn
      ? 'All In'
      : player.sittingOut
        ? 'Out'
        : player.isCurrentTurn
          ? 'Turn'
          : player.currentBet > 0
            ? `Bet ${player.currentBet.toLocaleString()}`
            : ''

  return (
    <div
      className={`
        casino-player-seat relative flex flex-col items-center gap-1 p-2 rounded-xl transition-all
        ${player.isCurrentTurn ? 'ring-2 ring-yellow-400 bg-yellow-400/10' : ''}
        ${player.folded ? 'opacity-40' : ''}
        ${!player.isConnected ? 'opacity-60' : ''}
      `}
    >
      {/* Dealer / Blind badges */}
      <div className="casino-player-seat__badges flex gap-1 h-5">
        {player.isDealer && (
          <span className="bg-white text-black text-xs font-bold px-1.5 rounded-full leading-5">D</span>
        )}
        {player.isSB && !player.isDealer && (
          <span className="bg-gray-500 text-white text-xs font-bold px-1.5 rounded-full leading-5">SB</span>
        )}
        {player.isBB && (
          <span className="bg-gray-600 text-white text-xs font-bold px-1.5 rounded-full leading-5">BB</span>
        )}
      </div>

      {/* Avatar */}
      <div className={`casino-player-seat__avatar rounded-lg transition-all ${player.isCurrentTurn ? 'ring-2 ring-yellow-400' : ''}`}>
        <AvatarDisplay avatarId={player.avatar ?? 'avatar_m1'} size="md" />
      </div>

      {/* Name + Stack */}
      <div className="casino-player-seat__meta text-center">
        <div className="text-white text-xs font-semibold truncate max-w-[80px]">{player.username}</div>
        {player.isBot && player.botTitle && (
          <div className="max-w-[88px] truncate text-[10px] text-white/55">{player.botTitle}</div>
        )}
        <div className="text-yellow-400 text-xs">{player.stack.toLocaleString()}</div>
      </div>

      {statusLabel && (
        <div className="casino-player-seat__status hidden rounded-full border border-yellow-400/30 bg-black/45 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-yellow-200">
          {statusLabel}
        </div>
      )}

      {/* Hole Cards */}
      {player.holeCards.length > 0 && !player.folded && (
        <div className="casino-player-seat__cards flex gap-0.5">
          {player.holeCards.map((card, i) => (
            <CardComponent key={i} card={card} size="sm" backImage={backImage} />
          ))}
        </div>
      )}

      {/* Current bet chip */}
      {player.currentBet > 0 && (
        <div className="casino-player-seat__bet-chip absolute -bottom-3 bg-chip-gold text-black text-xs font-bold px-2 py-0.5 rounded-full border-2 border-yellow-300 shadow">
          {player.currentBet.toLocaleString()}
        </div>
      )}

      {/* All-in label */}
      {player.allIn && (
        <div className="casino-player-seat__all-in absolute -top-2 bg-red-600 text-white text-xs font-bold px-2 rounded-full">ALL IN</div>
      )}

      {/* Disconnected label */}
      {!player.isConnected && (
        <div className="casino-player-seat__away absolute -top-2 bg-gray-700 text-gray-400 text-xs px-2 rounded-full">Away</div>
      )}

      {/* Action timer bar */}
      {player.isCurrentTurn && actionTimeLimit && (
        <div className="casino-player-seat__timer w-full h-1 bg-gray-700 rounded-full mt-1">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${timerColor}`}
            style={{ width: `${timerPct}%` }}
          />
        </div>
      )}
    </div>
  )
}
