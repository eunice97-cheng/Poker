'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { GameState, HandResult, ChatMessage } from '@/types/poker'
import { PlayerSeat } from './PlayerSeat'
import { CommunityCards } from './CommunityCards'
import { ActionPanel } from './ActionPanel'
import { HandResultModal } from './HandResultModal'
import { ChatBox } from './ChatBox'

// Dealer is at the TOP center. Seats are arranged around the felt oval.
// All % values are relative to the outer container (which includes space
// above the felt for the dealer image).
// Felt occupies roughly top:18% → bottom:8% of the container.
const SEAT_POSITIONS: Record<number, React.CSSProperties> = {
  0: { bottom: '4%',  left: '50%', transform: 'translateX(-50%)' }, // bottom-center  (player)
  1: { top:    '52%', left: '1%',  transform: 'translateY(-50%)' }, // left side
  2: { top:    '22%', left: '10%' },                                 // top-left
  3: { top:    '17%', left: '30%' },                                 // top, left of center
  4: { top:    '17%', right:'30%' },                                 // top, right of center
  5: { top:    '22%', right:'10%' },                                 // top-right
  6: { top:    '52%', right:'1%',  transform: 'translateY(-50%)' }, // right side
  7: { bottom: '4%',  left: '22%' },                                 // bottom-left
  8: { bottom: '4%',  right:'22%' },                                 // bottom-right
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

  // Dealer speech bubble — shows latest action log, auto-fades after 3 s
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
      <div className="flex-1 relative flex items-center justify-center p-4 min-h-0">
        {/*
          Container aspect ratio: paddingBottom 66% ≈ 1.5:1
          max-w-3xl keeps the table noticeably smaller than the viewport.
          Structure (top → bottom of container):
            0–17%  : dealer image + speech bubble
            17–92% : felt oval
            92–100%: bottom seat overflow
        */}
        <div className="relative w-full max-w-3xl" style={{ paddingBottom: '66%' }}>
          <div className="absolute inset-0">

            {/* ── Dealer (Eunice) — top center ── */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
              {/* Speech bubble (above the felt edge, below dealer face) */}
              <div className="relative h-10 flex items-end justify-center mb-0.5">
                {dealerSpeech && (
                  <div className="relative bg-white text-gray-900 text-[11px] font-medium px-3 py-1.5 rounded-2xl shadow-xl max-w-[220px] text-center leading-tight">
                    {dealerSpeech}
                    {/* Triangle pointer — points UP toward dealer's mouth */}
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 block"
                      style={{ borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '8px solid white' }} />
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
                  height: '15vw',
                  maxHeight: '150px',
                  minHeight: '80px',
                  width: 'auto',
                  filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.8))',
                }}
                priority
              />
            </div>

            {/* ── Felt table oval — sits below the dealer ── */}
            <div className="absolute left-0 right-0" style={{ top: '18%', bottom: '8%' }}>
              {/* Outer rail */}
              <div className="absolute inset-0 rounded-[50%] bg-amber-950 shadow-[0_0_60px_rgba(0,0,0,0.9)]" />
              {/* Rail sheen */}
              <div className="absolute inset-[3px] rounded-[50%] bg-gradient-to-b from-amber-800/50 to-transparent" />
              {/* Felt surface */}
              <div className="absolute inset-[10px] rounded-[50%] bg-felt">
                {/* Inner stripe */}
                <div className="absolute inset-3 rounded-[50%] border border-felt-light/25" />
                {/* Community cards / status */}
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
                    <CommunityCards
                      cards={gameState.community}
                      phase={gameState.phase}
                      pot={gameState.pot}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* ── Player seats ── */}
            {gameState.players.map((player) => {
              const pos = SEAT_POSITIONS[player.seat]
              if (!pos) return null
              return (
                <div key={player.playerId} className="absolute" style={pos}>
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

      {/* ── Chat only (action log is now dealer speech bubble) ── */}
      <div className="absolute bottom-24 right-4 w-64 z-10">
        <ChatBox messages={messages} onSend={onChat} myPlayerId={gameState.myPlayerId} />
      </div>

      {/* ── Hand result overlay ── */}
      {handResult && (
        <HandResultModal result={handResult} onClose={clearHandResult} />
      )}
    </div>
  )
}
