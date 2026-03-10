'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { GameState, HandResult, ChatMessage } from '@/types/poker'
import { PlayerSeat } from './PlayerSeat'
import { CommunityCards } from './CommunityCards'
import { ActionPanel } from './ActionPanel'
import { HandResultModal } from './HandResultModal'
import { ChatBox } from './ChatBox'
import { ActionLog } from './ActionLog'

// ─── Seat positions ───────────────────────────────────────────────────────────
// Coordinates are % of the TABLE container (max-w-2xl, paddingBottom 52%).
// The felt oval occupies the full container. Seats are placed around its edge.
// Negative values let seats hang slightly outside the oval boundary.
const SEAT_POSITIONS: Record<number, React.CSSProperties> = {
  0: { bottom: '-18%', left: '50%', transform: 'translateX(-50%)' }, // bottom-center (player)
  1: { top: '45%',    left: '-6%', transform: 'translateY(-50%)' }, // left
  2: { top: '-12%',   left: '12%' },                                 // top-left
  3: { top: '-16%',   left: '33%' },                                 // top, left of center
  4: { top: '-16%',   right: '33%' },                                // top, right of center
  5: { top: '-12%',   right: '12%' },                                // top-right
  6: { top: '45%',    right: '-6%', transform: 'translateY(-50%)' }, // right
  7: { bottom: '-18%',left: '22%' },                                 // bottom-left
  8: { bottom: '-18%',right: '22%' },                                // bottom-right
}

interface PokerTableProps {
  gameState: GameState
  handResult: HandResult | null
  messages: ChatMessage[]
  actionLogs: string[]
  timeLeft: number
  onAction: (action: string, amount?: number) => void
  onChat: (text: string) => void
  onLeave: () => void
  onSitOut: () => void
  onSitIn: () => void
  clearHandResult: () => void
  countdown: number | null
}

