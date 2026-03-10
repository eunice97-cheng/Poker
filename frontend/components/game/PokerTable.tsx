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

// ─── Scene geometry ───────────────────────────────────────────────────────────
// Single fixed-pixel scene: 560 × 360 px
// Oval (rail edge): left=30, top=130, width=500, height=180  → 2.78:1 ratio → clearly horizontal
// Oval centre: cx=280, cy=220
// Dealer image: top of scene, centred horizontally (avoids oval top)
// Seats placed on ellipse perimeter using ellipsePt(), angle 90° = top centre = dealer spot (avoided)

const SCENE_W = 560
const SCENE_H = 360

// Oval dimensions
const OW = 500   // oval width
const OH = 180   // oval height
const OCX = 280  // oval centre x
const OCY = 220  // oval centre y

// Padding around oval so seats don't clip
const PAD_X = 40
const PAD_Y = 30

function ellipsePt(angleDeg: number): React.CSSProperties {
  const rad = (angleDeg * Math.PI) / 180
  return {
    position: 'absolute',
    left: `${Math.round(OCX + (OW / 2 + PAD_X) * Math.cos(rad))}px`,
    top: `${Math.round(OCY - (OH / 2 + PAD_Y) * Math.sin(rad))}px`,
    transform: 'translate(-50%, -50%)',
  }
}

// Seat assignments — angles avoid 90° (top-centre = dealer area)
// 0 = bottom-centre (human player), rest go clockwise
const SEAT_POSITIONS: Record<number, React.CSSProperties> = {
  0: ellipsePt(270),   // bottom-centre
  1: ellipsePt(220),   // bottom-left
  2: ellipsePt(155),   // left-ish
  3: ellipsePt(110),   // top-left (near dealer but clear)
  4: ellipsePt(70),    // top-right
  5: ellipsePt(25),    // right-ish
  6: ellipsePt(320),   // bottom-right
  7: ellipsePt(200),   // left
  8: ellipsePt(340),   // right
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

      {/* ── Main area: centred scene ── */}
      <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden">

        {/*
          Single fixed-pixel scene container.
          Everything (dealer, speech bubble, oval, seats) is absolutely positioned inside.
          Scene: 560 × 360 px
        */}
        <div
          className="relative flex-shrink-0"
          style={{ width: `${SCENE_W}px`, height: `${SCENE_H}px` }}
        >

          {/* ── Dealer (Eunice) — top-centre of scene ── */}
          <div
            className="absolute z-30 flex flex-col items-center"
            style={{ top: 0, left: '50%', transform: 'translateX(-50%)' }}
          >
            <Image
              src="/Eunice1.png"
              alt="Dealer"
              width={72}
              height={96}
              className="object-contain object-top select-none"
              style={{
                height: '96px',
                width: 'auto',
                filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.9))',
              }}
              priority
            />

            {/* Speech bubble — below the dealer image, above oval */}
            {dealerSpeech && (
              <div
                className="relative bg-white text-gray-900 text-[11px] font-semibold
                            px-3 py-1 rounded-2xl shadow-xl max-w-[200px] text-center leading-snug mt-1"
              >
                {dealerSpeech}
                {/* Triangle pointing down toward oval */}
                <span
                  className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-0 h-0 block"
                  style={{
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: '7px solid white',
                  }}
                />
              </div>
            )}
          </div>

          {/* ── Felt oval ── */}
          <div
            className="absolute rounded-[50%] bg-amber-950 shadow-[0_0_60px_rgba(0,0,0,0.9)]"
            style={{
              left: `${OCX - OW / 2}px`,   // 30px
              top: `${OCY - OH / 2}px`,    // 130px
              width: `${OW}px`,            // 500px
              height: `${OH}px`,           // 180px
            }}
          >
            {/* Rail sheen */}
            <div className="absolute inset-[3px] rounded-[50%] bg-gradient-to-b from-amber-700/40 to-transparent" />
            {/* Felt surface */}
            <div className="absolute inset-[10px] rounded-[50%] bg-felt">
              <div className="absolute inset-3 rounded-[50%] border border-felt-light/20" />
              {/* Centre content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                {countdown !== null && gameState.phase === 'waiting' && (
                  <div className="text-white text-base font-bold animate-pulse">
                    Starting in {countdown}s…
                  </div>
                )}
                {gameState.phase === 'waiting' && countdown === null && (
                  <div className="text-gray-300 text-sm">Waiting for players…</div>
                )}
                {gameState.phase !== 'waiting' && (
                  <CommunityCards cards={gameState.community} phase={gameState.phase} pot={gameState.pot} />
                )}
              </div>
            </div>
          </div>

          {/* ── Player seats — absolute, placed on ellipse perimeter ── */}
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
            Waiting for <span className="text-white">{gameState.players.find(p => p.isCurrentTurn)?.username ?? '…'}</span> to act
          </p>
        ) : (
          <p className="text-gray-600 text-sm">Waiting for players to join…</p>
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
