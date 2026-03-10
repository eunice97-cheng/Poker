'use client'

import Image from 'next/image'
import { GameState, HandResult, ChatMessage } from '@/types/poker'
import { PlayerSeat } from './PlayerSeat'
import { CommunityCards } from './CommunityCards'
import { ActionPanel } from './ActionPanel'
import { HandResultModal } from './HandResultModal'
import { ChatBox } from './ChatBox'
import { ActionLog } from './ActionLog'

// Seat positions for a horizontal table with dealer at bottom-center.
// Coordinates are % of the full outer container (felt + dealer area combined).
// Felt occupies top ~78% of container; dealer image fills the bottom ~22%.
const SEAT_POSITIONS: Record<number, React.CSSProperties> = {
  0: { bottom: '24%', left:  '20%' },                              // bottom-left (flanks dealer)
  1: { top:    '36%', left:  '1%',  transform: 'translateY(-50%)' }, // left side
  2: { top:    '4%',  left:  '12%' },                              // top-left
  3: { top:    '0%',  left:  '31%' },                              // top, left of center
  4: { top:    '0%',  left:  '50%', transform: 'translateX(-50%)' }, // top-center
  5: { top:    '0%',  right: '31%' },                              // top, right of center
  6: { top:    '4%',  right: '12%' },                              // top-right
  7: { top:    '36%', right: '1%',  transform: 'translateY(-50%)' }, // right side
  8: { bottom: '24%', right: '20%' },                              // bottom-right (flanks dealer)
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

  return (
    <div className="relative w-full h-screen bg-gray-950 overflow-hidden flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-gray-800 z-10 flex-shrink-0">
        <div className="text-white font-bold">{gameState.tableName}</div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>Hand #{gameState.handNumber}</span>
          <span>{gameState.smallBlind}/{gameState.bigBlind}</span>
          {me && <span className="text-yellow-400 font-bold">{me.stack.toLocaleString()} chips</span>}
        </div>
        <div className="flex items-center gap-2">
          {me && !isSittingOut && gameState.phase === 'waiting' && (
            <button
              onClick={onSitOut}
              className="text-gray-400 hover:text-yellow-400 text-sm transition-colors border border-gray-700 px-3 py-1 rounded-lg"
            >
              Stand Up
            </button>
          )}
          {me && isSittingOut && (
            <button
              onClick={onSitIn}
              className="text-yellow-400 hover:text-white text-sm transition-colors border border-yellow-600 px-3 py-1 rounded-lg"
            >
              Sit Down
            </button>
          )}
          <button
            onClick={onLeave}
            className="text-gray-400 hover:text-red-400 text-sm transition-colors border border-gray-700 px-3 py-1 rounded-lg"
          >
            Leave Room
          </button>
        </div>
      </div>

      {/* Table area */}
      <div className="flex-1 relative flex items-center justify-center px-4 pt-2 pb-1 min-h-0">
        {/*
          Outer wrapper sets the aspect ratio for the whole scene
          (felt + dealer standing area below).
          paddingBottom: 55% → container is ~1.82:1 wide
        */}
        <div className="relative w-full max-w-5xl" style={{ paddingBottom: '55%' }}>
          <div className="absolute inset-0">

            {/* ── Felt table oval ── occupies top ~78% of the container */}
            <div
              className="absolute left-0 right-0"
              style={{ top: 0, bottom: '22%' }}
            >
              {/* Outer rail (wood/leather look) */}
              <div className="absolute inset-0 rounded-[50%] bg-amber-950 shadow-[0_0_80px_rgba(0,0,0,0.9)]" />
              {/* Rail highlight */}
              <div className="absolute inset-1 rounded-[50%] bg-gradient-to-b from-amber-800/60 to-amber-950/60" />
              {/* Felt surface */}
              <div className="absolute inset-[10px] rounded-[50%] bg-felt shadow-inner">
                {/* Inner stripe ring */}
                <div className="absolute inset-3 rounded-[50%] border border-felt-light/30" />

                {/* Dealer tray at bottom of felt */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-60">
                  <div className="w-24 h-1.5 bg-amber-800 rounded-full" />
                  <span className="text-amber-700 text-[9px] uppercase tracking-[0.2em] font-bold">Dealer</span>
                </div>

                {/* Center content: community cards / waiting / countdown */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  {countdown !== null && gameState.phase === 'waiting' && (
                    <div className="text-white text-xl font-bold animate-pulse">
                      Game starting in {countdown}s...
                    </div>
                  )}
                  {gameState.phase === 'waiting' && countdown === null && (
                    <div className="text-gray-300 text-base">Waiting for players...</div>
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

            {/* ── Dealer (Eunice) — stands at bottom, overlapping felt edge ── */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 flex flex-col items-end">
              <Image
                src="/Eunice1.png"
                alt="Dealer Eunice"
                width={144}
                height={192}
                className="object-contain object-top select-none"
                style={{
                  filter: 'drop-shadow(0 -6px 16px rgba(0,0,0,0.7))',
                  height: '20vw',
                  maxHeight: '200px',
                  minHeight: '100px',
                  width: 'auto',
                }}
                priority
              />
            </div>

            {/* ── Player seats ── positioned relative to full container */}
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

      {/* Action bar — always visible at bottom */}
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
            <button
              onClick={onSitIn}
              className="bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold px-4 py-2 rounded-lg transition-colors"
            >
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

      {/* Action log + Chat */}
      <div className="absolute bottom-24 right-4 w-64 z-10 flex flex-col gap-2">
        <ActionLog logs={actionLogs} />
        <ChatBox messages={messages} onSend={onChat} myPlayerId={gameState.myPlayerId} />
      </div>

      {/* Hand result overlay */}
      {handResult && (
        <HandResultModal result={handResult} onClose={clearHandResult} />
      )}
    </div>
  )
}