export function PokerTable({
  gameState,
  handResult,
  messages,
  actionLogs,
  timeLeft,
  onAction,
  onChat,
  onLeave,
  onSitOut,
  onSitIn,
  clearHandResult,
  countdown,
}: PokerTableProps) {
  const me = gameState.players.find((p) => p.playerId === gameState.myPlayerId)
  const isMyTurn = me?.isCurrentTurn ?? false
  const isSittingOut = me?.sittingOut ?? false

  // Dealer speech bubble — latest action log, fades after 3.5 s
  const [dealerSpeech, setDealerSpeech] = useState('')
  useEffect(() => {
    if (actionLogs.length === 0) return
    const latest = actionLogs[actionLogs.length - 1]
    setDealerSpeech(latest)
    const t = setTimeout(() => setDealerSpeech(''), 3500)
    return () => clearTimeout(t)
  }, [actionLogs])

  return (
    <div className="relative w-full h-screen bg-gray-950 overflow-hidden flex flex-col">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-gray-800 z-10 flex-shrink-0">
        <div className="text-white font-bold">{gameState.tableName}</div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>Hand #{gameState.handNumber}</span>
          <span>{gameState.smallBlind}/{gameState.bigBlind}</span>
          {me && <span className="text-yellow-400 font-bold">{me.stack.toLocaleString()} chips</span>}
        </div>
        <div className="flex items-center gap-2">
          {me && !isSittingOut && gameState.phase === 'waiting' && (
            <button onClick={onSitOut} className="text-gray-400 hover:text-yellow-400 text-sm border border-gray-700 px-3 py-1 rounded-lg transition-colors">
              Stand Up
            </button>
          )}
          {me && isSittingOut && (
            <button onClick={onSitIn} className="text-yellow-400 hover:text-white text-sm border border-yellow-600 px-3 py-1 rounded-lg transition-colors">
              Sit Down
            </button>
          )}
          <button onClick={onLeave} className="text-gray-400 hover:text-red-400 text-sm border border-gray-700 px-3 py-1 rounded-lg transition-colors">
            Leave Room
          </button>
        </div>
      </div>

      {/* ── Table area ── */}
      {/*
        Layout (top → bottom inside flex-1):
          1. Dealer row  — flex-shrink-0, always fully visible
          2. Table scene — flex-shrink-0, oval + seats
          3. flex spacer so the two items stay centered together
      */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 overflow-hidden py-2 px-4">

        {/* 1. Dealer (Eunice) + speech bubble */}
        <div className="flex-shrink-0 flex flex-col items-center z-30">
          {/* Speech bubble — sits between dealer face and table */}
          <div className="h-8 flex items-end justify-center mb-0.5">
            {dealerSpeech && (
              <div className="relative bg-white text-gray-900 text-[11px] font-semibold
                              px-3 py-1 rounded-2xl shadow-xl max-w-[240px] text-center leading-snug">
                {dealerSpeech}
                {/* Triangle pointing DOWN toward table */}
                <span className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-0 h-0 block"
                  style={{ borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '7px solid white' }} />
              </div>
            )}
          </div>

          <Image
            src="/Eunice1.png"
            alt="Dealer"
            width={108}
            height={144}
            className="object-contain object-top select-none"
            style={{
              height: 'clamp(80px, 12vw, 140px)',
              width: 'auto',
              filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.9))',
            }}
            priority
          />
        </div>

        {/* 2. Table scene — oval + seats */}
        {/*
          max-w-2xl = 672 px. paddingBottom 52% → height = 349 px at full width.
          Seats use negative % to hang outside the oval boundary — no overflow:hidden
          on any ancestor, so they render correctly.
        */}
        <div className="flex-shrink-0 relative w-full max-w-2xl" style={{ paddingBottom: '52%' }}>
          <div className="absolute inset-0">

            {/* Felt oval */}
            <div className="absolute inset-0 rounded-[50%] bg-amber-950 shadow-[0_0_60px_rgba(0,0,0,0.9)]">
              {/* Rail sheen */}
              <div className="absolute inset-[3px] rounded-[50%] bg-gradient-to-b from-amber-700/40 to-transparent" />
              {/* Felt surface */}
              <div className="absolute inset-[10px] rounded-[50%] bg-felt">
                <div className="absolute inset-3 rounded-[50%] border border-felt-light/20" />
                {/* Center content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  {countdown !== null && gameState.phase === 'waiting' && (
                    <div className="text-white text-lg font-bold animate-pulse">
                      Game starting in {countdown}s...
                    </div>
                  )}
                  {gameState.phase === 'waiting' && countdown === null && (
                    <div className="text-gray-300 text-sm">Waiting for players...</div>
                  )}
                  {gameState.phase !== 'waiting' && (
                    <CommunityCards cards={gameState.community} phase={gameState.phase} pot={gameState.pot} />
                  )}
                </div>
              </div>
            </div>

            {/* Player seats — positioned relative to the paddingBottom container */}
            {gameState.players.map((player) => {
              const pos = SEAT_POSITIONS[player.seat]
              if (!pos) return null
              return (
                <div key={player.playerId} className="absolute z-10" style={pos}>
                  <PlayerSeat
                    player={player}
                    timeLeft={isMyTurn && player.isCurrentTurn ? timeLeft : undefined}
                    actionTimeLimit={30}
                  />
                </div>
              )
            })}

          </div>
        </div>

      </div>

      {/* ── Action bar ── */}
      <div className="flex-shrink-0 flex items-center justify-center py-3 px-4 bg-gray-900/80 border-t border-gray-800 min-h-[76px] z-20 gap-4">
        {gameState.myHandRank && gameState.phase !== 'waiting' && (
          <div className="text-center hidden sm:block">
            <div className="text-yellow-400 text-xs font-bold uppercase tracking-wide">{gameState.myHandRank}</div>
            <div className="text-gray-600 text-xs">your hand</div>
          </div>
        )}
        {isMyTurn && gameState.validActions.length > 0 ? (
          <ActionPanel
            validActions={gameState.validActions}
            callAmount={gameState.callAmount}
            minRaise={gameState.minRaise}
            myStack={me?.stack ?? 0}
            bigBlind={gameState.bigBlind}
            onAction={(action, amount) => onAction(action, amount)}
            timeLeft={timeLeft}
          />
        ) : isSittingOut ? (
          <div className="flex items-center gap-3">
            <span className="text-yellow-500 text-sm">You are sitting out</span>
            <button onClick={onSitIn} className="bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold px-4 py-2 rounded-lg transition-colors">
              Sit Down
            </button>
          </div>
        ) : gameState.phase !== 'waiting' ? (
          <p className="text-gray-500 text-sm">
            Waiting for <span className="text-white">{gameState.players.find(p => p.isCurrentTurn)?.username ?? '...'}</span> to act
          </p>
        ) : (
          <p className="text-gray-600 text-sm">Waiting for players to join...</p>
        )}
      </div>

      {/* ── Side panel: Action log + Chat ── */}
      <div className="absolute bottom-24 right-4 w-64 z-10 flex flex-col gap-2">
        <ActionLog logs={actionLogs} />
        <ChatBox messages={messages} onSend={onChat} myPlayerId={gameState.myPlayerId} />
      </div>

      {/* ── Hand result overlay ── */}
      {handResult && (
        <HandResultModal result={handResult} onClose={clearHandResult} />
      )}
    </div>
  )
}
