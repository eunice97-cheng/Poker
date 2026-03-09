'use client'

import { GameState, HandResult, ChatMessage } from '@/types/poker'
import { PlayerSeat } from './PlayerSeat'
import { CommunityCards } from './CommunityCards'
import { ActionPanel } from './ActionPanel'
import { HandResultModal } from './HandResultModal'
import { ChatBox } from './ChatBox'

// Seat positions around the oval table (CSS % positions)
const SEAT_POSITIONS = [
  { bottom: '8%',  left: '50%',  transform: 'translateX(-50%)' }, // seat 0 - bottom center
  { bottom: '20%', left: '15%',  transform: '' },                  // seat 1 - bottom left
  { top: '20%',    left: '5%',   transform: '' },                  // seat 2 - left
  { top: '5%',     left: '25%',  transform: '' },                  // seat 3 - top left
  { top: '5%',     right: '25%', transform: '' },                  // seat 4 - top right
  { top: '20%',    right: '5%',  transform: '' },                  // seat 5 - right
  { bottom: '20%', right: '15%', transform: '' },                  // seat 6 - bottom right
  { bottom: '8%',  left: '30%',  transform: '' },                  // seat 7
  { bottom: '8%',  right: '30%', transform: '' },                  // seat 8
]

interface PokerTableProps {
  gameState: GameState
  handResult: HandResult | null
  messages: ChatMessage[]
  timeLeft: number
  onAction: (action: string, amount?: number) => void
  onChat: (text: string) => void
  onLeave: () => void
  clearHandResult: () => void
  countdown: number | null
}

export function PokerTable({
  gameState,
  handResult,
  messages,
  timeLeft,
  onAction,
  onChat,
  onLeave,
  clearHandResult,
  countdown,
}: PokerTableProps) {
  const me = gameState.players.find((p) => p.playerId === gameState.myPlayerId)
  const isMyTurn = me?.isCurrentTurn ?? false

  return (
    <div className="relative w-full h-screen bg-gray-950 overflow-hidden flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-gray-800 z-10">
        <div className="text-white font-bold">{gameState.tableName}</div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>Hand #{gameState.handNumber}</span>
          <span>{gameState.smallBlind}/{gameState.bigBlind}</span>
          {me && <span className="text-yellow-400 font-bold">{me.stack.toLocaleString()} chips</span>}
        </div>
        <button
          onClick={onLeave}
          className="text-gray-400 hover:text-red-400 text-sm transition-colors border border-gray-700 px-3 py-1 rounded-lg"
        >
          Leave Table
        </button>
      </div>

      {/* Felt table oval */}
      <div className="flex-1 relative flex items-center justify-center p-8">
        <div className="relative w-full max-w-4xl" style={{ paddingBottom: '55%' }}>
          {/* Oval felt */}
          <div className="absolute inset-0 bg-felt rounded-[50%] border-8 border-yellow-900/60 shadow-2xl">
            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              {countdown !== null && gameState.phase === 'waiting' && (
                <div className="text-white text-xl font-bold animate-pulse">
                  Game starting in {countdown}s...
                </div>
              )}
              {gameState.phase === 'waiting' && countdown === null && (
                <div className="text-gray-300 text-lg">Waiting for players...</div>
              )}
              {gameState.phase !== 'waiting' && (
                <CommunityCards
                  cards={gameState.community}
                  phase={gameState.phase}
                  pot={gameState.pot}
                />
              )}
            </div>

            {/* Player seats */}
            {gameState.players.map((player) => {
              const pos = SEAT_POSITIONS[player.seat]
              if (!pos) return null
              return (
                <div
                  key={player.playerId}
                  className="absolute"
                  style={{ ...pos }}
                >
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

      {/* Action panel */}
      {isMyTurn && gameState.validActions.length > 0 && (
        <div className="flex justify-center pb-4 z-10">
          <ActionPanel
            validActions={gameState.validActions}
            callAmount={gameState.callAmount}
            minRaise={gameState.minRaise}
            myStack={me?.stack ?? 0}
            bigBlind={gameState.bigBlind}
            onAction={(action, amount) => onAction(action, amount)}
            timeLeft={timeLeft}
          />
        </div>
      )}

      {/* Chat */}
      <div className="absolute bottom-20 right-4 w-72 z-10">
        <ChatBox messages={messages} onSend={onChat} myPlayerId={gameState.myPlayerId} />
      </div>

      {/* Hand result overlay */}
      {handResult && (
        <HandResultModal result={handResult} onClose={clearHandResult} />
      )}
    </div>
  )
}
